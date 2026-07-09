-- Security fix (flagged by /security-audit against migration 0009): the
-- BEFORE INSERT trigger function stamp_booking_price_from_service()
-- resolved new.service_id against public.services without also checking
-- that the resolved row's barber_id matches new.barber_id. Because
-- services_select_all (0001) is `using (true)` — any authenticated user
-- can read any barber's services — a raw PostgREST insert bypassing the
-- app UI could pair a real, approved barber_id with a DIFFERENT barber's
-- real service_id. bookings_insert_customer (0004) never validates the
-- service/barber pairing either, so nothing else in the stack catches
-- this: the trigger would happily stamp the unrelated service's price
-- and attach the booking to a service the target barber never listed —
-- a price/attribution manipulation vector.
--
-- Fix: resolve the service by BOTH id = new.service_id AND
-- barber_id = new.barber_id in the same query. A service_id/barber_id
-- mismatch now simply fails to resolve (not found), falling into the
-- exact same "raise exception" path already used for a nonexistent
-- service_id — no new branch, no behavior change for any legitimate
-- caller who passes a service that actually belongs to the barber being
-- booked. Same function name/signature (create or replace), same
-- trigger, same SECURITY DEFINER + pinned search_path, same revoked
-- direct-EXECUTE posture as 0009 — this is a WHERE-clause fix only.

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
  where id = new.service_id
    and barber_id = new.barber_id;

  if not found then
    raise exception 'stamp_booking_price_from_service: service % does not belong to barber %', new.service_id, new.barber_id;
  end if;

  new.price := service_price;
  return new;
end;
$function$;

revoke execute on function public.stamp_booking_price_from_service() from public, anon, authenticated;
