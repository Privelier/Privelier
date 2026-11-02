-- Three follow-ups from the 2026-10-11 engineering audit and the Step 17
-- review path (docs/project/ACTIVE_BACKLOG.md).
--
-- 1. F-05: bookings.date/time are the barber's local wall-clock time (D3),
--    but the slot trigger compared them with localtimestamp, which is UTC on
--    Supabase. In Germany that accepted bookings up to two hours in the past.
--    Each user now carries an IANA time zone (default Europe/Berlin, where
--    every current account lives; the app writes the device zone), and the
--    "in the future" check uses the barber's zone.
-- 2. F-09: pending requests never expire, so a request whose time has passed
--    without an answer kept counting toward the customer's cap of 5 forever.
--    The cap now counts only pending requests that are still in the future
--    (in the barber's zone). Past pending rows hold no future slot, so the
--    overlap rules need no change.
-- 3. Step 17 two-status drift: approving a barber meant hand-editing
--    barber_profile and verification_requests separately. One function now
--    writes both atomically and refuses an approval while a document is
--    missing (until now only a procedural control). Founders call it from
--    the SQL editor; no client role can execute it.

-- 1. Time zone ---------------------------------------------------------------

alter table public.users
  add column time_zone text not null default 'Europe/Berlin';

create or replace function private.validate_user_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.time_zone) then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke all on function private.validate_user_time_zone() from public, anon, authenticated;

create trigger trg_validate_user_time_zone
  before insert or update of time_zone on public.users
  for each row execute function private.validate_user_time_zone();

grant insert (time_zone), update (time_zone) on public.users to authenticated;

create or replace function private.local_now(p_user_id uuid)
returns timestamp
language sql
stable
set search_path = ''
as $$
  select now() at time zone coalesce(
    (select u.time_zone from public.users u where u.id = p_user_id),
    'Europe/Berlin')
$$;

revoke all on function private.local_now(uuid) from public, anon, authenticated;

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

  if booking_start <= private.local_now(new.barber_id) then
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

-- 2. Pending cap counts only requests that are still ahead -------------------

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
     and b.status = 'pending'
     and b.date + b.time > private.local_now(b.barber_id);
  if v_total >= 5 or v_same_barber >= 2 then
    raise exception 'too many open booking requests' using errcode = 'PA004';
  end if;
  return new;
end;
$function$;

revoke execute on function public.enforce_pending_booking_cap() from public, anon, authenticated;

-- 3. One review path for verification ----------------------------------------

create or replace function private.review_barber_verification(
  p_barber_id uuid,
  p_decision public.verification_status_type,
  p_reviewer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.verification_requests%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;

  select * into v_request
    from public.verification_requests r
   where r.user_id = p_barber_id
   for update;
  if not found then
    raise exception 'no verification request for this barber' using errcode = 'P0002';
  end if;
  if p_decision = 'approved'
     and (v_request.id_image_url is null or v_request.license_image_url is null) then
    raise exception 'both documents are required before approval' using errcode = '22023';
  end if;

  -- The protect/freeze/requeue triggers let only service_role change these
  -- columns; act as service_role for this transaction only.
  perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
  perform pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);

  update public.barber_profile bp
     set verification_status = p_decision,
         verified = (p_decision = 'approved')
   where bp.user_id = p_barber_id;

  update public.verification_requests r
     set status = p_decision,
         reviewed_by = p_reviewer_id,
         reviewed_at = now()
   where r.id = v_request.id;

  perform pg_catalog.set_config('request.jwt.claim.role', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '', true);
end;
$function$;

revoke all on function private.review_barber_verification(uuid, public.verification_status_type, uuid)
  from public, anon, authenticated, service_role;
