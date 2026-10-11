-- Wave 3: barber days off (vacation, a closed day) without deleting the
-- recurring weekly availability. Enforced in the database, not just the UI.
--
-- barber_days_off: one row per closed date. Barbers manage their own;
-- customers can read the rows of approved barbers (same visibility as
-- availability) so the booking calendar can grey those dates out.
-- validate_booking_slot() (0024/0025) is re-created unchanged except for one
-- added rule: a booking on a day off is refused (SQLSTATE PA003).

create table public.barber_days_off (
  barber_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (barber_id, day)
);

alter table public.barber_days_off enable row level security;
revoke all on public.barber_days_off from public, anon, authenticated;
grant select, insert, delete on public.barber_days_off to authenticated;

create policy barber_days_off_select_own_or_approved on public.barber_days_off
  for select to authenticated
  using (
    barber_id = (select auth.uid())
    or exists (
      select 1 from public.barber_profile bp
      where bp.user_id = barber_days_off.barber_id
        and bp.verification_status = 'approved'::public.verification_status_type
    )
  );
create policy barber_days_off_insert_own on public.barber_days_off
  for insert to authenticated
  with check (barber_id = (select auth.uid()) and public.has_role('barber'));
create policy barber_days_off_delete_own on public.barber_days_off
  for delete to authenticated
  using (barber_id = (select auth.uid()));

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

  if exists (
    select 1 from public.barber_days_off d
    where d.barber_id = new.barber_id and d.day = new.date
  ) then
    raise exception 'The barber is not working on this date' using errcode = 'PA003';
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
