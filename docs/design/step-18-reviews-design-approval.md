# Step 18 — Reviews: design approval

**Pipeline stage:** Design gate (architect-review). Applied manually in the main thread — `architect-review` has a `.claude/agents/*.md` definition but is not a spawnable `subagent_type` in this harness (documented under Cross-cutting hygiene). The definition's intent was applied against the live schema.

**Verdict: APPROVED WITH CONDITIONS (C1–C9).** Grounded in live DB inspection 2026-07-21, not assumptions.

**Founder decisions in force (locked 2026-07-21):** D1 no schema change (a booking stays `completed`; "reviewed?" = a `reviews` row exists), D2 first name + a "Verified booking" tag (trust signal, true for every review by construction — intended), D3 immutable (no edit/delete), D4 comment optional, D5 no barber replies this slice, D6 moot given D3, D7 one review per booking (already enforced by `reviews.booking_id UNIQUE`), D8 defer barber-side surface, D9 aggregate shows on Discover/Explore cards automatically (`BarberCard`'s `RatingLine` already reads `barber_profile.rating`).

---

## What already exists (live-verified)

- **`reviews` table** (migration 0001): `id, booking_id, customer_id, comment, created_at, barber_id, rating`. Constraints: PK `id`; `booking_id` UNIQUE; FKs to `bookings`/`users`×2 (all `ON DELETE CASCADE`); CHECK `rating between 1 and 5`. Indexes `idx_reviews_barber_id`, `idx_reviews_customer_id` (0001/0004).
- **RLS:** `reviews_select_all` (SELECT, `authenticated`, `USING true`); `reviews_insert_own_customer` (INSERT, `authenticated`, `WITH CHECK customer_id = auth.uid()` — and NOTHING else).
- **Trigger:** `trg_enforce_review_requires_completed` → `enforce_review_requires_completed_booking()` (BEFORE INSERT), which checks ONLY that the referenced booking's status is `completed`. It does NOT check that the review's `customer_id`/`barber_id` match the booking's participants.
- **`barber_profile.rating`** is protected by `protect_barber_verification_fields()` (BEFORE INSERT/UPDATE, SECURITY DEFINER): for any caller whose `auth.role()` is not `service_role`, it reverts `rating` (and `verified`, `verification_status`) to the OLD value. So a client can never write the aggregate.

## The live security hole this run MUST close (not a founder question — required correctness)

Proven 2026-07-21 by rolled-back probe as a real `authenticated` session (`set local role authenticated` + JWT claims):
- Posting a review against **your own completed booking** but naming an **arbitrary, uninvolved barber** → **ALLOWED**.
- Posting on behalf of **another customer** → BLOCKED (42501; the `customer_id = auth.uid()` check holds).
- Reviewing a **pending** booking → BLOCKED (P0001; the completed-only trigger holds).

So any authenticated customer can 1-star **any barber in the system** via a completed booking id they legitimately own. Harmless today (no review UI, `rating` unwritable), but it becomes a public-rating poisoning vector the instant aggregation ships. Same class as the price/attribution vector migration 0010 closed. **This is C-critical and lands in the same migration as aggregation.**

---

## Approved design

### C1 — Schema migration (supabase-schema-architect only), one file, three parts

**Part A — harden `reviews_insert_own_customer`.** Replace the `WITH CHECK` with one that ties the row to a booking the caller actually owns AND makes the barber attribution non-forgeable:

```
with check (
  customer_id = auth.uid()
  and has_role('customer')
  and exists (
    select 1 from public.bookings b
    where b.id = reviews.booking_id
      and b.customer_id = reviews.customer_id
      and b.barber_id  = reviews.barber_id
      and b.status = 'completed'
  )
)
```

Notes for the architect authoring it:
- The `has_role('customer')` clause mirrors migration 0004's Fix 2 (absent on `reviews` today — a barber setting `customer_id` to their own uid currently passes). `has_role` is the existing SECURITY DEFINER helper.
- The EXISTS folds in the completed-status check too. The existing `enforce_review_requires_completed_booking()` trigger becomes redundant for the status check but should be LEFT in place (defence in depth, and it produces a clearer error message) — do not drop it.
- This does not need `barber_directory`/approval gating: an approved-only predicate would wrongly block a legitimate review of a barber who has since been unapproved. The booking's existence is the authorization, not current approval state.

**Part B — rating aggregation via a SECURITY DEFINER trigger with bounded role impersonation.** `AFTER INSERT` on `reviews` only (D3 makes UPDATE/DELETE arms unnecessary — do NOT add them; a future editability change would revisit this). The function recomputes `avg(rating)` for the affected `barber_id` and writes it to `barber_profile.rating`.

The obstacle is `protect_barber_verification_fields`, which reverts `rating` unless `auth.role() = 'service_role'`. **SECURITY DEFINER is not sufficient** — it changes the executing DATABASE role, but `auth.role()` reads the `request.jwt.claim.role` GUC, which SECURITY DEFINER does not touch. So the trigger must set that GUC. Required shape (the architect owns the exact SQL):

- Read and stash the current `request.jwt.claim.role` via `current_setting('request.jwt.claim.role', true)`.
- `perform set_config('request.jwt.claim.role', 'service_role', true)` — `is_local = true` scopes it to the current transaction.
- `update public.barber_profile set rating = (select coalesce(round(avg(rating)::numeric, 2), 0) from public.reviews where barber_id = new.barber_id) where user_id = new.barber_id;`
- **Restore** the stashed value immediately after the UPDATE (`set_config` back to the saved role, or to `''`/reset if it was null), so the impersonation does not leak to the remainder of the transaction. This is stricter than the CLAUDE.md Step 7-8 note (which sets it and relies on transaction-end reset) and is the safer pattern for a write path — bound the elevation to exactly the one UPDATE.
- `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `LANGUAGE plpgsql`. Owned by the same role as the other definer functions.

Rounding/column: RESOLVED live 2026-07-21 — `barber_profile.rating` is `numeric(3,2)` (precision 3, scale 2, default 0), so `round(avg(rating)::numeric, 2)` is exactly right and cannot overflow (max 5.00). No truncation risk, no schema question.

**Part C — reviewer-name projection RPC.** A SQL `STABLE SECURITY DEFINER` function shaped exactly like `get_booking_counterparts`, returning the reviewer's FIRST-NAME TOKEN only (never the full name — 0006 deliberately hid it):

```
get_review_authors(p_review_ids uuid[])
  returns table(review_id uuid, first_name text)
  -- split_part(u.name, ' ', 1) as first_name
  -- joined reviews r -> users u on u.id = r.customer_id
  -- no auth.uid() filter needed: reviews_select_all already exposes the rows to
  --   every authenticated caller; this only widens WHICH column (first name) is
  --   visible, which is exactly what D2 authorized. Document that reasoning.
```

This produces a known/accepted advisor WARN (same as the two existing RPCs) — that is expected and pre-accepted, not a new finding.

### C2 — Live verification is a mandatory, separate subtask
Mocked tests cannot see any of Part A/B/C's guarantees, and this project has been bitten by exactly that twice. After the migration applies, run rolled-back probes via MCP as a real `authenticated` session (not `service_role`):
1. Part A: the cross-account attribution attack (own booking, uninvolved barber) is now **rejected**.
2. Part A: a legitimate review (own completed booking, correct barber) still **inserts**.
3. Part B: after that legitimate insert, `barber_profile.rating` actually **holds the new average** from an `authenticated` session — proving the impersonation works and the protect trigger did not revert it. This is the single highest-value check (silent rating-stays-0 is the verification-bug failure shape).
4. Part B: the impersonation did not leak — after the insert, a subsequent write in the same session that SHOULD be reverted by the protect trigger still is.
5. Advisors show only the expected/accepted new RPC WARN.

### C3 — Data layer stays out of `src/customer/`→`src/barber/` cycles
New `reviewsData.ts`. Where it lives depends on D8 (deferred), so put it in `src/customer/` for now (customer-only surface this slice); if a barber-side view is added later, extract the shared read into `src/shared/` then — do not pre-abstract. Follows C1's no-cycle rule from the dashboard run.

### C4 — Aggregation is server-owned; the client NEVER writes `rating`
`reviewsData.submitReview` inserts into `reviews` only. It must not touch `barber_profile`. The trigger is the sole writer of the aggregate. Any client attempt to write `rating` is reverted by the protect trigger anyway — but the data layer must not even try.

### C5 — Pure, degrade-per-field reads
`fetchReviewsForBarber` and the batched `fetchOwnReviewsForBookingIds` (the "already reviewed?" state on the Bookings tab) follow the established batched-enrichment idiom (`listServicesForBarberIds`, `get_booking_counterparts`): a failed enrichment (e.g. the name projection) degrades to a calm fallback ("Verified booking" with no name), never fails the whole list.

### C6 — Error mapping
Map `23505` (duplicate review for a booking — reachable on a retry, since `booking_id` is UNIQUE) and the new Part-A rejection (surfaces as RLS `42501`) to calm, sentence-case copy via the existing per-app `errors.ts` table. No raw server text to the UI. Add a review-specific `invalid_input`/`already_reviewed` code rather than reusing the availability copy (the L1 lesson).

### C7 — No Realtime
`reviews` is not in the realtime publication and this slice does not add it. `supabase-realtime-optimizer` is explicitly out of scope. A newly posted review appears on the next focus-refresh, consistent with the rest of the app.

### C8 — `barber_profile.rating` starts surfacing on Discover/Explore automatically (D9)
`BarberCard`'s `RatingLine` already reads `barber_profile.rating`. Once aggregation ships, real numbers appear there with no UI change. Confirm `RatingLine` renders a `0`/no-reviews state honestly (not "0 stars" implying a bad barber) — a barber with no reviews yet must read as "new", not "rated zero". This may need a tiny copy/branch fix in `BarberCard`, tracked into the build stage.

### C9 — Star-rating input is new to the app
No star-rating INPUT exists anywhere yet. The submission screen's picker and the profile's star display are net-new visual components — route through the Ultra ui-ux-designer, and consider a shared `StarRating` (display) + `StarRatingInput` components since both apps' rating surfaces (and `BarberCard`) could reuse the display one. Decide extraction at the UI stage, not speculatively now.

---

## Risk register (design-level)

| Risk | Severity | Mitigation |
|---|---|---|
| Aggregation trigger's role impersonation implemented wrong → `rating` silently stays 0 forever (verification-bug failure shape, invisible to mocked tests) | HIGH | C2 probe #3, as a real `authenticated` session |
| Impersonation leaks `service_role` to the rest of the transaction | MED | C1 Part B restores the GUC immediately after the one UPDATE; C2 probe #4 |
| Part A under-scoped, attribution forgery ships live | HIGH | C2 probe #1, adversarial not code-read |
| `barber_profile.rating` column scale mismatch truncates the average | MED | C1 Part B: verify column type live before choosing rounding |
| "0 rating" reads as a bad barber rather than a new one on Discover/Explore | LOW | C8 honest empty-state branch |

## Out of scope (do not fold in)
Barber replies (D5), edit/delete (D3), barber-side reviews surface (D8), any Realtime, the `rated`/`archived` enum states (D1). One feature per pipeline run.
