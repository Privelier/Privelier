-- Travel time between a barber's appointments (founder decision F15,
-- 2026-10-27): every active booking keeps the barber free for 30 minutes
-- after it ends. A 10:00-11:00 booking therefore blocks requests that start
-- before 11:30 and requests that would end after 09:30 (the gap applies in
-- both directions because each booking carries its own trailing buffer).
--
-- Enforced in three places that share the same rule:
-- 1. the exclusion constraint (authoritative, race-free; supersedes the
--    plain-range constraint from 0054);
-- 2. trg_validate_booking_slot, which raises the friendly overlap message
--    the app maps to "pick another time";
-- 3. the busy-slot reads, which now return each booking padded by the buffer
--    on both sides, so the slot picker never offers a time the server would
--    refuse. The client needs no change.

create or replace function private.travel_buffer()
returns interval
language sql
immutable
parallel safe
set search_path = ''
as $$ select interval '30 minutes' $$;

revoke all on function private.travel_buffer() from public, anon, authenticated;

-- 1. Constraint: compare each booking's [start, end + buffer).
alter table public.bookings drop constraint bookings_no_overlapping_active_slot;
alter table public.bookings
  add constraint bookings_no_overlapping_active_slot
  exclude using gist (
    barber_id with =,
    tsrange(lower(slot), upper(slot) + interval '30 minutes', '[)') with &&
  )
  where (status in ('pending', 'accepted'));

-- 2. Trigger: same rule, across midnight too.
create or replace function public.validate_booking_slot()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  booking_start timestamp;
  booking_end timestamp;
  booking_weekday smallint;
  has_specific_date boolean;
begin
  booking_start := new.date + new.time;
  booking_end := booking_start + make_interval(mins => new.duration_minutes);
  booking_weekday := extract(dow from new.date)::smallint;

  if booking_start <= localtimestamp then
    raise exception 'Booking date and time must be in the future';
  end if;

  if exists (
    select 1 from public.barber_days_off d
    where d.barber_id = new.barber_id and d.day = new.date
  ) then
    raise exception 'The barber is not working on this date' using errcode = 'PA003';
  end if;

  select exists (
    select 1 from public.availability a
    where a.barber_id = new.barber_id and a.specific_date = new.date
  ) into has_specific_date;

  if not exists (
    select 1 from public.availability a
    where a.barber_id = new.barber_id
      and ((has_specific_date and a.specific_date = new.date)
        or (not has_specific_date and a.day_of_week = booking_weekday))
      and booking_start >= new.date + a.start_time
      and booking_end <= new.date + a.end_time
  ) then
    raise exception 'Booking time is outside the barber''s active availability';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.barber_id::text || ':' || new.date::text, 0));

  if exists (
    select 1 from public.bookings b
    where b.barber_id = new.barber_id
      and b.date between new.date - 1 and new.date + 1
      and b.status in ('pending', 'accepted')
      and b.id is distinct from new.id
      and booking_start < (b.date + b.time) + make_interval(mins => b.duration_minutes) + private.travel_buffer()
      and (b.date + b.time) < booking_end + private.travel_buffer()
  ) then
    raise exception 'Booking overlaps an existing active booking';
  end if;

  return new;
end;
$function$;

-- 3. Busy reads: each booking padded by the buffer on both sides, clipped to
--    the requested days (a late booking can block the next morning).
create or replace function public.get_barber_busy_slots_range(p_barber_id uuid, p_from date, p_to date)
returns table(busy_date date, start_time time without time zone, duration_minutes integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with bounds as (
    select p_from as first_day, least(p_to, p_from + 30) as last_day
  ),
  padded as (
    select (b.date + b.time) - private.travel_buffer() as busy_from,
           (b.date + b.time) + make_interval(mins => b.duration_minutes) + private.travel_buffer() as busy_to
    from public.bookings b, bounds
    where b.barber_id = p_barber_id
      and b.status in ('pending', 'accepted')
      and b.date between bounds.first_day - 1 and bounds.last_day + 1
  ),
  days as (
    select d::date as day
    from bounds, generate_series(bounds.first_day, bounds.last_day, interval '1 day') d
  )
  select days.day,
         greatest(p.busy_from, days.day::timestamp)::time,
         (extract(epoch from least(p.busy_to, (days.day + 1)::timestamp) - greatest(p.busy_from, days.day::timestamp)) / 60)::integer
  from padded p
  join days on p.busy_from < (days.day + 1)::timestamp and p.busy_to > days.day::timestamp
  order by 1, 2;
$function$;

create or replace function public.get_barber_busy_slots(p_barber_id uuid, p_date date)
returns table(start_time time without time zone, duration_minutes integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select r.start_time, r.duration_minutes
  from public.get_barber_busy_slots_range(p_barber_id, p_date, p_date) r;
$function$;
