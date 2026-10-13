-- Abuse guard: pending requests hold a barber's slot (busy-slot RPCs and the
-- overlap check include 'pending') and never expire, so one account could
-- fill every open slot of every barber. Cap open requests per customer:
--   - at most 5 pending bookings in total
--   - at most 2 pending bookings with the same barber
-- Accepted, completed, rejected and cancelled bookings do not count.
-- A per-customer transaction advisory lock makes the count race-free when
-- the same customer submits concurrently. SQLSTATE PA004 for the client.
create or replace function public.enforce_pending_booking_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_total int;
  v_same_barber int;
begin
  if new.status <> 'pending' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('pending_cap:' || new.customer_id::text, 0));
  select count(*), count(*) filter (where b.barber_id = new.barber_id)
    into v_total, v_same_barber
    from public.bookings b
   where b.customer_id = new.customer_id
     and b.status = 'pending';
  if v_total >= 5 or v_same_barber >= 2 then
    raise exception 'too many open booking requests' using errcode = 'PA004';
  end if;
  return new;
end;
$function$;

revoke execute on function public.enforce_pending_booking_cap() from public, anon, authenticated;

create trigger bookings_enforce_pending_cap
  before insert on public.bookings
  for each row execute function public.enforce_pending_booking_cap();
