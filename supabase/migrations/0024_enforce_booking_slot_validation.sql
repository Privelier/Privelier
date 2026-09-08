-- Booking validation hardening.
--
-- This migration is additive. It preserves the booking status enum, the
-- actor-aware transition trigger, and every existing RLS policy.

-- Store the service duration at booking time. Existing rows are backfilled
-- before the column becomes mandatory; this keeps the snapshot independent
-- from later service edits.
alter table public.bookings
  add column if not exists duration_minutes integer;

update public.bookings b
set duration_minutes = s.duration_minutes
from public.services s
where s.id = b.service_id
  and b.duration_minutes is null;

do $$
begin
  if exists (select 1 from public.bookings where duration_minutes is null) then
    raise exception 'Cannot enforce booking duration snapshot: existing booking has no matching service';
  end if;
end $$;

alter table public.bookings
  alter column duration_minutes set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_bookings_duration_minutes'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint chk_bookings_duration_minutes
      check (duration_minutes > 0);
  end if;
end $$;

create index if not exists idx_bookings_barber_date_active
  on public.bookings (barber_id, date, status)
  where status in ('pending', 'accepted');

create index if not exists idx_availability_barber_date_window
  on public.availability (barber_id, specific_date, day_of_week, start_time, end_time);

-- Extend the existing trusted snapshot trigger. The client still omits both
-- snapshot fields; the selected service is the sole source of truth.
create or replace function public.stamp_booking_price_from_service()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  service_price numeric(10, 2);
  service_duration integer;
begin
  select s.price, s.duration_minutes
  into service_price, service_duration
  from public.services s
  where s.id = new.service_id
    and s.barber_id = new.barber_id;

  if not found then
    raise exception 'stamp_booking_price_from_service: service % does not belong to barber %', new.service_id, new.barber_id;
  end if;

  new.price := service_price;
  new.duration_minutes := service_duration;
  return new;
end;
$function$;

revoke execute on function public.stamp_booking_price_from_service() from public, anon, authenticated;

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
  booking_weekday := extract(isodow from new.date)::smallint - 1;

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

  -- Serialize competing writes for one barber/date. A plain EXISTS check is
  -- not sufficient under MVCC because two concurrent inserts can otherwise
  -- both miss the other uncommitted row.
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

drop trigger if exists trg_validate_booking_slot on public.bookings;
create trigger trg_validate_booking_slot
  before insert or update of barber_id, service_id, date, time, duration_minutes
  on public.bookings
  for each row execute function public.validate_booking_slot();

revoke execute on function public.validate_booking_slot() from public, anon, authenticated;

-- Extend the existing booking immutability freeze to the new snapshot. The
-- state machine and actor checks below are intentionally unchanged.
create or replace function public.enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    if new.price is distinct from old.price
      or new.duration_minutes is distinct from old.duration_minutes
      or new.service_id is distinct from old.service_id
      or new.date is distinct from old.date
      or new.time is distinct from old.time
      or new.location is distinct from old.location
      or new.customer_id is distinct from old.customer_id
      or new.barber_id is distinct from old.barber_id
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Only booking status may be changed once a booking is created';
    end if;
  end if;

  if new.status = old.status then
    return new;
  end if;

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
