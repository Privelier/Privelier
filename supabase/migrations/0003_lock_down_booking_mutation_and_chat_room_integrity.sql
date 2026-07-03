-- Fix 1: bookings UPDATE currently only guards the `status` column transition.
-- The RLS policy `bookings_update_participants` lets either participant update
-- the row, so without this, a customer or barber could rewrite `price` after
-- the fact (price must be an immutable snapshot per product spec), silently
-- change `date`/`time`/`location` post-acceptance, or reassign the booking to
-- a different `customer_id`/`barber_id` entirely. Only `status` (and only
-- along the defined state machine) may change once a booking exists.
create or replace function public.enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
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

  if new.status = old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'rejected') then
    return new;
  end if;

  if old.status = 'accepted' and new.status in ('completed', 'cancelled') then
    return new;
  end if;

  raise exception 'Invalid booking status transition: % -> %', old.status, new.status;
end;
$function$;

-- Fix 2: chat_rooms_insert_participants only checked that the inserting user
-- was named as customer_id or barber_id on the new row -- it never checked
-- that booking_id actually referred to a booking involving those two people.
-- That let a participant of one booking attach a chat_rooms row to a
-- different booking_id with an arbitrary counterparty, and squat the (unique)
-- booking_id slot before the legitimate chat room was created.
alter policy chat_rooms_insert_participants on public.chat_rooms
with check (
  (customer_id = auth.uid() or barber_id = auth.uid())
  and exists (
    select 1
    from public.bookings b
    where b.id = chat_rooms.booking_id
      and b.customer_id = chat_rooms.customer_id
      and b.barber_id = chat_rooms.barber_id
  )
);
