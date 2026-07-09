# Design-approval artifact — Step 11-12: customer booking flow

**Gate:** L1-1 (architect-review), CLAUDE.md orchestration pipeline
**Feature:** service already chosen on the barber profile screen → DateTime → Location → Confirm → `bookings` row created
**Status: APPROVED**, with one required schema addition beyond what was already pre-approved (see Decision 2 and the new finding under Decision 5). Everything below is final for this pipeline run unless marked "OPEN QUESTION FOR FOUNDERS."
**Downstream:** `supabase-schema-architect` (migration), `fullstack-developer` (data layer + pure slot function)

---

## 0. Pre-approved, not re-litigated here

- Price is stamped server-side by a new `BEFORE INSERT` trigger on `bookings` that looks up `services.price` by `new.service_id` and unconditionally overwrites `new.price`, mirroring `protect_barber_verification_fields`'s "silently override" pattern (migration 0005). The client's `insertBooking` must **omit `price` from the insert payload entirely** — it enters the trigger as `NULL`, gets overwritten before the `NOT NULL` check runs, so no default value is needed on the column.
- `status` is likewise omitted from the insert payload — the column's own `default 'pending'` plus `bookings_insert_customer`'s `with check (... and status = 'pending')` already guarantee this.
- 3 screens only: DateTime, Location, Confirm. No add-ons, no in-studio toggle, no payment UI.

---

## 1. Slot-derivation algorithm — pure function, no Supabase calls inside

```ts
// src/shared/slots.ts
export interface BusySlot {
  startTime: string;       // 'HH:MM:SS'
  durationMinutes: number; // from the conflicting booking's own service
}

export function deriveAvailableSlots(params: {
  windows: AvailabilityRow[];   // ALL of this barber's rows, unfiltered by date — filtering happens inside
  busy: BusySlot[];             // this barber's pending/accepted bookings for `date` only (caller pre-filters by date)
  date: string;                 // 'YYYY-MM-DD', barber's local wall-clock date (see Decision 3)
  durationMinutes: number;      // the chosen service's duration
  now?: Date;                   // defaults to `new Date()`; injectable for tests
}): string[] {                  // ascending, deduped 'HH:MM:SS' candidate start times
```

**Algorithm:**

1. **Weekday resolution.** Parse `date` as a **local** calendar date, not UTC: `const [y, m, d] = date.split('-').map(Number); const weekday = new Date(y, m - 1, d).getDay();`. Do **not** use `new Date(date)` / `new Date('YYYY-MM-DD')` — that parses as UTC midnight in JS and can shift the weekday by one day depending on the device's own timezone offset, even though this feature otherwise treats everything as naive local time (Decision 3). This is a common, easy-to-miss bug — call it out explicitly to `fullstack-developer`.

2. **Window resolution — specific_date overrides day_of_week at the whole-date level, not per-window.**
   ```
   specific = windows.filter(w => w.specific_date === date)
   applicable = specific.length > 0 ? specific : windows.filter(w => w.day_of_week === weekday)
   ```
   If the barber has entered **any** `specific_date` row for that exact date, **all** `day_of_week` rows for that weekday are ignored for that date — they are not merged. This lets a barber fully override a normal Tuesday by adding specific-date windows for one Tuesday (e.g. different hours that week). Multiple windows per day (e.g. split morning/evening shifts) are supported as long as they come from the same source (both `specific_date` or both `day_of_week`) — that is inherent to the filter above, no extra logic needed.

   **Known limitation, not solved here (schema is sacred — this is not a decision I can make unilaterally):** there is no "closed"/blackout row type. A barber cannot express "I am normally open Tuesdays via a `day_of_week` row, but this one Tuesday I am closed" — adding a `specific_date` row can only add hours, never subtract them, because `AVAILABILITY` only stores open windows. **OPEN QUESTION FOR FOUNDERS:** flag this as a fast-follow candidate (a `specific_date` row with `start_time = end_time` is rejected by `chk_availability_time_order`, so there is currently no way to model a closure at all). Not blocking Step 11-12.

3. **Candidate generation per applicable window**, back-to-back at `durationMinutes` increments, no partial slots:
   ```
   candidates = []
   for each window in applicable:
     t = window.start_time
     while (t + durationMinutes <= window.end_time):
       candidates.push(t)
       t += durationMinutes
   ```
   Union across all applicable windows, dedupe, sort ascending.

4. **Conflict subtraction.** For each candidate `c` (occupying `[c, c + durationMinutes)`), drop it if it overlaps any entry in `busy` (`[b.startTime, b.startTime + b.durationMinutes)`), using half-open interval overlap: `candidateStart < busyEnd && busyStart < candidateEnd`. `busy` must already be scoped by the caller to this barber, this date, and `status in ('pending', 'accepted')` — `rejected`/`cancelled` never block a slot, `completed` bookings are necessarily in the past and irrelevant to future-slot generation.

5. **Past-time filtering — today only.** If `date` equals the local calendar date of `now`, drop any candidate whose start time is `<= now`'s local time-of-day. For any other date (past dates should never be reachable via the date picker per Decision 4, but defensively: drop entirely) or future date, no time-of-day filtering applies.

Return the sorted, deduped `'HH:MM:SS'` list. This function takes no Supabase client and is fully unit-testable with fixed `windows`/`busy`/`now` inputs — exactly the shape `test-engineer` will need.

---

## 2. Double-booking race mitigation — DECISION: DB-level partial unique index, in the same pipeline run

**Decision: option (a).** Add:

```sql
create unique index if not exists uq_bookings_barber_slot_active
  on public.bookings (barber_id, date, time)
  where status in ('pending', 'accepted');
```

**Why, for a two-person team specifically:** an app-level pre-check-then-insert is two round trips with a real gap between them — the exact race this decision exists to close — and it is *maintenance-shaped work forever* (every future code path that can insert a booking, including any future admin tool or support script, has to remember to re-check). A partial unique index is written once, enforced by Postgres unconditionally regardless of client, and then requires zero ongoing attention — the better fit for two students who cannot manually audit every future write path. This is also the "premium, private, trustworthy" brand promise from CLAUDE.md's own positioning: a double-booked barber turning up to find the slot already taken is exactly the kind of trust failure this product cannot afford, so "cheap to build" should not win over "actually closes the gap."

**Confirmed no conflict with existing triggers:** `enforce_booking_status_transition` (migration 0003) and the freeze of `date`/`time`/`barber_id` are `BEFORE UPDATE` only — this index applies at `INSERT` (the actual gap) and is also naturally self-maintaining across the state machine on `UPDATE`: a row leaves the partial index automatically the moment `status` moves to `rejected`/`completed`/`cancelled` (freeing the slot), and stays in it through `pending → accepted` (correctly still occupying the slot). No extra trigger logic needed for that behavior — it falls out of the partial predicate.

**Bundling:** ship in the **same pipeline run** as the price trigger — either the same migration file or an immediately-following one (`supabase-schema-architect`'s call), but this must land **before Step 11-12's gate is considered passed**, not deferred. CLAUDE.md's "one feature per pipeline run" rule is about not mixing booking/chat/verification concerns in one run, not about how many schema objects one feature's migration may contain; three schema objects (price trigger, this index, and the RPC in Decision 5) that all exist solely to make booking-creation correct and safe are one feature, not three.

**Client-side implication:** the client still runs the slot-derivation algorithm above for good UX (avoid *offering* an already-taken slot in the common case), but the unique-index violation (Postgres `23505`) is the **authoritative** rejection path and must be handled distinctly, not silently retried as success. This is the opposite of the existing idempotent-insert 23505 pattern used during auth provisioning (per project memory: "23505-as-success-of-other-writer") — that pattern applies when two writes are the *same* conceptual row being created twice by the same actor's retried request. Here, two *different* customers are racing for one slot; a `23505` must surface as a real, user-facing "that time was just taken" failure. See Decision 5 for the concrete error-code addition this requires in `src/customer/errors.ts`.

---

## 3. Timezone assumption — CONFIRMED, stated explicitly for the record

All `date`/`time` values in `AVAILABILITY` and `BOOKINGS` are the **barber's local wall-clock time**. No UTC conversion happens anywhere in this feature. Device time is used **only** for the "is this candidate time in the past" filter in Decision 1 step 5, applied solely to today's date.

**Risk acknowledged:** if a barber and customer were ever in genuinely different timezones, a displayed slot could be mislabeled relative to one of their device clocks. **This is judged a non-issue for this product**: the core model is a barber physically traveling to the customer's own location, which is definitionally hyper-local (same city, same timezone, typically same metro area) — there is no remote/virtual service being booked. This is a deliberate simplifying assumption, not an oversight; revisit only if the product ever expands beyond in-person, same-city service (not currently in scope, not currently planned).

---

## 4. Slot lookahead window — DECISION: 14 days, shown continuously with per-date disabling

**Lookahead:** 14 days ahead (today + 13, inclusive), matching a realistic manual-calendar horizon for a solo barber who is very unlikely to hand-enter `specific_date` availability further out than a couple of weeks.

**Display:** show all 14 dates in a continuous strip/calendar (never hide a date outright) and **compute-and-disable** any date that yields zero candidate slots after running Decision 1's algorithm against that date's own `busy` fetch. Hiding dates would read as broken ("why isn't tomorrow even in the list") and works against the brand's "calm, minimal" positioning more than a grayed-out, clearly-disabled date does.

**Cost note (not a blocker):** computing this requires one `listBarberBusySlots` RPC call per visible date when the DateTime screen opens — up to 14 calls. This is judged acceptable at MVP scale, consistent with the precedent already set in `discoveryData.ts` (`LIST_BARBERS_LIMIT = 100`, "not real pagination — fine for MVP scale, Stage 2 architect-review decision"). If this proves slow in practice, batching `get_barber_busy_slots` to accept a date range instead of a single date is a future `database-optimizer`/schema follow-up, not something to pre-optimize now.

---

## 5. Screen structure and function signatures

**Screen structure: APPROVED as given** — DateTime → Location → Confirm. No changes.

### Critical finding not in the original question list — must be resolved before Decision 1/5 can actually work

`bookings_select_participants` (migration 0001) is:
```sql
using (customer_id = auth.uid() or barber_id = auth.uid())
```
A customer who has never booked with a given barber before is **not a participant on any of that barber's existing bookings**, so a plain `select * from bookings where barber_id = ...` from the client returns **zero rows for other customers' pending/accepted bookings** — not an error, just silently empty. That means the naive "existing-bookings-for-conflict reader" implied by the original task framing **cannot see the very conflicts it needs to see**, for exactly the customers who most need it (anyone booking this barber for the first time). Left unresolved, Decision 1 step 4 (conflict subtraction) would silently do nothing for first-time bookers, and the app would routinely *offer* slots that are actually already taken — directly undermining Decision 2's index (which would then reject them at insert time with no client-side warning first, a worse UX than intended).

**Resolution (within my authority — a narrow, additive schema object, not a redesign):** add one `SECURITY DEFINER` RPC function, in the same migration package as Decision 2's index:

```sql
create or replace function public.get_barber_busy_slots(p_barber_id uuid, p_date date)
returns table (start_time time, duration_minutes int)
language sql
security definer
set search_path = public, pg_temp
as $$
  select b.time, s.duration_minutes
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.barber_id = p_barber_id
    and b.date = p_date
    and b.status in ('pending', 'accepted');
$$;

grant execute on function public.get_barber_busy_slots(uuid, date) to authenticated;
```

This deliberately returns **only** `time` and `duration_minutes` — never `customer_id`, `location`, `price`, or any other column — so it leaks no customer-identifying or booking-content data across participants, only "this barber is busy at this time for this long," which a customer needs to see anyway to book at all. This is the same narrow, single-purpose `SECURITY DEFINER` pattern already used for `is_admin()`/`has_role()` in this codebase, applied here to a genuine cross-customer read need rather than an admin-check need. Flag to `supabase-schema-architect`: this is a third schema object for the same migration package (alongside the price trigger and the unique index), all three existing solely to make booking-creation correct — same "one feature" reasoning as Decision 2.

### Data-layer function signatures

New file `src/customer/availabilityData.ts` (does **not** reuse `src/barber/availabilityData.ts`'s `listOwnAvailability` — that one is self-scoped to the caller's own `barber_id` under `availability_write_own` semantics and is the wrong tool here; this is a new customer-facing reader leaning on the already-open `availability_select_all using (true)` policy):

```ts
/** All availability windows for the given barber, unfiltered by date — Decision 1 does the date/weekday filtering. */
export async function listBarberAvailability(barberId: string): Promise<ListBarberAvailabilityResult>
// plain select * from availability where barber_id = eq(barberId); relies on availability_select_all (RLS: using (true))

/** This barber's busy (pending/accepted) slots for one date, via the new RPC — NOT a plain `.from('bookings')` read (see finding above). */
export async function listBarberBusySlots(barberId: string, date: string): Promise<ListBusySlotsResult>
// supabase.rpc('get_barber_busy_slots', { p_barber_id: barberId, p_date: date })
```

```ts
export type ListBarberAvailabilityResult =
  | { status: 'ok'; windows: AvailabilityRow[] }
  | CustomerDataFailure;

export type ListBusySlotsResult =
  | { status: 'ok'; busy: BusySlot[] }   // BusySlot from src/shared/slots.ts
  | CustomerDataFailure;
```

New file `src/shared/slots.ts` — the pure function from Decision 1 (`deriveAvailableSlots`, `BusySlot`). Lives in `shared/` alongside `format.ts` and `threads.ts` because it has no Supabase dependency and nothing customer-specific about the math itself.

New booking-creation function, `src/customer/bookingCreateData.ts` (kept separate from the existing read-only `src/customer/bookingsData.ts`, whose own header comment explicitly says "creating bookings ... does NOT live here"):

```ts
export async function insertBooking(input: {
  barberId: string;
  serviceId: string;
  date: string;      // 'YYYY-MM-DD'
  time: string;       // 'HH:MM:SS'
  location: string;   // free text, no validation beyond non-empty (no add-ons/toggle — confirmed out of scope)
}): Promise<InsertBookingResult>
```
- `customer_id` is **not** a parameter — set internally from the current session (`(await supabase.auth.getUser()).data.user.id`), matching `bookings_insert_customer`'s `with check (customer_id = auth.uid() ...)`.
- `price` and `status` are omitted from the insert payload entirely (see Section 0).
- `.select().single()` after insert, mirroring `createAvailabilityWindow`'s pattern, so the caller gets the server-stamped `price` back immediately for the Confirm-screen receipt/success state.

```ts
export type InsertBookingResult =
  | { status: 'ok'; booking: BookingRow }
  | { status: 'conflict' }   // Postgres 23505 on uq_bookings_barber_slot_active — "someone else just took that time"
  | CustomerDataFailure;
```

**Required addition to `src/customer/errors.ts`:** extend the closed set with a `'conflict'` code, mapped from Postgres `23505` (`unique_violation`), distinct from `invalid_input`/`forbidden`, with its own calm copy (e.g. "That time was just booked by someone else. Pick another time.") so the Confirm screen can catch this specific case, send the customer back to re-pick a slot, and refresh the busy-slots fetch for that date — rather than showing the generic "something went wrong" copy. This mirrors the existing pattern of `RLS_DENIED`/`CHECK_VIOLATION` constants in that file; add `const UNIQUE_VIOLATION = '23505';` alongside them.

---

## Summary of what's now locked for `supabase-schema-architect`

One migration package, three objects, all serving booking-creation:
1. `BEFORE INSERT` price-stamping trigger on `bookings` (already pre-approved, not re-decided here).
2. `uq_bookings_barber_slot_active` partial unique index on `bookings(barber_id, date, time) where status in ('pending','accepted')`.
3. `get_barber_busy_slots(p_barber_id uuid, p_date date)` — narrow `SECURITY DEFINER` RPC, `time`/`duration_minutes` only, granted to `authenticated`.

## Summary of what's now locked for `fullstack-developer`

- `src/shared/slots.ts`: `deriveAvailableSlots` (pure, per Decision 1), `BusySlot` type.
- `src/customer/availabilityData.ts`: `listBarberAvailability`, `listBarberBusySlots`.
- `src/customer/bookingCreateData.ts`: `insertBooking`.
- `src/customer/errors.ts`: add `'conflict'` to `CustomerDataErrorCode`, map `23505` to it.
- `src/customer/types.ts`: add `ListBarberAvailabilityResult`, `ListBusySlotsResult`, `InsertBookingResult`.

## Open questions for the founders (not blocking this pipeline run)

1. No way to model a barber closure/blackout on a normally-open recurring day (Decision 1, step 2) — `AVAILABILITY` has no "closed" row type. Fast-follow candidate, not urgent at MVP scale (a solo barber can currently only add hours, not subtract them).
