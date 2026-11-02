-- Rollback for 0071_looks_barber_time_zone.sql. Apply before the 0068 rollback.
-- Restores the four functions as
-- 0066 and 0067 defined them, which compare with localtimestamp (UTC) again. No
-- stored row changes, wishes created under 0071 keep their expires_at.

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
