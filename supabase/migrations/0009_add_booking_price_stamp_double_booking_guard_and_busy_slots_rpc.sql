-- Step 11-12 (customer booking flow) — schema package approved in
-- docs/design/step-11-12-booking-flow-design-approval.md. Three objects,
-- all serving booking-creation correctness/safety; treated as one feature
-- per CLAUDE.md's "one feature per pipeline run" rule (see that doc's
-- Decision 2 "Bundling" note for the explicit reasoning). No table, RLS
-- policy, grant, or column beyond what's listed below is touched.

-- ============================================================
-- 1. Price snapshot — BEFORE INSERT trigger on bookings.
--
-- bookings.price is documented (CLAUDE.md) as "a snapshot of the service
-- price at the moment of booking — never read live from SERVICES", but
-- until now that was a convention only, not DB-enforced: the column is a
-- plain `numeric(10,2) check (price >= 0)` with no default sourced from
-- services, so a malicious or buggy authenticated client could insert an
-- arbitrary price. The client's insert payload omits `price` entirely (see
-- design doc Section 0), so it arrives as NULL and this unconditionally
-- overwrites it before the NOT NULL check runs — silent-override, not
-- reject, mirroring protect_barber_verification_fields's (0001/0005)
-- established "a trusted server-side value always wins over client input"
-- pattern, though that one is BEFORE UPDATE and this is BEFORE INSERT.
--
-- If new.service_id doesn't resolve to a real services row (shouldn't
-- happen given the app always passes a real service_id, but defensive),
-- raise rather than insert a booking with a null/garbage price.
--
-- SECURITY DEFINER + pinned search_path so this guarantee holds regardless
-- of the caller's own SELECT privileges on services — defense in depth:
-- today's bookings_insert_customer policy (0004) already implies the
-- barber is approved and thus the service is visible via
-- services_select_own_or_approved's approved branch (0007), but this
-- trigger's correctness should not depend on that policy never changing.
-- ============================================================

create or replace function public.stamp_booking_price_from_service()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  service_price numeric(10, 2);
begin
  select price into service_price
  from public.services
  where id = new.service_id;

  if not found then
    raise exception 'stamp_booking_price_from_service: service % does not exist', new.service_id;
  end if;

  new.price := service_price;
  return new;
end;
$function$;

drop trigger if exists trg_stamp_booking_price_from_service on public.bookings;
create trigger trg_stamp_booking_price_from_service
  before insert on public.bookings
  for each row execute function public.stamp_booking_price_from_service();

-- Trigger-only function, never meant to be called directly via the
-- PostgREST RPC endpoint; revoking EXECUTE does not affect trigger firing
-- (same rationale as 0002/0005).
revoke execute on function public.stamp_booking_price_from_service() from public, anon, authenticated;

-- ============================================================
-- 2. Double-booking prevention — partial unique index.
--
-- enforce_booking_status_transition (0001/0003) and the column-freeze it
-- performs are BEFORE UPDATE only — nothing at INSERT time previously
-- stopped two different customers from creating two 'pending' bookings for
-- the same barber/date/time. This index is self-maintaining across the
-- state machine: a row leaves the partial index the instant status moves
-- to rejected/completed/cancelled (freeing the slot), and stays in it
-- through pending -> accepted (correctly still occupying the slot) — no
-- extra trigger logic needed, it falls out of the partial predicate.
--
-- A Postgres 23505 on this index is the authoritative double-booking
-- rejection path; the client-side slot-derivation algorithm (design doc
-- Section 1) is a UX nicety on top, not a substitute for this.
-- ============================================================

create unique index if not exists uq_bookings_barber_slot_active
  on public.bookings (barber_id, date, time)
  where status in ('pending', 'accepted');

-- ============================================================
-- 3. get_barber_busy_slots — narrow SECURITY DEFINER RPC.
--
-- bookings_select_participants (0001) is `customer_id = auth.uid() or
-- barber_id = auth.uid()` only — a customer booking a given barber for the
-- first time is not a participant on any of that barber's OTHER
-- customers' pending/accepted bookings, so a plain select silently returns
-- zero rows for exactly the customers who most need to see the conflict.
-- This RPC closes that gap without loosening bookings_select_participants
-- itself.
--
-- Deliberately returns ONLY time + duration_minutes — never customer_id,
-- location, price, or any other column — so it can only ever leak "this
-- barber is busy at this time for this long," never any other customer's
-- booking content. Same SECURITY DEFINER + pinned search_path + minimal-
-- surface pattern already established for is_admin() (0001) / has_role()
-- (0004), applied here to a genuine cross-customer read need rather than
-- an admin-check need.
-- ============================================================

create or replace function public.get_barber_busy_slots(p_barber_id uuid, p_date date)
returns table (start_time time, duration_minutes int)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select b.time, s.duration_minutes
  from public.bookings b
  join public.services s on s.id = b.service_id
  where b.barber_id = p_barber_id
    and b.date = p_date
    and b.status in ('pending', 'accepted');
$function$;

-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default at function
-- creation time; revoke it and grant only to authenticated, same pattern
-- 0006 applied to is_admin()/has_role() (anon has no schema usage at all
-- as of 0006, but this keeps the function-level grant honest on its own,
-- independent of that schema-level revoke ever being loosened later).
revoke execute on function public.get_barber_busy_slots(uuid, date) from public, anon;
grant execute on function public.get_barber_busy_slots(uuid, date) to authenticated;
