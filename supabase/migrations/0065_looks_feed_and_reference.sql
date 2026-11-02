-- Looks slice S3: the looks feed in Discover, the look detail with its proof
-- chain, and "This look" into the existing booking flow with the look
-- attached as a reference (docs/genius/LOOKS.md B3).
--
-- Audience (L2: customers only): signed-in customers with the 'looks' flag
-- see PUBLISHED looks of APPROVED barbers in their own city (same trimmed,
-- case-insensitive match as discovery), never across a block. The client's
-- identity is never returned. The proof chain is booleans and a star rating
-- only: no coordinates, no address, no dates of other people's appointments
-- beyond the publish time.
--
-- "This look" creates the booking through the unchanged create_booking
-- (0054); attach_look_reference() then links the new PENDING booking to the
-- look. Only a look by the booked barber can be attached, so the barber sees
-- it through their own folder; no wider photo access is needed.

-- ---------------------------------------------------------------------------
-- 1. References: which look a booking was made for
-- ---------------------------------------------------------------------------
create table public.look_references (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  look_id uuid references public.looks(id) on delete set null,
  style text not null references public.look_styles(key),
  created_at timestamptz not null default now()
);
create index look_references_look_idx on public.look_references (look_id);
create index look_references_customer_idx on public.look_references (customer_id);

alter table public.look_references enable row level security;
revoke all on public.look_references from public, anon, authenticated;
grant select on public.look_references to authenticated;
create policy look_references_select_participants on public.look_references
  for select to authenticated
  using (
    (select private.flag_enabled('looks'))
    and (
      customer_id = (select auth.uid())
      or exists (
        select 1 from public.bookings b
        where b.id = look_references.booking_id and b.barber_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Who may see published photos (replaces the S2 version)
-- ---------------------------------------------------------------------------
create or replace function private.can_view_look_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.flag_enabled('looks') and exists (
    select 1
    from public.look_photos p
    join public.looks l on l.id = p.look_id
    cross join private.looks_settings s
    where p.storage_path = p_name
      and (
        -- the look's own customer (S2)
        (l.customer_id = (select auth.uid())
          and l.submitted_at is not null
          and (
            l.status in ('confirmed', 'published')
            or (l.status = 'draft' and l.submitted_at > now() - make_interval(days => s.draft_valid_days))
          ))
        -- any customer, once published by an approved barber, never across a block
        or (l.status = 'published'
          and private.has_role('customer'::public.user_role)
          and exists (select 1 from public.barber_public_profile bp where bp.barber_id = l.barber_id and bp.approved)
          and not private.is_blocked_between((select auth.uid()), l.barber_id))
      )
  );
$function$;

-- ---------------------------------------------------------------------------
-- 3. Feed and detail
-- ---------------------------------------------------------------------------
-- p_look_id set: that one look (detail). Otherwise newest first, optionally
-- one style, keyset-paged by published time.
create or replace function public.looks_feed(
  p_style text default null,
  p_before timestamptz default null,
  p_limit integer default 20,
  p_look_id uuid default null
)
returns table (
  look_id uuid,
  barber_id uuid,
  barber_name text,
  barber_image text,
  barber_rating numeric,
  styles text[],
  service_id uuid,
  service_name text,
  service_price numeric,
  service_duration integer,
  published_at timestamptz,
  review_rating integer,
  arrival_confirmed boolean,
  proof_count integer,
  photo_paths text[]
)
language sql
stable
security definer
set search_path = ''
as $function$
  with viewer as (
    select u.id, lower(btrim(u.city)) as city
    from public.users u
    where u.id = (select auth.uid())
      and private.flag_enabled('looks')
      and private.has_role('customer'::public.user_role)
      and nullif(btrim(u.city), '') is not null
  )
  select l.id,
         l.barber_id,
         bp.name,
         bp.profile_image,
         bp.rating,
         l.styles,
         sv.id,
         sv.name,
         sv.price,
         sv.duration_minutes,
         l.consented_at,
         r.rating::integer,
         exists (
           select 1 from public.booking_trips t
           where t.booking_id = l.booking_id and t.arrived_at is not null
         ),
         (select count(*)::integer from public.looks p
           where p.barber_id = l.barber_id and p.status in ('confirmed', 'published')),
         array(select ph.storage_path from public.look_photos ph where ph.look_id = l.id order by ph.position)
  from viewer v
  join public.looks l on l.status = 'published'
  join public.barber_public_profile bp
    on bp.barber_id = l.barber_id and bp.approved and lower(btrim(bp.city)) = v.city
  left join public.services sv on sv.id = l.service_id
  left join public.reviews r on r.booking_id = l.booking_id
  where not private.is_blocked_between(v.id, l.barber_id)
    and (p_look_id is null or l.id = p_look_id)
    and (p_style is null or p_style = any(l.styles))
    and (p_before is null or l.consented_at < p_before)
  order by l.consented_at desc, l.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$function$;

create or replace function public.attach_look_reference(p_booking_id uuid, p_look_id uuid, p_style text)
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
  -- The look must be one the caller can see in the feed, by the booked barber.
  if p_look_id is not null and not exists (
    select 1 from public.looks_feed(null, null, 1, p_look_id) f
    where f.barber_id = v_booking.barber_id
  ) then
    raise exception 'look not found' using errcode = 'P0002';
  end if;
  insert into public.look_references (booking_id, customer_id, look_id, style)
  values (p_booking_id, v_uid, p_look_id, p_style)
  returning * into v_row;
  return v_row;
end;
$function$;

revoke all on function public.looks_feed(text, timestamptz, integer, uuid) from public, anon;
revoke all on function public.attach_look_reference(uuid, uuid, text) from public, anon;
grant execute on function public.looks_feed(text, timestamptz, integer, uuid) to authenticated;
grant execute on function public.attach_look_reference(uuid, uuid, text) to authenticated;
