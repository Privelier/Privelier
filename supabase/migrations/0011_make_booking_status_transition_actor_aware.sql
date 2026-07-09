-- Step 13-14 (barber requests & realtime status) — make the booking-status
-- transition trigger ACTOR-AWARE. Additive: this is a CREATE OR REPLACE of the
-- function first defined in 0001 and last replaced in 0003. The existing
-- BEFORE UPDATE binding `trg_enforce_booking_status_transition` on
-- public.bookings is left untouched and keeps pointing at this function by
-- name — CREATE OR REPLACE FUNCTION swaps the body in place, the trigger is
-- not re-created here.
--
-- Prior to this migration the trigger enforced the transition SHAPE
-- (pending -> accepted|rejected, accepted -> completed|cancelled) and the
-- column-immutability freeze, but it was ACTOR-BLIND. RLS
-- `bookings_update_participants` (0001) lets EITHER participant UPDATE the row,
-- so nothing stopped a customer from self-"accepting" or self-"completing" a
-- booking, or a barber from performing transitions reserved for the customer.
-- This migration adds the missing actor gate; it does NOT loosen or re-create
-- any RLS policy.
--
-- Why comparing against OLD.* is safe: the immutability freeze below
-- guarantees, for every non-service_role caller, that NEW.barber_id /
-- NEW.customer_id equal OLD.barber_id / OLD.customer_id. OLD therefore holds
-- the true, unforgeable participant ids to authorize against.
--
-- Actor matrix enforced for non-service_role callers:
--   pending  -> accepted   : barber only     (auth.uid() = old.barber_id)
--   pending  -> rejected   : barber only     (auth.uid() = old.barber_id)
--   pending  -> cancelled  : customer only   (auth.uid() = old.customer_id)   [NEW transition, founder-approved 2026-07-09]
--   accepted -> completed  : barber only     (auth.uid() = old.barber_id)
--   accepted -> cancelled  : either participant (auth.uid() in barber_id, customer_id)
--
-- service_role bypass kept fully intact: every actor RAISE below is gated by
-- `auth.role() is distinct from 'service_role'`, so the server-owned status
-- progression (and the rating-aggregation path, which writes
-- barber_profile.rating rather than booking.status — booking_status_type has
-- no 'rated'/'archived' label) is authorized exactly as before. No actor check
-- is added outside the non-service_role guard.
create or replace function public.enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  -- Column-immutability freeze (unchanged from 0003): only `status` may move,
  -- and only for non-service_role callers. Guarantees OLD.barber_id /
  -- OLD.customer_id are trustworthy actors for the checks below.
  if auth.role() is distinct from 'service_role' then
    if new.price is distinct from old.price
      or new.service_id is distinct from old.service_id
      or new.date is distinct from old.date
      or new.time is distinct from old.time
      or new.location is distinct from old.location
      or new.customer_id is distinct from old.customer_id
      or new.barber_id is distinct from old.barber_id
    then
      raise exception 'Only booking status may be changed once a booking is created';
    end if;
  end if;

  -- Same-status write (e.g. a re-save that changes nothing): no state-machine
  -- transition to authorize. Shared by all callers, as before.
  if new.status = old.status then
    return new;
  end if;

  -- Transition SHAPE + actor matrix. Each actor RAISE is gated to
  -- non-service_role so the service_role path remains bounded only by the
  -- transition shape, exactly as it was before this migration.
  if old.status = 'pending' and new.status = 'accepted' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.barber_id then
      raise exception 'Only the barber may accept a booking';
    end if;
    return new;
  end if;

  if old.status = 'pending' and new.status = 'rejected' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.barber_id then
      raise exception 'Only the barber may reject a booking';
    end if;
    return new;
  end if;

  -- NEW founder-approved transition (2026-07-09): a customer may cancel their
  -- own booking while it is still pending. This shape did not exist in 0003.
  if old.status = 'pending' and new.status = 'cancelled' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.customer_id then
      raise exception 'Only the customer may cancel a pending booking';
    end if;
    return new;
  end if;

  if old.status = 'accepted' and new.status = 'completed' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.barber_id then
      raise exception 'Only the barber may complete a booking';
    end if;
    return new;
  end if;

  if old.status = 'accepted' and new.status = 'cancelled' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.barber_id
       and auth.uid() is distinct from old.customer_id then
      raise exception 'Only a booking participant may cancel an accepted booking';
    end if;
    return new;
  end if;

  raise exception 'Invalid booking status transition: % -> %', old.status, new.status;
end;
$function$;
