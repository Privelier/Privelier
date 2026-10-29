-- Looks slice S4: look search with instant matches (docs/genius/LOOKS.md B4).
--
-- The client picks a style, one day and a time window ("Fri 18-20"), and
-- optionally a reference photo of their own. match_look() answers at once
-- with the barbers in the client's city who have PROOF in that style
-- (confirmed or published looks) and are free in the window, with the first
-- free start time, sorted by exact-hit rate. It never returns a location or
-- a distance (LOOKS_REVIEW R1). The free-time rule mirrors
-- validate_booking_slot (0060): availability for that day (specific date
-- first), no day off, no overlap with a pending or accepted booking
-- including the 30-minute travel buffer on both sides.
--
-- Reference photos live in the private `look-references` bucket under the
-- client's own folder and are attached to the booking with the reference;
-- the booked barber may open that photo while the request is pending or
-- accepted. Screenshots of other people's photos never become public.

alter table private.looks_settings
  add column search_max_window_hours integer not null default 12 check (search_max_window_hours between 1 and 24),
  add column search_step_minutes integer not null default 15 check (search_step_minutes in (5, 10, 15, 30, 60));

-- ---------------------------------------------------------------------------
-- 1. Reference photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('look-references', 'look-references', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.look_references
  add column photo_path text check (photo_path is null or char_length(photo_path) <= 200);

create or replace function private.can_view_reference_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.flag_enabled('looks') and exists (
    select 1
    from public.look_references r
    join public.bookings b on b.id = r.booking_id
    where r.photo_path = p_name
      and b.barber_id = (select auth.uid())
      and b.status in ('pending', 'accepted')
  );
$function$;
revoke all on function private.can_view_reference_photo(text) from public, anon;
grant execute on function private.can_view_reference_photo(text) to authenticated;

create policy look_references_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'look-references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.has_role('customer'::public.user_role)
    and private.flag_enabled('looks')
    and private.storage_object_count('look-references', (select auth.uid())) < 30
  );

create policy look_references_select_own_or_booked on storage.objects
  for select to authenticated
  using (
    bucket_id = 'look-references'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.can_view_reference_photo(name)
    )
  );

create policy look_references_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'look-references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- The S3 function gains the optional photo; the old three-argument version
-- is dropped so PostgREST never sees two candidates.
drop function public.attach_look_reference(uuid, uuid, text);

create or replace function public.attach_look_reference(
  p_booking_id uuid,
  p_look_id uuid,
  p_style text,
  p_photo_path text default null
)
returns public.look_references
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_booking public.bookings;
  v_row public.look_references;
begin
  perform private.assert_looks_enabled();
  perform private.consume_rate('look_reference:' || v_uid, 30, 3600);
  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id and b.customer_id = v_uid and b.status = 'pending';
  if not found then
    raise exception 'pending booking not found' using errcode = 'P0002';
  end if;
  if not private.valid_look_styles(array[p_style]) then
    raise exception 'invalid style' using errcode = '22023';
  end if;
  if p_look_id is not null and not exists (
    select 1 from public.looks_feed(null, null, 1, p_look_id) f
    where f.barber_id = v_booking.barber_id
  ) then
    raise exception 'look not found' using errcode = 'P0002';
  end if;
  if p_photo_path is not null and (
    p_photo_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,120}$')
    or not exists (select 1 from storage.objects o where o.bucket_id = 'look-references' and o.name = p_photo_path)
  ) then
    raise exception 'upload the reference photo first' using errcode = '22023';
  end if;
  insert into public.look_references (booking_id, customer_id, look_id, style, photo_path)
  values (p_booking_id, v_uid, p_look_id, p_style, p_photo_path)
  returning * into v_row;
  return v_row;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Instant matches
-- ---------------------------------------------------------------------------
create or replace function public.match_look(p_style text, p_date date, p_from time, p_to time)
returns table (
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
  first_free_time time
)
language sql
stable
security definer
set search_path = ''
as $function$
  with cfg as (select * from private.looks_settings),
  viewer as (
    select u.id, lower(btrim(u.city)) as city
    from public.users u, cfg
    where u.id = (select auth.uid())
      and private.flag_enabled('looks')
      and private.has_role('customer'::public.user_role)
      and nullif(btrim(u.city), '') is not null
      and private.valid_look_styles(array[p_style])
      and p_date between current_date and current_date + 30
      and p_from < p_to
      and p_to - p_from <= make_interval(hours => cfg.search_max_window_hours)
  ),
  candidates as (
    select bp.barber_id, bp.name, bp.profile_image, bp.rating,
           count(*)::integer as proof_count,
           (array_agg(l.service_id order by l.responded_at desc) filter (where l.service_id is not null))[1] as service_id
    from viewer v
    join public.barber_public_profile bp on bp.approved and lower(btrim(bp.city)) = v.city
    join public.looks l on l.barber_id = bp.barber_id
      and l.status in ('confirmed', 'published')
      and p_style = any(l.styles)
    where not private.is_blocked_between(v.id, bp.barber_id)
    group by bp.barber_id, bp.name, bp.profile_image, bp.rating
  ),
  offered as (
    select c.*, sv.name as service_name, sv.price, sv.duration_minutes
    from candidates c
    join public.services sv on sv.id = c.service_id
    where not exists (select 1 from public.barber_days_off d where d.barber_id = c.barber_id and d.day = p_date)
  ),
  free as (
    select o.barber_id, min(slot.start::time) as first_free_time
    from offered o
    cross join cfg
    cross join lateral generate_series(
      p_date + p_from,
      p_date + p_to - make_interval(mins => o.duration_minutes),
      make_interval(mins => cfg.search_step_minutes)
    ) as slot(start)
    where slot.start > localtimestamp
      and exists (
        select 1 from public.availability a
        where a.barber_id = o.barber_id
          and (
            a.specific_date = p_date
            or (a.day_of_week = extract(dow from p_date)::smallint
                and not exists (select 1 from public.availability s2 where s2.barber_id = o.barber_id and s2.specific_date = p_date))
          )
          and slot.start >= p_date + a.start_time
          and slot.start + make_interval(mins => o.duration_minutes) <= p_date + a.end_time
      )
      and not exists (
        select 1 from public.bookings b
        where b.barber_id = o.barber_id
          and b.status in ('pending', 'accepted')
          and b.date between p_date - 1 and p_date + 1
          and slot.start < (b.date + b.time) + make_interval(mins => b.duration_minutes) + private.travel_buffer()
          and (b.date + b.time) < slot.start + make_interval(mins => o.duration_minutes) + private.travel_buffer()
      )
    group by o.barber_id
  ),
  feedback as (
    select f.barber_id, count(*)::integer as total, (count(*) filter (where f.verdict = 'exact'))::integer as exact_n
    from public.look_feedback f
    where f.style = p_style
    group by f.barber_id
  )
  select o.barber_id, o.name, o.profile_image, o.rating, o.proof_count,
         coalesce(fb.total, 0),
         case when coalesce(fb.total, 0) >= cfg.min_feedback_for_rate then round(fb.exact_n::numeric / fb.total, 2) end,
         o.service_id, o.service_name, o.price, o.duration_minutes,
         fr.first_free_time
  from offered o
  join free fr on fr.barber_id = o.barber_id
  cross join cfg
  left join feedback fb on fb.barber_id = o.barber_id
  order by 7 desc nulls last, o.proof_count desc, fr.first_free_time
  limit 20;
$function$;

revoke all on function public.attach_look_reference(uuid, uuid, text, text) from public, anon;
revoke all on function public.match_look(text, date, time, time) from public, anon;
grant execute on function public.attach_look_reference(uuid, uuid, text, text) to authenticated;
grant execute on function public.match_look(text, date, time, time) to authenticated;
