-- Barber directory without a SECURITY DEFINER view (hardening 2026-10-26).
--
-- barber_directory joined owner-only tables (users, barber_location) and so
-- had to run with the view owner's rights (0031 tried security_invoker and
-- 20260927130015 reverted it because discovery went empty). That is
-- Supabase lint 0010 (ERROR) and a standing risk: any column added to the
-- view's joins is one edit away from leaking.
--
-- barber_public_profile is a projection that holds ONLY the public fields
-- and the fuzzed display point, never email, phone, exact coordinates or
-- the street address. Triggers on its three sources keep it current; the
-- view now runs as the caller (security_invoker) over that table alone, and
-- also hides any barber the caller has blocked or been blocked by.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.barber_public_profile (
  barber_id uuid primary key references public.users(id) on delete cascade,
  name text,
  city text,
  country text,
  profile_image text,
  bio text,
  rating numeric not null default 0,
  verified boolean not null default false,
  approved boolean not null default false,
  display_latitude double precision,
  display_longitude double precision,
  updated_at timestamptz not null default now()
);

create index barber_public_profile_approved_city_idx
  on public.barber_public_profile (lower(btrim(city)))
  where approved;

alter table public.barber_public_profile enable row level security;
revoke all on public.barber_public_profile from public, anon, authenticated;
grant select on public.barber_public_profile to authenticated;

create policy barber_public_profile_select_approved_or_own
  on public.barber_public_profile for select to authenticated
  using (approved or barber_id = (select auth.uid()));

create or replace function private.sync_barber_public_profile(p_barber_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.users u
    join public.barber_profile bp on bp.user_id = u.id
    where u.id = p_barber_id
  ) then
    delete from public.barber_public_profile where barber_id = p_barber_id;
    return;
  end if;

  insert into public.barber_public_profile as t (
    barber_id, name, city, country, profile_image, bio, rating, verified,
    approved, display_latitude, display_longitude, updated_at
  )
  select u.id, u.name, u.city, u.country, u.profile_image, bp.bio, bp.rating,
         bp.verified, bp.verification_status = 'approved',
         bl.display_latitude, bl.display_longitude, now()
  from public.users u
  join public.barber_profile bp on bp.user_id = u.id
  left join public.barber_location bl on bl.user_id = u.id
  where u.id = p_barber_id
  on conflict (barber_id) do update set
    name = excluded.name,
    city = excluded.city,
    country = excluded.country,
    profile_image = excluded.profile_image,
    bio = excluded.bio,
    rating = excluded.rating,
    verified = excluded.verified,
    approved = excluded.approved,
    display_latitude = excluded.display_latitude,
    display_longitude = excluded.display_longitude,
    updated_at = excluded.updated_at;
end;
$function$;

create or replace function private.on_barber_source_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_name = 'users' then
    if tg_op = 'DELETE' then
      perform private.sync_barber_public_profile(old.id);
    else
      perform private.sync_barber_public_profile(new.id);
    end if;
  elsif tg_op = 'DELETE' then
    perform private.sync_barber_public_profile(old.user_id);
  else
    perform private.sync_barber_public_profile(new.user_id);
  end if;
  return null;
end;
$function$;

revoke all on function private.sync_barber_public_profile(uuid) from public, anon, authenticated;
revoke all on function private.on_barber_source_change() from public, anon, authenticated;

create trigger trg_sync_barber_public_profile
  after insert or update of name, city, country, profile_image or delete on public.users
  for each row execute function private.on_barber_source_change();
create trigger trg_sync_barber_public_profile
  after insert or update or delete on public.barber_profile
  for each row execute function private.on_barber_source_change();
create trigger trg_sync_barber_public_profile
  after insert or update of display_latitude, display_longitude or delete on public.barber_location
  for each row execute function private.on_barber_source_change();

select private.sync_barber_public_profile(bp.user_id) from public.barber_profile bp;

drop view public.barber_directory;
create view public.barber_directory
with (security_invoker = true)
as
select p.barber_id as id,
       p.name,
       p.city,
       p.country,
       p.profile_image,
       p.bio,
       p.rating,
       p.verified,
       p.display_latitude,
       p.display_longitude
from public.barber_public_profile p
where p.approved
  and not public.is_blocked_between((select auth.uid()), p.barber_id);

revoke all on public.barber_directory from public, anon, authenticated;
grant select on public.barber_directory to authenticated;
