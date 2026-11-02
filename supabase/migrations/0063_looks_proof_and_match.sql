-- Looks slice S2: proof looks and look match (docs/genius/LOOKS.md B1/B2,
-- review fixes in docs/genius/LOOKS_REVIEW.md).
--
-- Proof look: after a COMPLETED booking the barber picks 1-3 photos from the
-- system photo picker (no camera permission), tags 1-3 styles, confirms that
-- no face is recognizable (L1: never faces) and sends it to the customer.
-- The customer answers "is this your cut?" and, separately, "may it be
-- shown?":
--   draft      barber editing (submitted_at null) or awaiting the customer
--   confirmed  the customer's cut, not shown (still counts as proof)
--   published  the customer's cut, shown (consent time + version recorded)
--   declined   not the customer's cut (never counts)
--   withdrawn  taken back by the customer or the barber (never counts)
-- An unanswered draft expires after looks_settings.draft_valid_days.
--
-- Look match: one verdict per completed booking (exact / close / miss),
-- written only by that booking's customer, for a style the CUSTOMER picks
-- (the barber cannot re-tag a miss, LOOKS_REVIEW X6). The hit rate counts
-- only "exact" (L7) and stays hidden below min_feedback_for_rate (L6).
--
-- Everything is gated server-side by private.flag_enabled('looks') (0062):
-- with the flag off, reads return nothing and writes raise 42501.
-- Clients get SELECT on their own rows; every write goes through a SECURITY
-- DEFINER function below. Storage objects cannot be deleted from SQL, so
-- photo files are removed by the app (best effort) and by the delete-account
-- Edge Function; RLS hides any leftover file.

-- ---------------------------------------------------------------------------
-- 1. Settings (one row, change with UPDATE in the SQL editor)
-- ---------------------------------------------------------------------------
create table private.looks_settings (
  id boolean primary key default true check (id),
  min_feedback_for_rate integer not null default 5 check (min_feedback_for_rate between 1 and 100),
  draft_valid_days integer not null default 14 check (draft_valid_days between 1 and 90),
  capture_window_days integer not null default 30 check (capture_window_days between 1 and 365),
  max_photos_per_look integer not null default 3 check (max_photos_per_look between 1 and 6),
  consent_version text not null default 'looks-placeholder-1' check (consent_version <> '')
);
alter table private.looks_settings enable row level security;
revoke all on private.looks_settings from public, anon, authenticated;
insert into private.looks_settings default values;

create or replace function private.assert_looks_enabled()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.flag_enabled('looks') then
    raise exception 'Looks are not available' using errcode = '42501';
  end if;
end;
$function$;
revoke all on function private.assert_looks_enabled() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Styles (fixed list, maintained by migration)
-- ---------------------------------------------------------------------------
create table public.look_styles (
  key text primary key check (key ~ '^[a-z][a-z_]{1,30}$'),
  label_en text not null,
  label_de text not null,
  sort_order smallint not null,
  active boolean not null default true
);
insert into public.look_styles (key, label_en, label_de, sort_order) values
  ('skin_fade', 'Skin fade', 'Skin Fade', 1),
  ('low_fade', 'Low fade', 'Low Fade', 2),
  ('taper', 'Taper', 'Taper', 3),
  ('buzz', 'Buzz cut', 'Buzz Cut', 4),
  ('crop', 'Crop', 'Crop', 5),
  ('mullet', 'Mullet', 'Mullet', 6),
  ('scissor_cut', 'Scissor cut', 'Scherenschnitt', 7),
  ('beard_line', 'Beard line-up', 'Bart-Kontur', 8),
  ('full_beard', 'Full beard', 'Bart voll', 9);

alter table public.look_styles enable row level security;
revoke all on public.look_styles from public, anon, authenticated;
grant select on public.look_styles to authenticated;
create policy look_styles_select_flag on public.look_styles
  for select to authenticated
  using ((select private.flag_enabled('looks')));

create or replace function private.valid_look_styles(p_styles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_styles is not null
     and cardinality(p_styles) between 1 and 3
     and cardinality(p_styles) = (select count(distinct s) from unnest(p_styles) s)
     and not exists (
       select 1 from unnest(p_styles) s
       where not exists (select 1 from public.look_styles ls where ls.key = s and ls.active)
     );
$function$;
revoke all on function private.valid_look_styles(text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Looks and their photos
-- ---------------------------------------------------------------------------
create table public.looks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  barber_id uuid not null references public.users(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  styles text[] not null check (cardinality(styles) between 1 and 3),
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'published', 'declined', 'withdrawn')),
  no_face_confirmed boolean not null default false,
  submitted_at timestamptz,
  responded_at timestamptz,
  consented_at timestamptz,
  consent_version text,
  consent_withdrawn_at timestamptz,
  withdrawn_at timestamptz,
  withdrawn_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint looks_parties_distinct check (barber_id <> customer_id),
  constraint looks_submitted_without_face check (submitted_at is null or no_face_confirmed),
  constraint looks_answered_after_submit check (status = 'draft' or submitted_at is not null),
  constraint looks_published_has_consent check (
    status <> 'published' or (consented_at is not null and consent_version is not null)
  )
);
create index looks_barber_status_idx on public.looks (barber_id, status);
create index looks_customer_idx on public.looks (customer_id);
create index looks_published_recent_idx on public.looks (consented_at desc) where status = 'published';

create table public.look_photos (
  id uuid primary key default gen_random_uuid(),
  look_id uuid not null references public.looks(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 200),
  position smallint not null check (position between 1 and 6),
  created_at timestamptz not null default now(),
  unique (look_id, position)
);

alter table public.looks enable row level security;
alter table public.look_photos enable row level security;
revoke all on public.looks from public, anon, authenticated;
revoke all on public.look_photos from public, anon, authenticated;
grant select on public.looks to authenticated;
grant select on public.look_photos to authenticated;

-- The barber sees their own looks; the customer sees a look once it was sent
-- to them. Published looks reach other customers only through the feed
-- function (slice S3), never through this table.
create policy looks_select_participants on public.looks
  for select to authenticated
  using (
    (select private.flag_enabled('looks'))
    and (
      barber_id = (select auth.uid())
      or (customer_id = (select auth.uid()) and submitted_at is not null)
    )
  );

create policy look_photos_select_participants on public.look_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.looks l
      where l.id = look_photos.look_id
        and (select private.flag_enabled('looks'))
        and (
          l.barber_id = (select auth.uid())
          or (l.customer_id = (select auth.uid()) and l.submitted_at is not null)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Look match (one verdict per completed booking)
-- ---------------------------------------------------------------------------
create table public.look_feedback (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  barber_id uuid not null references public.users(id) on delete cascade,
  -- Kept without the customer after account deletion, like review stars (0057).
  customer_id uuid references public.users(id) on delete set null,
  style text not null references public.look_styles(key),
  verdict text not null check (verdict in ('exact', 'close', 'miss')),
  created_at timestamptz not null default now()
);
create index look_feedback_barber_style_idx on public.look_feedback (barber_id, style);
create index look_feedback_customer_idx on public.look_feedback (customer_id);

alter table public.look_feedback enable row level security;
revoke all on public.look_feedback from public, anon, authenticated;
grant select on public.look_feedback to authenticated;
-- Customers read back their own verdicts; barbers only ever see aggregates.
create policy look_feedback_select_own on public.look_feedback
  for select to authenticated
  using (customer_id = (select auth.uid()) and (select private.flag_enabled('looks')));

-- ---------------------------------------------------------------------------
-- 5. Private photo bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('looks', 'looks', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Who may read one stored look photo. Replaced in slice S3 to add the
-- published-look audience.
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
      and l.customer_id = (select auth.uid())
      and l.submitted_at is not null
      and (
        l.status in ('confirmed', 'published')
        or (l.status = 'draft' and l.submitted_at > now() - make_interval(days => s.draft_valid_days))
      )
  );
$function$;
revoke all on function private.can_view_look_photo(text) from public, anon;
grant execute on function private.can_view_look_photo(text) to authenticated;

-- The customer may remove the files of a look they declined, withdrew or
-- chose not to show (data minimization).
create or replace function private.can_remove_look_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.look_photos p
    join public.looks l on l.id = p.look_id
    where p.storage_path = p_name
      and l.customer_id = (select auth.uid())
      and l.status in ('confirmed', 'declined', 'withdrawn')
  );
$function$;
revoke all on function private.can_remove_look_photo(text) from public, anon;
grant execute on function private.can_remove_look_photo(text) to authenticated;

create policy looks_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'looks'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.has_role('barber'::public.user_role)
    and private.flag_enabled('looks')
    and private.storage_object_count('looks', (select auth.uid())) < 300
  );

create policy looks_select_own_or_allowed on storage.objects
  for select to authenticated
  using (
    bucket_id = 'looks'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text
        and private.has_role('barber'::public.user_role))
      or private.can_view_look_photo(name)
    )
  );

create policy looks_delete_own_or_customer on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'looks'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text
        and private.has_role('barber'::public.user_role))
      or private.can_remove_look_photo(name)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Barber writes
-- ---------------------------------------------------------------------------
create or replace function public.create_look_draft(p_booking_id uuid, p_styles text[], p_no_face boolean)
returns public.looks
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_booking public.bookings;
  v_look public.looks;
begin
  perform private.assert_looks_enabled();
  if not private.has_role('barber'::public.user_role) then
    raise exception 'only barbers capture looks' using errcode = '42501';
  end if;
  perform private.consume_rate('look_draft:' || v_uid, 30, 3600);

  select b.* into v_booking
  from public.bookings b
  cross join private.looks_settings s
  where b.id = p_booking_id
    and b.barber_id = v_uid
    and b.customer_id is not null
    and b.status = 'completed'
    and b.date >= current_date - s.capture_window_days;
  if not found then
    raise exception 'completed booking not found' using errcode = 'P0002';
  end if;
  if private.is_blocked_between(v_uid, v_booking.customer_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not private.valid_look_styles(p_styles) then
    raise exception 'pick one to three styles' using errcode = '22023';
  end if;

  insert into public.looks as l (booking_id, barber_id, customer_id, service_id, styles, no_face_confirmed)
  values (v_booking.id, v_uid, v_booking.customer_id, v_booking.service_id, p_styles, coalesce(p_no_face, false))
  on conflict (booking_id) do update
    set styles = excluded.styles,
        no_face_confirmed = excluded.no_face_confirmed,
        updated_at = now()
    where l.status = 'draft' and l.submitted_at is null
  returning * into v_look;
  if v_look.id is null then
    raise exception 'this look was already sent' using errcode = 'P0001';
  end if;
  return v_look;
end;
$function$;

create or replace function public.add_look_photo(p_look_id uuid, p_storage_path text)
returns public.look_photos
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_max integer;
  v_count integer;
  v_photo public.look_photos;
begin
  perform private.assert_looks_enabled();
  perform private.consume_rate('look_photo:' || v_uid, 60, 3600);
  if not exists (
    select 1 from public.looks l
    where l.id = p_look_id and l.barber_id = v_uid and l.status = 'draft' and l.submitted_at is null
  ) then
    raise exception 'draft not found' using errcode = 'P0002';
  end if;
  if p_storage_path is null
     or p_storage_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,120}$')
     or not exists (select 1 from storage.objects o where o.bucket_id = 'looks' and o.name = p_storage_path) then
    raise exception 'upload the photo first' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('look_photos:' || p_look_id, 0));
  select s.max_photos_per_look into v_max from private.looks_settings s;
  select count(*) into v_count from public.look_photos p where p.look_id = p_look_id;
  if v_count >= v_max then
    raise exception 'Limit reached for look_photos' using errcode = 'PA002';
  end if;

  insert into public.look_photos (look_id, storage_path, position)
  values (
    p_look_id,
    p_storage_path,
    (select coalesce(max(p.position), 0) + 1 from public.look_photos p where p.look_id = p_look_id)
  )
  returning * into v_photo;
  return v_photo;
end;
$function$;

create or replace function public.remove_look_photo(p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_looks_enabled();
  delete from public.look_photos p
  using public.looks l
  where p.id = p_photo_id
    and l.id = p.look_id
    and l.barber_id = (select auth.uid())
    and l.status = 'draft'
    and l.submitted_at is null;
  if not found then
    raise exception 'photo not found' using errcode = 'P0002';
  end if;
end;
$function$;

create or replace function public.submit_look(p_look_id uuid)
returns public.looks
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_look public.looks;
begin
  perform private.assert_looks_enabled();
  update public.looks l
     set submitted_at = now(), updated_at = now()
   where l.id = p_look_id
     and l.barber_id = (select auth.uid())
     and l.status = 'draft'
     and l.submitted_at is null
     and l.no_face_confirmed
     and exists (select 1 from public.look_photos p where p.look_id = l.id)
     and not private.is_blocked_between(l.barber_id, l.customer_id)
  returning * into v_look;
  if v_look.id is null then
    raise exception 'add a photo and confirm that no face is visible' using errcode = 'P0001';
  end if;
  return v_look;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Customer answers
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_look(p_look_id uuid, p_is_mine boolean, p_show boolean)
returns public.looks
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_look public.looks;
begin
  perform private.assert_looks_enabled();
  perform private.consume_rate('look_respond:' || v_uid, 30, 3600);
  update public.looks l
     set status = case
           when not coalesce(p_is_mine, false) then 'declined'
           when coalesce(p_show, false) then 'published'
           else 'confirmed'
         end,
         responded_at = now(),
         consented_at = case when coalesce(p_is_mine, false) and coalesce(p_show, false) then now() end,
         consent_version = case when coalesce(p_is_mine, false) and coalesce(p_show, false) then s.consent_version end,
         updated_at = now()
    from private.looks_settings s
   where l.id = p_look_id
     and l.customer_id = v_uid
     and l.status = 'draft'
     and l.submitted_at > now() - make_interval(days => s.draft_valid_days)
  returning l.* into v_look;
  if v_look.id is null then
    raise exception 'this look can no longer be answered' using errcode = 'P0001';
  end if;
  return v_look;
end;
$function$;

-- 'hide': the customer stops showing a published look (it still counts).
-- 'withdraw': the customer or the barber takes a look back entirely.
create or replace function public.withdraw_look(p_look_id uuid, p_mode text)
returns public.looks
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_look public.looks;
begin
  perform private.assert_looks_enabled();
  if p_mode = 'hide' then
    update public.looks l
       set status = 'confirmed', consent_withdrawn_at = now(), updated_at = now()
     where l.id = p_look_id and l.customer_id = v_uid and l.status = 'published'
    returning * into v_look;
  elsif p_mode = 'withdraw' then
    update public.looks l
       set status = 'withdrawn', withdrawn_at = now(), withdrawn_by = v_uid,
           consent_withdrawn_at = case when l.status = 'published' then now() else l.consent_withdrawn_at end,
           updated_at = now()
     where l.id = p_look_id
       and v_uid in (l.customer_id, l.barber_id)
       and l.status in ('confirmed', 'published')
    returning * into v_look;
  else
    raise exception 'unknown mode' using errcode = '22023';
  end if;
  if v_look.id is null then
    raise exception 'look not found' using errcode = 'P0002';
  end if;
  return v_look;
end;
$function$;

create or replace function public.submit_look_feedback(p_booking_id uuid, p_style text, p_verdict text)
returns public.look_feedback
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_barber uuid;
  v_row public.look_feedback;
begin
  perform private.assert_looks_enabled();
  if not private.has_role('customer'::public.user_role) then
    raise exception 'only customers rate a look' using errcode = '42501';
  end if;
  perform private.consume_rate('look_feedback:' || v_uid, 30, 3600);
  select b.barber_id into v_barber
  from public.bookings b
  where b.id = p_booking_id and b.customer_id = v_uid and b.status = 'completed' and b.barber_id is not null;
  if v_barber is null then
    raise exception 'completed booking not found' using errcode = 'P0002';
  end if;
  if p_verdict is null or p_verdict not in ('exact', 'close', 'miss')
     or not private.valid_look_styles(array[p_style]) then
    raise exception 'invalid look feedback' using errcode = '22023';
  end if;
  insert into public.look_feedback (booking_id, barber_id, customer_id, style, verdict)
  values (p_booking_id, v_barber, v_uid, p_style, p_verdict)
  returning * into v_row;
  return v_row;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Per-style stats for one barber (approved or own; never across a block)
-- ---------------------------------------------------------------------------
create or replace function public.barber_look_stats(p_barber_id uuid)
returns table (
  style text,
  label_en text,
  label_de text,
  feedback_count integer,
  exact_count integer,
  close_count integer,
  hit_rate numeric,
  proof_count integer
)
language sql
stable
security definer
set search_path = ''
as $function$
  with allowed as (
    select 1
    where private.flag_enabled('looks')
      and not private.is_blocked_between((select auth.uid()), p_barber_id)
      and (
        p_barber_id = (select auth.uid())
        or exists (
          select 1 from public.barber_public_profile bp
          where bp.barber_id = p_barber_id and bp.approved
        )
      )
  ),
  feedback as (
    select f.style,
           count(*)::integer as total,
           (count(*) filter (where f.verdict = 'exact'))::integer as exact_n,
           (count(*) filter (where f.verdict = 'close'))::integer as close_n
    from public.look_feedback f, allowed
    where f.barber_id = p_barber_id
    group by f.style
  ),
  proofs as (
    select s.style, count(*)::integer as total
    from public.looks l, allowed, unnest(l.styles) as s(style)
    where l.barber_id = p_barber_id and l.status in ('confirmed', 'published')
    group by s.style
  )
  select ls.key,
         ls.label_en,
         ls.label_de,
         coalesce(f.total, 0),
         coalesce(f.exact_n, 0),
         coalesce(f.close_n, 0),
         case when coalesce(f.total, 0) >= cfg.min_feedback_for_rate
              then round(f.exact_n::numeric / f.total, 2) end,
         coalesce(p.total, 0)
  from public.look_styles ls
  cross join private.looks_settings cfg
  left join feedback f on f.style = ls.key
  left join proofs p on p.style = ls.key
  where coalesce(f.total, 0) > 0 or coalesce(p.total, 0) > 0
  order by ls.sort_order;
$function$;

revoke all on function public.create_look_draft(uuid, text[], boolean) from public, anon;
revoke all on function public.add_look_photo(uuid, text) from public, anon;
revoke all on function public.remove_look_photo(uuid) from public, anon;
revoke all on function public.submit_look(uuid) from public, anon;
revoke all on function public.respond_to_look(uuid, boolean, boolean) from public, anon;
revoke all on function public.withdraw_look(uuid, text) from public, anon;
revoke all on function public.submit_look_feedback(uuid, text, text) from public, anon;
revoke all on function public.barber_look_stats(uuid) from public, anon;
grant execute on function public.create_look_draft(uuid, text[], boolean) to authenticated;
grant execute on function public.add_look_photo(uuid, text) to authenticated;
grant execute on function public.remove_look_photo(uuid) to authenticated;
grant execute on function public.submit_look(uuid) to authenticated;
grant execute on function public.respond_to_look(uuid, boolean, boolean) to authenticated;
grant execute on function public.withdraw_look(uuid, text) to authenticated;
grant execute on function public.submit_look_feedback(uuid, text, text) to authenticated;
grant execute on function public.barber_look_stats(uuid) to authenticated;
