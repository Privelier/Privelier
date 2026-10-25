-- Live trip tracking, push delivery and trip safety (founder decision by Ali,
-- 2026-10-25: build "On my way" tracking, booking address coordinates, SOS /
-- share-trip, and push notifications; maps move to free MapLibre/OpenFreeMap
-- with routing on free OSRM/Valhalla servers -- no paid map API anywhere).
--
-- WHAT THIS ADDS
--
--  1. bookings.location_latitude/longitude -- the customer's destination,
--     geocoded by the customer app from the street + city they typed. Both
--     NULL (geocode failed / legacy rows) or both valid. Frozen after insert
--     exactly like location itself (0003): a participant can never move the
--     pin a barber is driving to.
--
--  2. public.booking_trips -- ONE row per booking holding only the LATEST
--     barber position while the barber is en route. Privacy model:
--       - no breadcrumb history is ever stored (each fix overwrites the last);
--       - readable only by the booking's two participants (RLS);
--       - writable only through the SECURITY DEFINER RPCs below, by the
--         booking's barber, only while the booking is accepted and dated
--         within a day of today (no tracking for a booking weeks away);
--       - when the trip ends -- barber stops sharing, or the booking is
--         completed/cancelled -- every coordinate and the route are wiped.
--
--  3. Trip notifications in the existing feed: trip_started,
--     trip_arriving (fired once, server-side, when the barber's reported
--     ETA drops to 5 minutes or the remaining route to 800 m), trip_arrived.
--
--  4. public.safety_events -- an append-only SOS log for the founders. The
--     device itself dials the emergency number; this row is the audit trail.
--     Deliberately NOT forwarded to the other participant (if a barber feels
--     unsafe at a customer's home, alerting that customer is the worst
--     possible behavior).
--
--  5. public.push_tokens + an AFTER INSERT trigger on notifications that
--     hands every new notification to the free Expo push service via pg_net
--     (asynchronous: a push outage can never roll back the notification or
--     the booking/message write that created it). Lock-screen copy never
--     contains message text or addresses.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 1. Destination coordinates on bookings
-- ---------------------------------------------------------------------------

alter table public.bookings
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision;

alter table public.bookings drop constraint if exists bookings_location_coords_pair;
alter table public.bookings add constraint bookings_location_coords_pair
  check ((location_latitude is null) = (location_longitude is null));
alter table public.bookings drop constraint if exists bookings_location_coords_range;
alter table public.bookings add constraint bookings_location_coords_range
  check (
    location_latitude is null
    or (location_latitude between -90 and 90 and location_longitude between -180 and 180)
  );

create or replace function public.freeze_booking_location_coords()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if auth.role() is distinct from 'service_role'
    and (new.location_latitude is distinct from old.location_latitude
      or new.location_longitude is distinct from old.location_longitude)
  then
    raise exception 'Booking location coordinates cannot change once a booking is created';
  end if;
  return new;
end;
$function$;
revoke all on function public.freeze_booking_location_coords() from public, anon, authenticated;

drop trigger if exists trg_freeze_booking_location_coords on public.bookings;
create trigger trg_freeze_booking_location_coords
  before update on public.bookings
  for each row execute function public.freeze_booking_location_coords();

-- ---------------------------------------------------------------------------
-- 2. Trips
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'trip_status_type') then
    create type public.trip_status_type as enum ('en_route', 'arrived', 'ended');
  end if;
end;
$$;

create table if not exists public.booking_trips (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  barber_id uuid not null references public.users(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  status public.trip_status_type not null default 'en_route',
  dest_latitude double precision,
  dest_longitude double precision,
  latitude double precision,
  longitude double precision,
  heading real,
  speed_mps real,
  accuracy_m real,
  position_at timestamptz,
  remaining_distance_m integer,
  eta_at timestamptz,
  -- Encoded polyline (precision 6) of the current road route, so the
  -- customer app draws the same line without calling a router itself.
  route_polyline text,
  route_source text,
  started_at timestamptz not null default now(),
  arriving_notified_at timestamptz,
  arrived_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint booking_trips_position_pair check ((latitude is null) = (longitude is null)),
  constraint booking_trips_dest_pair check ((dest_latitude is null) = (dest_longitude is null)),
  constraint booking_trips_position_range check (
    latitude is null or (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint booking_trips_dest_range check (
    dest_latitude is null or (dest_latitude between -90 and 90 and dest_longitude between -180 and 180)
  ),
  constraint booking_trips_route_size check (route_polyline is null or char_length(route_polyline) <= 20000),
  constraint booking_trips_route_source check (route_source is null or route_source in ('osrm', 'valhalla', 'estimate')),
  constraint booking_trips_ended_is_wiped check (
    status <> 'ended' or (latitude is null and route_polyline is null and dest_latitude is null)
  )
);

create index if not exists booking_trips_customer_idx on public.booking_trips (customer_id);
create index if not exists booking_trips_barber_idx on public.booking_trips (barber_id);

alter table public.booking_trips enable row level security;
revoke all on public.booking_trips from public, anon, authenticated;
grant select on public.booking_trips to authenticated;
grant all on public.booking_trips to service_role;

drop policy if exists booking_trips_select_participants on public.booking_trips;
create policy booking_trips_select_participants
  on public.booking_trips for select to authenticated
  using (customer_id = (select auth.uid()) or barber_id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booking_trips'
  ) then
    alter publication supabase_realtime add table public.booking_trips;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Notification types for trips
-- ---------------------------------------------------------------------------

do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
     where conrelid = 'public.notifications'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%event_type%'
  loop
    execute format('alter table public.notifications drop constraint %I', v_name);
  end loop;
end;
$$;

alter table public.notifications add constraint notifications_event_type_check
  check (event_type in ('message', 'new_request', 'booking_status', 'trip_started', 'trip_arriving', 'trip_arrived'));
alter table public.notifications add constraint notifications_message_shape check (
  (event_type = 'message' and message_id is not null and booking_status is null)
  or (event_type in ('new_request', 'trip_started', 'trip_arriving', 'trip_arrived')
      and message_id is null and booking_status is null)
  or (event_type = 'booking_status' and message_id is null and booking_status is not null)
);

create or replace function public.insert_trip_notification(
  p_trip public.booking_trips,
  p_event text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $function$
  insert into public.notifications (recipient_id, event_type, booking_id, actor_id, event_key)
  values (
    p_trip.customer_id, p_event, p_trip.booking_id, p_trip.barber_id,
    'trip:' || p_trip.booking_id::text || ':' || p_event || ':'
      || extract(epoch from p_trip.started_at)::bigint::text
  )
  on conflict (event_key) do nothing;
$function$;
revoke all on function public.insert_trip_notification(public.booking_trips, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Trip RPCs (the only write path)
-- ---------------------------------------------------------------------------

-- Shared guard: the caller is this booking's barber, the booking is
-- accepted, and it is dated within one day of today (UTC +/- 1 day absorbs
-- every real time zone without knowing the user's).
create or replace function public.assert_trip_allowed(p_booking_id uuid)
returns public.bookings
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null or v_booking.barber_id is distinct from auth.uid() then
    raise exception 'Trip not allowed for this booking' using errcode = 'PT001';
  end if;
  if v_booking.status <> 'accepted' then
    raise exception 'Trips are only possible for accepted bookings' using errcode = 'PT002';
  end if;
  if v_booking.date not between current_date - 1 and current_date + 1 then
    raise exception 'Trips can only start on the day of the appointment' using errcode = 'PT003';
  end if;
  return v_booking;
end;
$function$;
revoke all on function public.assert_trip_allowed(uuid) from public, anon, authenticated;

create or replace function public.start_trip(
  p_booking_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_dest_latitude double precision default null,
  p_dest_longitude double precision default null,
  p_route_polyline text default null,
  p_route_source text default null,
  p_remaining_distance_m integer default null,
  p_eta_seconds integer default null
)
returns public.booking_trips
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_booking public.bookings := public.assert_trip_allowed(p_booking_id);
  v_trip public.booking_trips;
begin
  insert into public.booking_trips as t (
    booking_id, barber_id, customer_id, status,
    dest_latitude, dest_longitude, latitude, longitude, position_at,
    route_polyline, route_source, remaining_distance_m, eta_at,
    started_at, arriving_notified_at, arrived_at, ended_at, updated_at
  ) values (
    v_booking.id, v_booking.barber_id, v_booking.customer_id, 'en_route',
    coalesce(v_booking.location_latitude, p_dest_latitude),
    coalesce(v_booking.location_longitude, p_dest_longitude),
    p_latitude, p_longitude, now(),
    p_route_polyline, p_route_source, greatest(p_remaining_distance_m, 0),
    case when p_eta_seconds is null then null else now() + make_interval(secs => greatest(p_eta_seconds, 0)) end,
    now(), null, null, null, now()
  )
  on conflict (booking_id) do update set
    status = 'en_route',
    dest_latitude = excluded.dest_latitude,
    dest_longitude = excluded.dest_longitude,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    heading = null,
    speed_mps = null,
    accuracy_m = null,
    position_at = excluded.position_at,
    route_polyline = excluded.route_polyline,
    route_source = excluded.route_source,
    remaining_distance_m = excluded.remaining_distance_m,
    eta_at = excluded.eta_at,
    -- A trip that is already live keeps its start (an app restart must not
    -- re-announce "on the way"); a stopped trip restarts fresh.
    started_at = case when t.status = 'ended' then now() else t.started_at end,
    arriving_notified_at = case when t.status = 'ended' then null else t.arriving_notified_at end,
    arrived_at = null,
    ended_at = null,
    updated_at = now()
  returning * into v_trip;

  perform public.insert_trip_notification(v_trip, 'trip_started');
  return v_trip;
end;
$function$;

create or replace function public.update_trip_position(
  p_booking_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_heading real default null,
  p_speed_mps real default null,
  p_accuracy_m real default null,
  p_remaining_distance_m integer default null,
  p_eta_seconds integer default null,
  p_route_polyline text default null,
  p_route_source text default null
)
returns public.booking_trips
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_trip public.booking_trips;
begin
  perform public.assert_trip_allowed(p_booking_id);

  update public.booking_trips set
    latitude = p_latitude,
    longitude = p_longitude,
    heading = p_heading,
    speed_mps = greatest(p_speed_mps, 0),
    accuracy_m = greatest(p_accuracy_m, 0),
    position_at = now(),
    remaining_distance_m = greatest(p_remaining_distance_m, 0),
    eta_at = case when p_eta_seconds is null then eta_at else now() + make_interval(secs => greatest(p_eta_seconds, 0)) end,
    route_polyline = coalesce(p_route_polyline, route_polyline),
    route_source = coalesce(p_route_source, route_source),
    updated_at = now()
  where booking_id = p_booking_id
    and status = 'en_route'
    -- Server-side rate limit: at most one accepted fix every 2 seconds.
    and (position_at is null or position_at < now() - interval '2 seconds')
  returning * into v_trip;

  if v_trip.booking_id is null then
    select * into v_trip from public.booking_trips where booking_id = p_booking_id;
    return v_trip;
  end if;

  if v_trip.arriving_notified_at is null
    and ((v_trip.eta_at is not null and v_trip.eta_at <= now() + interval '5 minutes')
      or (v_trip.remaining_distance_m is not null and v_trip.remaining_distance_m <= 800))
  then
    update public.booking_trips set arriving_notified_at = now()
     where booking_id = p_booking_id
    returning * into v_trip;
    perform public.insert_trip_notification(v_trip, 'trip_arriving');
  end if;

  return v_trip;
end;
$function$;

create or replace function public.mark_trip_arrived(p_booking_id uuid)
returns public.booking_trips
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_trip public.booking_trips;
begin
  perform public.assert_trip_allowed(p_booking_id);
  update public.booking_trips set
    status = 'arrived',
    arrived_at = now(),
    remaining_distance_m = 0,
    eta_at = now(),
    route_polyline = null,
    updated_at = now()
  where booking_id = p_booking_id and status = 'en_route'
  returning * into v_trip;

  if v_trip.booking_id is null then
    select * into v_trip from public.booking_trips where booking_id = p_booking_id;
    return v_trip;
  end if;
  perform public.insert_trip_notification(v_trip, 'trip_arrived');
  return v_trip;
end;
$function$;

-- Ending wipes every coordinate. Callable by the barber at any time for
-- their own trip (no date/status guard: stopping must always work).
create or replace function public.end_trip(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $function$
  update public.booking_trips set
    status = 'ended', ended_at = now(), updated_at = now(),
    latitude = null, longitude = null, heading = null, speed_mps = null, accuracy_m = null,
    dest_latitude = null, dest_longitude = null, route_polyline = null,
    remaining_distance_m = null, eta_at = null
  where booking_id = p_booking_id
    and barber_id = (select auth.uid())
    and status <> 'ended';
$function$;

revoke all on function public.start_trip(uuid, double precision, double precision, double precision, double precision, text, text, integer, integer) from public, anon;
revoke all on function public.update_trip_position(uuid, double precision, double precision, real, real, real, integer, integer, text, text) from public, anon;
revoke all on function public.mark_trip_arrived(uuid) from public, anon;
revoke all on function public.end_trip(uuid) from public, anon;
grant execute on function public.start_trip(uuid, double precision, double precision, double precision, double precision, text, text, integer, integer) to authenticated;
grant execute on function public.update_trip_position(uuid, double precision, double precision, real, real, real, integer, integer, text, text) to authenticated;
grant execute on function public.mark_trip_arrived(uuid) to authenticated;
grant execute on function public.end_trip(uuid) to authenticated;

-- A booking leaving 'accepted' ends any live trip and wipes it.
create or replace function public.end_trip_on_booking_close()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.status is distinct from old.status and new.status <> 'accepted' then
    update public.booking_trips set
      status = 'ended', ended_at = now(), updated_at = now(),
      latitude = null, longitude = null, heading = null, speed_mps = null, accuracy_m = null,
      dest_latitude = null, dest_longitude = null, route_polyline = null,
      remaining_distance_m = null, eta_at = null
    where booking_id = new.id and status <> 'ended';
  end if;
  return new;
end;
$function$;
revoke all on function public.end_trip_on_booking_close() from public, anon, authenticated;

drop trigger if exists trg_end_trip_on_booking_close on public.bookings;
create trigger trg_end_trip_on_booking_close
  after update of status on public.bookings
  for each row execute function public.end_trip_on_booking_close();

-- ---------------------------------------------------------------------------
-- 5. Safety events (append-only SOS audit log)
-- ---------------------------------------------------------------------------

create table if not exists public.safety_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('sos', 'trip_shared')),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  constraint safety_events_position_pair check ((latitude is null) = (longitude is null)),
  constraint safety_events_position_range check (
    latitude is null or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);
create index if not exists safety_events_booking_idx on public.safety_events (booking_id, created_at desc);
create index if not exists safety_events_user_idx on public.safety_events (user_id);

alter table public.safety_events enable row level security;
revoke all on public.safety_events from public, anon, authenticated;
grant select, insert on public.safety_events to authenticated;
grant all on public.safety_events to service_role;

drop policy if exists safety_events_insert_participant on public.safety_events;
create policy safety_events_insert_participant
  on public.safety_events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.bookings b
       where b.id = safety_events.booking_id
         and (select auth.uid()) in (b.customer_id, b.barber_id)
    )
  );
drop policy if exists safety_events_select_own on public.safety_events;
create policy safety_events_select_own
  on public.safety_events for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Push tokens and delivery
-- ---------------------------------------------------------------------------

create table if not exists public.push_tokens (
  token text primary key check (
    char_length(token) <= 200
    and (token like 'ExponentPushToken[%]' or token like 'ExpoPushToken[%]')
  ),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  language text not null default 'en' check (language in ('de', 'en')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public, anon, authenticated;
grant all on public.push_tokens to service_role;

-- A device token belongs to whoever is signed in on that device now, so
-- registering re-assigns it (account switch on a shared phone). At most 10
-- devices per user; the oldest is dropped.
create or replace function public.register_push_token(p_token text, p_platform text, p_language text default 'en')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform, language, updated_at)
  values (p_token, v_uid, p_platform, case when p_language = 'de' then 'de' else 'en' end, now())
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    language = excluded.language,
    updated_at = now();

  delete from public.push_tokens
   where user_id = v_uid
     and token in (
       select token from public.push_tokens where user_id = v_uid
        order by updated_at desc offset 10
     );
end;
$function$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $function$
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
$function$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Lock-screen copy. Mirrors notificationCopy() in src/shared/notifications.ts;
-- never includes message text or addresses.
create or replace function public.notification_push_copy(
  p_event text,
  p_status public.booking_status_type,
  p_actor_name text,
  p_language text
)
returns table (title text, body text)
language sql
immutable
set search_path = public, pg_temp
as $function$
  select * from (values (
    case
      when p_language = 'de' then case p_event
        when 'message' then 'Neue Nachricht'
        when 'new_request' then 'Neue Terminanfrage'
        when 'trip_started' then 'Dein Barber ist unterwegs'
        when 'trip_arriving' then 'Gleich da'
        when 'trip_arrived' then 'Dein Barber ist da'
        else case p_status
          when 'accepted' then 'Termin bestätigt'
          when 'rejected' then 'Terminanfrage abgelehnt'
          when 'cancelled' then 'Termin abgesagt'
          when 'completed' then 'Termin abgeschlossen'
          else 'Termin aktualisiert' end
        end
      else case p_event
        when 'message' then 'New message'
        when 'new_request' then 'New booking request'
        when 'trip_started' then 'Your barber is on the way'
        when 'trip_arriving' then 'Almost there'
        when 'trip_arrived' then 'Your barber has arrived'
        else case p_status
          when 'accepted' then 'Booking accepted'
          when 'rejected' then 'Booking declined'
          when 'cancelled' then 'Booking cancelled'
          when 'completed' then 'Appointment complete'
          else 'Booking updated' end
        end
    end,
    case
      when p_language = 'de' then case p_event
        when 'message' then p_actor_name || ' hat dir eine Nachricht geschickt.'
        when 'new_request' then p_actor_name || ' hat einen Termin angefragt.'
        when 'trip_started' then p_actor_name || ' ist auf dem Weg zu dir. Verfolge die Ankunft live.'
        when 'trip_arriving' then p_actor_name || ' ist in wenigen Minuten bei dir.'
        when 'trip_arrived' then p_actor_name || ' ist an deiner Adresse angekommen.'
        else case p_status
          when 'accepted' then p_actor_name || ' hat den Termin bestätigt.'
          when 'rejected' then p_actor_name || ' hat den Termin abgelehnt.'
          when 'cancelled' then p_actor_name || ' hat den Termin abgesagt.'
          when 'completed' then p_actor_name || ' hat den Termin abgeschlossen.'
          else p_actor_name || ' hat den Termin aktualisiert.' end
        end
      else case p_event
        when 'message' then p_actor_name || ' sent you a message.'
        when 'new_request' then p_actor_name || ' requested an appointment.'
        when 'trip_started' then p_actor_name || ' is on the way to you. Follow the arrival live.'
        when 'trip_arriving' then p_actor_name || ' will be with you in a few minutes.'
        when 'trip_arrived' then p_actor_name || ' has arrived at your address.'
        else case p_status
          when 'accepted' then p_actor_name || ' accepted the appointment.'
          when 'rejected' then p_actor_name || ' declined the appointment.'
          when 'cancelled' then p_actor_name || ' cancelled the appointment.'
          when 'completed' then p_actor_name || ' marked the appointment complete.'
          else p_actor_name || ' updated the appointment.' end
        end
    end
  )) as copy (title, body);
$function$;
revoke all on function public.notification_push_copy(text, public.booking_status_type, text, text) from public, anon, authenticated;

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_name text;
  v_messages jsonb;
begin
  if new.actor_id is null then
    v_actor_name := 'Privelier';
  else
    select coalesce(nullif(btrim(u.name), ''), 'Privelier') into v_actor_name
      from public.users u where u.id = new.actor_id;
  end if;

  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', c.title,
           'body', c.body,
           'sound', 'default',
           'priority', 'high',
           'channelId', case when new.event_type like 'trip_%' then 'trip' else 'default' end,
           'data', jsonb_build_object(
             'notificationId', new.id,
             'bookingId', new.booking_id,
             'eventType', new.event_type
           )
         ))
    into v_messages
    from public.push_tokens t
    cross join lateral public.notification_push_copy(
      new.event_type, new.booking_status, coalesce(v_actor_name, 'Privelier'), t.language
    ) c
   where t.user_id = new.recipient_id;

  if v_messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  -- Push is best effort; the in-app feed row is the durable record.
  raise warning 'notification push skipped: %', sqlerrm;
  return new;
end;
$function$;
revoke all on function public.dispatch_notification_push() from public, anon, authenticated;

drop trigger if exists trg_dispatch_notification_push on public.notifications;
create trigger trg_dispatch_notification_push
  after insert on public.notifications
  for each row execute function public.dispatch_notification_push();
