-- Correct the recurring-availability weekday mapping used by 0024.
-- AVAILABILITY follows JavaScript/Postgres DOW: Sunday = 0 ... Saturday = 6.
create or replace function public.validate_booking_slot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

  select exists (
    select 1
    from public.availability a
    where a.barber_id = new.barber_id
      and a.specific_date = new.date
  ) into has_specific_date;

  if not exists (
    select 1
    from public.availability a
    where a.barber_id = new.barber_id
      and (
        (has_specific_date and a.specific_date = new.date)
        or (not has_specific_date and a.day_of_week = booking_weekday)
      )
      and booking_start >= new.date + a.start_time
      and booking_end <= new.date + a.end_time
  ) then
    raise exception 'Booking time is outside the barber''s active availability';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.barber_id::text || ':' || new.date::text, 0)
  );

  if exists (
    select 1
    from public.bookings b
    where b.barber_id = new.barber_id
      and b.date = new.date
      and b.status in ('pending', 'accepted')
      and b.id is distinct from new.id
      and booking_start < (b.date + b.time) + make_interval(mins => b.duration_minutes)
      and (b.date + b.time) < booking_end
  ) then
    raise exception 'Booking overlaps an existing active booking';
  end if;

  return new;
end;
$function$;

revoke execute on function public.validate_booking_slot() from public, anon, authenticated;
