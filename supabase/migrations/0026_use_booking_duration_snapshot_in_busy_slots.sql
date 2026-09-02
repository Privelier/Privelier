-- The busy-slot read path must use the same immutable duration snapshot as
-- the booking validator. Service edits must not change an existing booking's
-- occupied interval.
create or replace function public.get_barber_busy_slots(p_barber_id uuid, p_date date)
returns table (start_time time, duration_minutes int)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select b.time, b.duration_minutes
  from public.bookings b
  where b.barber_id = p_barber_id
    and b.date = p_date
    and b.status in ('pending', 'accepted');
$function$;

revoke execute on function public.get_barber_busy_slots(uuid, date) from public, anon;
grant execute on function public.get_barber_busy_slots(uuid, date) to authenticated;
