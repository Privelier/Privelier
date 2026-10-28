-- Looks slice S5: look wish and offers (docs/genius/LOOKS.md B5, review
-- items X2, P9, P10, R1).
--
-- The fallback when a look search finds nobody: the client sends a WISH
-- (style, one day, a time window, optional private reference photo). It goes
-- to the approved barbers of the client's city who have proof in that style
-- (L4: same city, never a location). Each may OFFER one start time inside
-- the window for one of their own services, with a short note. The price is
-- always the service's normal price (no bidding). The client picks an offer,
-- enters the address as always, create_booking (0054, unchanged) makes a
-- normal PENDING request and accept_offer() links it: the barber still
-- confirms with one tap (L3).
--
-- Lifetime (P9, no cron): a wish takes new offers until expires_at, which is
-- set at creation to the earlier of now + wish_valid_hours and the window
-- start. Offers already made stay bookable until their start time passes,
-- unless the wish was booked or cancelled.
--
-- Barbers never see who wished (no name, no city beyond their own, no
-- photo of the client's face: the reference photo is the client's choice,
-- reportable). Clients see offers only for their own wishes.
--
-- Notifications (X2): wishes and offers have no booking, so
-- notifications.booking_id becomes nullable and look_wish_id is added; every
-- existing event keeps its booking (constraint below). Both apps tolerate a
-- null booking_id (src/shared/notifications.ts).

alter table private.looks_settings
  add column wish_valid_hours integer not null default 48 check (wish_valid_hours between 1 and 168),
  add column max_open_wishes integer not null default 3 check (max_open_wishes between 1 and 10),
  add column wish_notify_barbers integer not null default 20 check (wish_notify_barbers between 1 and 100);

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
-- The flag for a user other than the caller (who is notified of a wish).
create or replace function private.flag_enabled_for(p_key text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.feature_flags f
    where f.key = p_key
      and (
        f.enabled_for_all
        or exists (select 1 from private.feature_flag_users u where u.flag_key = f.key and u.user_id = p_user)
      )
  );
$function$;
revoke all on function private.flag_enabled_for(text, uuid) from public, anon, authenticated;

-- Same rule as validate_booking_slot (0060): in the future, no day off,
-- inside that day's availability (a specific date wins over the weekday),
-- no overlap with an active booking including the travel buffer.
create or replace function private.barber_slot_free(p_barber uuid, p_day date, p_time time, p_minutes integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (p_day + p_time) > localtimestamp
    and not exists (select 1 from public.barber_days_off d where d.barber_id = p_barber and d.day = p_day)
    and exists (
      select 1 from public.availability a
      where a.barber_id = p_barber
        and (
          a.specific_date = p_day
          or (a.day_of_week = extract(dow from p_day)::smallint
              and not exists (select 1 from public.availability s where s.barber_id = p_barber and s.specific_date = p_day))
        )
        and (p_day + p_time) >= p_day + a.start_time
        and (p_day + p_time) + make_interval(mins => p_minutes) <= p_day + a.end_time
    )
    and not exists (
      select 1 from public.bookings b
      where b.barber_id = p_barber
        and b.status in ('pending', 'accepted')
        and b.date between p_day - 1 and p_day + 1
        and (p_day + p_time) < (b.date + b.time) + make_interval(mins => b.duration_minutes) + private.travel_buffer()
        and (b.date + b.time) < (p_day + p_time) + make_interval(mins => p_minutes) + private.travel_buffer()
    );
$function$;
revoke all on function private.barber_slot_free(uuid, date, time, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Wishes and offers
-- ---------------------------------------------------------------------------
create table public.look_wishes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  style text not null references public.look_styles(key),
  -- lower(btrim(users.city)) at creation, the discovery rule (R2).
  city text not null check (city = lower(btrim(city)) and city <> ''),
  day date not null,
  window_from time not null,
  window_to time not null,
  photo_path text check (photo_path is null or char_length(photo_path) <= 200),
  status text not null default 'open' check (status in ('open', 'booked', 'cancelled')),
  booking_id uuid references public.bookings(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint look_wishes_window check (window_from < window_to)
);
create index look_wishes_open_city_idx on public.look_wishes (city, style) where status = 'open';
create index look_wishes_customer_idx on public.look_wishes (customer_id, created_at desc);
create index look_wishes_booking_idx on public.look_wishes (booking_id);

create table public.look_wish_offers (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.look_wishes(id) on delete cascade,
  barber_id uuid not null references public.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  proposed_time time not null,
  note text check (note is null or (char_length(note) between 1 and 280)),
  status text not null default 'open' check (status in ('open', 'accepted', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wish_id, barber_id)
);
create index look_wish_offers_barber_idx on public.look_wish_offers (barber_id);
create index look_wish_offers_service_idx on public.look_wish_offers (service_id);

alter table public.look_wishes enable row level security;
alter table public.look_wish_offers enable row level security;
revoke all on public.look_wishes from public, anon, authenticated;
revoke all on public.look_wish_offers from public, anon, authenticated;
grant select on public.look_wishes to authenticated;
grant select on public.look_wish_offers to authenticated;

create policy look_wishes_select_own on public.look_wishes
  for select to authenticated
  using ((select private.flag_enabled('looks')) and customer_id = (select auth.uid()));

create policy look_wish_offers_select_parties on public.look_wish_offers
  for select to authenticated
  using (
    (select private.flag_enabled('looks'))
    and (
      barber_id = (select auth.uid())
      or exists (select 1 from public.look_wishes w where w.id = look_wish_offers.wish_id and w.customer_id = (select auth.uid()))
    )
  );

-- May this barber offer on this wish? Open, before expiry, approved in the
-- wish's city, proof in the style, no block either way.
create or replace function private.barber_can_offer(p_barber uuid, p_wish public.look_wishes)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_wish.status = 'open'
    and p_wish.expires_at > now()
    and p_barber <> p_wish.customer_id
    and exists (
      select 1 from public.barber_public_profile bp
      where bp.barber_id = p_barber and bp.approved and lower(btrim(bp.city)) = p_wish.city
    )
    and exists (
      select 1 from public.looks l
      where l.barber_id = p_barber and l.status in ('confirmed', 'published') and p_wish.style = any(l.styles)
    )
    and not private.is_blocked_between(p_barber, p_wish.customer_id);
$function$;
revoke all on function private.barber_can_offer(uuid, public.look_wishes) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reference photos: matching barbers may open a wish's photo while it
--    takes offers (replaces the 0066 version, which is kept inside).
-- ---------------------------------------------------------------------------
create or replace function private.can_view_reference_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.flag_enabled('looks') and (
    exists (
      select 1
      from public.look_references r
      join public.bookings b on b.id = r.booking_id
      where r.photo_path = p_name
        and b.barber_id = (select auth.uid())
        and b.status in ('pending', 'accepted')
    )
    or exists (
      select 1 from public.look_wishes w
      where w.photo_path = p_name
        and private.has_role('barber'::public.user_role)
        and private.barber_can_offer((select auth.uid()), w)
    )
  );
$function$;

-- ---------------------------------------------------------------------------
-- 4. Client functions
-- ---------------------------------------------------------------------------
create or replace function public.create_wish(
  p_style text,
  p_day date,
  p_from time,
  p_to time,
  p_photo_path text default null
)
returns public.look_wishes
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_cfg private.looks_settings;
  v_city text;
  v_row public.look_wishes;
begin
  perform private.assert_looks_enabled();
  if not private.has_role('customer'::public.user_role) then
    raise exception 'only customers send wishes' using errcode = '42501';
  end if;
  perform private.consume_rate('look_wish:' || v_uid, 10, 86400);
  select * into v_cfg from private.looks_settings;
  select lower(btrim(u.city)) into v_city from public.users u where u.id = v_uid;
  if nullif(v_city, '') is null then
    raise exception 'add your city first' using errcode = '22023';
  end if;
  if not private.valid_look_styles(array[p_style])
     or p_day is null or p_from is null or p_to is null
     or p_day > current_date + 30
     or p_from >= p_to
     or p_to - p_from > make_interval(hours => v_cfg.search_max_window_hours)
     or (p_day + p_from) <= localtimestamp then
    raise exception 'pick a style and a future window' using errcode = '22023';
  end if;
  if p_photo_path is not null and (
    p_photo_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,120}$')
    or not exists (select 1 from storage.objects o where o.bucket_id = 'look-references' and o.name = p_photo_path)
  ) then
    raise exception 'upload the reference photo first' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('look_wish:' || v_uid::text, 0));
  if (select count(*) from public.look_wishes w
      where w.customer_id = v_uid and w.status = 'open' and w.expires_at > now()) >= v_cfg.max_open_wishes then
    raise exception 'too many open wishes' using errcode = 'PA002';
  end if;

  insert into public.look_wishes (customer_id, style, city, day, window_from, window_to, photo_path, expires_at)
  values (
    v_uid, p_style, v_city, p_day, p_from, p_to, p_photo_path,
    least(now() + make_interval(hours => v_cfg.wish_valid_hours), (p_day + p_from)::timestamptz)
  )
  returning * into v_row;
  return v_row;
end;
$function$;

create or replace function public.cancel_wish(p_wish_id uuid)
returns public.look_wishes
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.look_wishes;
begin
  perform private.assert_looks_enabled();
  update public.look_wishes
     set status = 'cancelled'
   where id = p_wish_id and customer_id = (select auth.uid()) and status = 'open'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'open wish not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$function$;

-- Offers on the caller's wishes that can still be booked (p_wish_id null:
-- all of them), best exact-hit rate first. Never a location.
create or replace function public.wish_offers(p_wish_id uuid default null)
returns table (
  offer_id uuid,
  wish_id uuid,
  barber_id uuid,
  barber_name text,
  barber_image text,
  barber_rating numeric,
  proof_count integer,
  feedback_count integer,
  hit_rate numeric,
  service_id uuid,
  service_name text,
  service_price numeric,
  service_duration integer,
  proposed_time time,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  with cfg as (select * from private.looks_settings)
  select o.id, w.id, o.barber_id, bp.name, bp.profile_image, bp.rating,
         (select count(*)::integer from public.looks l
           where l.barber_id = o.barber_id and l.status in ('confirmed', 'published') and w.style = any(l.styles)),
         coalesce(fb.total, 0),
         case when coalesce(fb.total, 0) >= cfg.min_feedback_for_rate then round(fb.exact_n::numeric / fb.total, 2) end,
         sv.id, sv.name, sv.price, sv.duration_minutes,
         o.proposed_time, o.note, o.created_at
  from public.look_wishes w
  cross join cfg
  join public.look_wish_offers o on o.wish_id = w.id and o.status = 'open'
  join public.barber_public_profile bp on bp.barber_id = o.barber_id and bp.approved
  join public.services sv on sv.id = o.service_id
  left join lateral (
    select count(*)::integer as total, (count(*) filter (where f.verdict = 'exact'))::integer as exact_n
    from public.look_feedback f
    where f.barber_id = o.barber_id and f.style = w.style
  ) fb on true
  where w.customer_id = (select auth.uid())
    and private.flag_enabled('looks')
    and w.status = 'open'
    and (p_wish_id is null or w.id = p_wish_id)
    and (w.day + o.proposed_time) > localtimestamp
    and not private.is_blocked_between(w.customer_id, o.barber_id)
  order by 9 desc nulls last, o.proposed_time, o.created_at
  limit 60;
$function$;

-- After create_booking made a normal pending request for the offer, link
-- the two (P10). The booking must match the offer exactly.
create or replace function public.accept_offer(p_offer_id uuid, p_booking_id uuid)
returns public.look_wish_offers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_offer public.look_wish_offers;
  v_wish public.look_wishes;
begin
  perform private.assert_looks_enabled();
  perform private.consume_rate('look_accept:' || v_uid, 30, 3600);
  select o.* into v_offer from public.look_wish_offers o where o.id = p_offer_id and o.status = 'open';
  if found then
    select w.* into v_wish from public.look_wishes w
     where w.id = v_offer.wish_id and w.customer_id = v_uid and w.status = 'open'
     for update;
  end if;
  if v_wish.id is null then
    raise exception 'open offer not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and b.customer_id = v_uid
      and b.status = 'pending'
      and b.barber_id = v_offer.barber_id
      and b.service_id = v_offer.service_id
      and b.date = v_wish.day
      and b.time = v_offer.proposed_time
  ) then
    raise exception 'the booking does not match the offer' using errcode = 'P0002';
  end if;

  update public.look_wish_offers set status = 'accepted', updated_at = now() where id = v_offer.id
  returning * into v_offer;
  update public.look_wishes set status = 'booked', booking_id = p_booking_id where id = v_wish.id;
  insert into public.look_references (booking_id, customer_id, look_id, style, photo_path)
  values (p_booking_id, v_uid, null, v_wish.style, v_wish.photo_path)
  on conflict (booking_id) do nothing;
  return v_offer;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Barber functions
-- ---------------------------------------------------------------------------
-- Open wishes this barber may answer, soonest first, with their own offer.
-- No client identity.
create or replace function public.open_wishes()
returns table (
  wish_id uuid,
  style text,
  day date,
  window_from time,
  window_to time,
  expires_at timestamptz,
  photo_path text,
  my_offer_id uuid,
  my_offer_status text,
  my_offer_time time,
  my_offer_service_id uuid,
  my_offer_note text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select w.id, w.style, w.day, w.window_from, w.window_to, w.expires_at, w.photo_path,
         o.id, o.status, o.proposed_time, o.service_id, o.note
  from public.look_wishes w
  left join public.look_wish_offers o on o.wish_id = w.id and o.barber_id = (select auth.uid())
  where private.flag_enabled('looks')
    and private.has_role('barber'::public.user_role)
    and w.status = 'open'
    and w.expires_at > now()
    and w.city = (select lower(btrim(bp.city)) from public.barber_public_profile bp where bp.barber_id = (select auth.uid()))
    and private.barber_can_offer((select auth.uid()), w)
  order by w.day, w.window_from, w.created_at
  limit 50;
$function$;

-- One offer per barber and wish; sending again updates it while it is open
-- or withdrawn. The start must fit the window with the service's duration,
-- and the barber must be free then (same rule as a booking).
create or replace function public.offer_for_wish(
  p_wish_id uuid,
  p_service_id uuid,
  p_time time,
  p_note text default null
)
returns public.look_wish_offers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_wish public.look_wishes;
  v_service public.services;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_row public.look_wish_offers;
begin
  perform private.assert_looks_enabled();
  if not private.has_role('barber'::public.user_role) then
    raise exception 'only barbers offer' using errcode = '42501';
  end if;
  perform private.consume_rate('look_offer:' || v_uid, 60, 3600);
  select w.* into v_wish from public.look_wishes w where w.id = p_wish_id for update;
  if v_wish.id is null or not private.barber_can_offer(v_uid, v_wish) then
    raise exception 'wish not found' using errcode = 'P0002';
  end if;
  select s.* into v_service from public.services s where s.id = p_service_id and s.barber_id = v_uid;
  if v_service.id is null or p_time is null
     or p_time < v_wish.window_from
     or (v_wish.day + p_time) + make_interval(mins => v_service.duration_minutes) > v_wish.day + v_wish.window_to then
    raise exception 'pick one of your services and a start inside the window' using errcode = '22023';
  end if;
  if char_length(v_note) > 280 then
    raise exception 'note too long' using errcode = '22023';
  end if;
  perform private.assert_allowed_text(v_note);
  if not private.barber_slot_free(v_uid, v_wish.day, p_time, v_service.duration_minutes) then
    raise exception 'you are not free at that time' using errcode = 'PA041';
  end if;

  insert into public.look_wish_offers as o (wish_id, barber_id, service_id, proposed_time, note)
  values (v_wish.id, v_uid, v_service.id, p_time, v_note)
  on conflict (wish_id, barber_id) do update
    set service_id = excluded.service_id,
        proposed_time = excluded.proposed_time,
        note = excluded.note,
        status = 'open',
        updated_at = now()
    where o.status in ('open', 'withdrawn')
  returning * into v_row;
  if v_row.id is null then
    raise exception 'this offer was already accepted' using errcode = 'P0001';
  end if;
  return v_row;
end;
$function$;

create or replace function public.withdraw_offer(p_offer_id uuid)
returns public.look_wish_offers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.look_wish_offers;
begin
  perform private.assert_looks_enabled();
  update public.look_wish_offers
     set status = 'withdrawn', updated_at = now()
   where id = p_offer_id and barber_id = (select auth.uid()) and status = 'open'
  returning * into v_row;
  if v_row.id is null then
    raise exception 'open offer not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Notifications (X2)
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column look_wish_id uuid references public.look_wishes(id) on delete cascade;
create index notifications_look_wish_idx on public.notifications (look_wish_id);
alter table public.notifications alter column booking_id drop not null;

alter table public.notifications drop constraint notifications_event_type_check;
alter table public.notifications drop constraint notifications_message_shape;
alter table public.notifications add constraint notifications_event_type_check
  check (event_type in ('message', 'new_request', 'booking_status', 'trip_started', 'trip_arriving', 'trip_arrived', 'look_confirm', 'look_wish', 'look_offer'));
alter table public.notifications add constraint notifications_message_shape check (
  (event_type = 'message' and message_id is not null and booking_status is null)
  or (event_type in ('new_request', 'trip_started', 'trip_arriving', 'trip_arrived', 'look_confirm', 'look_wish', 'look_offer')
      and message_id is null and booking_status is null)
  or (event_type = 'booking_status' and message_id is null and booking_status is not null)
);
-- Every event that existed before keeps its booking; only wish events lack one.
alter table public.notifications add constraint notifications_subject check (
  case when event_type in ('look_wish', 'look_offer')
    then booking_id is null and look_wish_id is not null
    else booking_id is not null and look_wish_id is null
  end
);

-- Same copy as 0064 plus look_wish and look_offer. Mirrors notificationCopy()
-- in src/shared/notifications.ts. A wish never names the client.
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
        when 'look_confirm' then 'Ist das dein Schnitt?'
        when 'look_wish' then 'Look-Wunsch in deiner Stadt'
        when 'look_offer' then 'Neues Angebot für deinen Look'
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
        when 'look_confirm' then 'Is this your cut?'
        when 'look_wish' then 'A look wish in your city'
        when 'look_offer' then 'New offer for your look'
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
        when 'look_confirm' then p_actor_name || ' hat das Ergebnis deines Termins festgehalten. Bestätige es oder lehne ab.'
        when 'look_wish' then 'Ein Kunde sucht einen Look, den du nachweislich schneidest. Schlag eine Zeit vor.'
        when 'look_offer' then p_actor_name || ' hat dir eine Zeit für deinen Look-Wunsch vorgeschlagen.'
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
        when 'look_confirm' then p_actor_name || ' captured the result of your appointment. Confirm it or decline.'
        when 'look_wish' then 'A client wants a look you have proven. Suggest a time.'
        when 'look_offer' then p_actor_name || ' suggested a time for your look wish.'
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

-- A new wish reaches the matching barbers with the flag, most proof first,
-- at most wish_notify_barbers of them. No actor: the client stays anonymous.
create or replace function private.notify_look_wish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.notifications (recipient_id, event_type, booking_id, look_wish_id, actor_id, event_key)
  select m.barber_id, 'look_wish', null, new.id, null, 'wish:' || new.id::text || ':' || m.barber_id::text
  from (
    select bp.barber_id,
           (select count(*) from public.looks l
             where l.barber_id = bp.barber_id and l.status in ('confirmed', 'published') and new.style = any(l.styles)) as proof
    from public.barber_public_profile bp
    where bp.approved
      and lower(btrim(bp.city)) = new.city
      and bp.barber_id <> new.customer_id
      and private.flag_enabled_for('looks', bp.barber_id)
      and not private.is_blocked_between(bp.barber_id, new.customer_id)
  ) m
  where m.proof > 0
  order by m.proof desc, m.barber_id
  limit (select s.wish_notify_barbers from private.looks_settings s)
  on conflict (event_key) do nothing;
  return new;
end;
$function$;
revoke all on function private.notify_look_wish() from public, anon, authenticated;

create trigger trg_notify_look_wish
  after insert on public.look_wishes
  for each row execute function private.notify_look_wish();

create or replace function private.notify_look_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.notifications (recipient_id, event_type, booking_id, look_wish_id, actor_id, event_key)
  select w.customer_id, 'look_offer', null, w.id, new.barber_id, 'offer:' || new.id::text
  from public.look_wishes w
  where w.id = new.wish_id
  on conflict (event_key) do nothing;
  return new;
end;
$function$;
revoke all on function private.notify_look_offer() from public, anon, authenticated;

create trigger trg_notify_look_offer
  after insert on public.look_wish_offers
  for each row execute function private.notify_look_offer();

-- ---------------------------------------------------------------------------
-- 7. Reports: a wish (its photo) by a barber who may answer it, an offer
--    (its note) by the wish's client. Replaces the 0064 resolver unchanged
--    for user, message, review and look.
-- ---------------------------------------------------------------------------
alter table public.user_reports drop constraint user_reports_target_type_check;
alter table public.user_reports add constraint user_reports_target_type_check
  check (target_type in ('user', 'message', 'review', 'look', 'wish', 'offer'));

create or replace function private.resolve_report_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reporter uuid := new.reporter_id;
begin
  new.target_excerpt := null;
  if new.target_type = 'message' then
    select m.message, m.sender_id into new.target_excerpt, new.reported_id
    from public.messages m
    join public.chat_rooms cr on cr.id = m.chat_id
    where m.id = new.target_id
      and (cr.customer_id = v_reporter or cr.barber_id = v_reporter)
      and m.sender_id <> v_reporter;
    if not found then
      raise exception 'message not found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'review' then
    select r.comment, r.customer_id into new.target_excerpt, new.reported_id
    from public.reviews r
    where r.id = new.target_id and r.customer_id is distinct from v_reporter;
    if not found then
      raise exception 'review not found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'look' then
    select 'look ' || l.id::text || ' [' || array_to_string(l.styles, ', ') || '] status ' || l.status,
           l.barber_id
      into new.target_excerpt, new.reported_id
    from public.looks l
    where l.id = new.target_id
      and l.barber_id <> v_reporter
      and ((l.customer_id = v_reporter and l.submitted_at is not null) or l.status = 'published');
    if not found then
      raise exception 'look not found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'wish' then
    select 'wish ' || w.id::text || ' [' || w.style || '] photo ' || coalesce(w.photo_path, 'none'),
           w.customer_id
      into new.target_excerpt, new.reported_id
    from public.look_wishes w
    where w.id = new.target_id
      and (private.barber_can_offer(v_reporter, w)
           or exists (select 1 from public.look_wish_offers o where o.wish_id = w.id and o.barber_id = v_reporter));
    if not found then
      raise exception 'wish not found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'offer' then
    select coalesce(o.note, 'offer ' || o.id::text), o.barber_id
      into new.target_excerpt, new.reported_id
    from public.look_wish_offers o
    join public.look_wishes w on w.id = o.wish_id
    where o.id = new.target_id and w.customer_id = v_reporter;
    if not found then
      raise exception 'offer not found' using errcode = 'P0002';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.resolve_report_target() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.create_wish(text, date, time, time, text) from public, anon;
revoke all on function public.cancel_wish(uuid) from public, anon;
revoke all on function public.wish_offers(uuid) from public, anon;
revoke all on function public.accept_offer(uuid, uuid) from public, anon;
revoke all on function public.open_wishes() from public, anon;
revoke all on function public.offer_for_wish(uuid, uuid, time, text) from public, anon;
revoke all on function public.withdraw_offer(uuid) from public, anon;
grant execute on function public.create_wish(text, date, time, time, text) to authenticated;
grant execute on function public.cancel_wish(uuid) to authenticated;
grant execute on function public.wish_offers(uuid) to authenticated;
grant execute on function public.accept_offer(uuid, uuid) to authenticated;
grant execute on function public.open_wishes() to authenticated;
grant execute on function public.offer_for_wish(uuid, uuid, time, text) to authenticated;
grant execute on function public.withdraw_offer(uuid) to authenticated;
