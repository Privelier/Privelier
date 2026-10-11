-- One read for the booking lookahead instead of one get_barber_busy_slots
-- call per date (founder speed rule, 2026-10-11). Same projection and the
-- same security posture as get_barber_busy_slots (0009/0026): SECURITY
-- DEFINER so a customer sees other customers' occupied intervals, but only
-- (date, start_time, duration_minutes) for pending/accepted bookings — no
-- customer identity, location, price or ids. The range is capped at 31 days
-- so the function cannot be used to scan a barber's whole history.

create or replace function public.get_barber_busy_slots_range(
  p_barber_id uuid,
  p_from date,
  p_to date
)
returns table (busy_date date, start_time time, duration_minutes int)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select b.date, b.time, b.duration_minutes
  from public.bookings b
  where b.barber_id = p_barber_id
    and b.date >= p_from
    and b.date <= least(p_to, p_from + 30)
    and b.status in ('pending', 'accepted')
  order by b.date, b.time;
$function$;

revoke execute on function public.get_barber_busy_slots_range(uuid, date, date) from public, anon;
grant execute on function public.get_barber_busy_slots_range(uuid, date, date) to authenticated;
