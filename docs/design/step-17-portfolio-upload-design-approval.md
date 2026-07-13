# Step 17 — Portfolio upload + delete: design-approval note

Pipeline stage 2 (architect-review), run 2026-07-13. Feature: barber uploads/deletes portfolio
images (max 6), shown to customers on the barber profile Portfolio tab. Decomposition (stage 1)
produced the WBS; this note settles the open decisions D1–D7 so no code is written against an
undecided assumption. **No booking-state-machine surface is touched by this feature.**

## Architectural impact: Medium
Reuses the PORTFOLIO table + RLS + max-6 trigger (all already live) and the `verificationData.ts`
upload template. The one genuinely new architectural element is a **client-side public-URL read
path** that verification does not have (verification docs are only ever read by a founder in the
dashboard; portfolio images are read by customers in-app). That read path is shared across BOTH
apps, so it lives in `src/shared/`, not `src/barber/`.

## Decisions (authoritative for the build stages)

**D1 — Bucket visibility: PUBLIC bucket.** (Founder decision 2026-07-13; this REVERSED an initial
private+signed-URLs choice made the same day. The client-face privacy tradeoff was surfaced by
architect-review and the founder chose public knowingly — portfolio photos are treated as
marketing imagery.) Customers view images directly via the bucket's public URL; no signing, no
expiry. Object names are random/unique (D3) so folder contents are not enumerable by guessing.

**D2 — `image_url` column stores the object PATH, never a full URL.** (Founder-confirmed.) The DB
stores `{barberId}/{unique}.jpg`; the client derives the public URL synchronously via
`supabase.storage.from('portfolio').getPublicUrl(path)`. Storing the path (not a baked URL) keeps
the DB portable across storage domains and mirrors the verification precedent.

**D3 — Object path: `{barberId}/{unique}.jpg`**, unique per upload via the same
`uniqueObjectName(prefix)` shape as `verificationData.ts` (`{prefix}-{Date.now()}-{rand}.jpg`).
Per-barber folder is required for storage RLS to scope writes/deletes to the owner. No fixed
names (no in-place overwrite of a reviewed/other object).

**D4 — Orphan handling: accept, document, do not build cleanup.** If an upload succeeds but the
DB insert then fails (transient error, or the max-6 trigger fires on a race), the uploaded object
is orphaned in the barber's own private folder. Storage-cost-only, no security exposure — same
MVP-acceptable stance as verification. A service-role sweep is a later job (tracked).

**D5 — Delete ordering: DB row FIRST, then best-effort storage delete.** Rationale (asymmetry):
if the storage delete fails after the row is gone, the result is an invisible orphan object (D4
class). The reverse order risks a surviving DB row whose object is gone → a **broken image on a
customer-facing profile**, which is the worse failure for a premium/trust brand. So: delete the
`portfolio` row (RLS: own row); on success optimistically remove from the grid; then delete the
storage object best-effort (log + accept orphan on failure, do NOT roll back the row — the user
asked for it gone and it is gone from every read path).

**D6 — Max-6 concurrency gap: DEFER + TRACK.** `enforce_portfolio_max_six` is count-based, so two
simultaneous inserts could both pass and yield 7. A single barber tapping sequentially cannot hit
this; it needs two concurrent sessions of the same barber. Same risk class as the already-tracked
double-booking-overlap follow-up. Added to the CLAUDE.md backlog rather than built now.
`supabase-schema-architect`-owned if ever actioned.

**D7 — Storage-error mapping: EXTRACT to shared, do not duplicate.** `mapStorageError` is
currently a private helper inside `verificationData.ts`. Move it into `src/barber/errors.ts`
(alongside `mapPostgrestError` / `logBarberDataError` / `failure`), have `verificationData.ts`
import it, and `portfolioData.ts` import it too. **Regression guard:** verification's existing
behavior/tests must stay green after the extraction — this is a pure move, not a rewrite.

## Layering / boundaries (SOLID + dependency direction)

- **Data layer** (`src/barber/portfolioData.ts`) gains `uploadPortfolioImage`, `insertPortfolioRow`,
  `deletePortfolioImage`, returning discriminated-union result types in `src/barber/types.ts`
  (`UploadPortfolioImageResult` / `CreatePortfolioResult` / `DeletePortfolioImageResult`) — same
  convention as verification. `insertPortfolioRow` must map the max-6 trigger's raised exception to
  a typed `'limit_reached'` failure, not a generic `'unknown'`, so the UI can show honest copy.
- **Shared public-URL read** (`src/shared/portfolioImages.ts`, NEW): a single synchronous
  `getPublicPortfolioUrl(path: string): string` wrapping `supabase.storage.from('portfolio')
  .getPublicUrl(path).data.publicUrl`. Used by both the barber's own grid (`PortfolioScreen`) and
  the customer's `BarberProfileScreen` Portfolio tab. No network call, no expiry, no batching
  needed. Dependency direction stays one-way: screens → shared/data, never the reverse.
- **Customer read**: a `listPortfolioForBarber(barberId)` (the table's `portfolio_select_all` RLS
  already permits any authenticated caller) feeds the Portfolio tab, replacing the current
  `barber-profile-portfolio-placeholder` empty state; the 0-image empty state is preserved.

## Storage RLS shape handed to `supabase-schema-architect` (stage 3)
Public `portfolio` bucket (`public = true`), so object bytes are readable by public URL with no
auth and no expiry. On `storage.objects` for that bucket:
- **SELECT** is effectively open via the public bucket (a public bucket serves objects without an
  RLS-checked read); no restrictive SELECT policy is needed for viewing. Keep read open,
  consistent with the table's `portfolio_select_all`.
- **INSERT / DELETE → owner only**: the object's first path segment (folder) = `auth.uid()` AND
  `has_role('barber')`. Mirrors the table's `portfolio_write_own`. This is the real security
  boundary — a public bucket still must not let anyone write/delete another barber's objects.
- No UPDATE policy (uploads are unique-named, never overwritten — D3).
Note the tradeoff the founder accepted: a public bucket means the object bytes are world-readable
by URL. Enumeration is mitigated (random unique object names, D3), but any leaked/shared URL is
permanently viewable without auth.

## Pattern-compliance checklist
- [x] Reuses PORTFOLIO table / RLS / max-6 trigger unchanged (schema stays sacred).
- [x] Reuses the verification upload template (unique-name, upload-then-write ordering, PATH-not-URL).
- [x] No booking-state-machine surface touched.
- [x] Data layer has no UI imports; cross-app read helper lives in `src/shared/`.
- [x] Storage RLS mirrors the existing table RLS (consistent security boundary).
- [x] No `service_role` anywhere client-side (verified at the security gate, stage 8).

## Long-term implications
Two deferred items must not silently vanish (added to CLAUDE.md backlog): D6 concurrency hardening,
and orphan cleanup (D4/D5). Both are storage/DB-side `supabase-schema-architect` jobs. Neither
blocks MVP.

## Verdict: APPROVED — proceed to stage 3 (supabase-schema-architect: create the PUBLIC
`portfolio` bucket + the owner-only INSERT/DELETE storage RLS above), then `/supabase-schema-sync`.
