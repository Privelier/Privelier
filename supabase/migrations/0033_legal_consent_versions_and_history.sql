-- Legal consent is server-owned. Clients can request acceptance only through
-- accept_current_legal_consent(); they cannot supply versions or timestamps.
-- placeholder-1 is intentional until the real legal texts are published. Keep
-- this stable sentinel now; changing to the approved published-text version
-- will make every user accept the updated terms and privacy notice.

alter table public.users
  add column if not exists accepted_terms_version text,
  add column if not exists accepted_privacy_version text,
  add column if not exists legal_accepted_at timestamptz,
  add column if not exists adult_confirmed_at timestamptz;

create table if not exists public.legal_current_versions (
  singleton boolean primary key default true check (singleton = true),
  privacy_version text not null,
  customer_terms_version text not null,
  barber_terms_version text not null,
  updated_at timestamptz not null default now()
);

insert into public.legal_current_versions
  (singleton, privacy_version, customer_terms_version, barber_terms_version)
values
  -- This pre-publication version is deliberate; bump it when final legal text
  -- is published so all users are prompted to accept the new version.
  (true, 'placeholder-1', 'placeholder-1', 'placeholder-1')
on conflict (singleton) do nothing;

create table if not exists public.legal_consent_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role user_role not null,
  terms_version text not null,
  privacy_version text not null,
  adult_confirmed boolean not null,
  accepted_at timestamptz not null default now()
);

create index if not exists idx_legal_consent_history_user_id
  on public.legal_consent_history(user_id);

alter table public.legal_current_versions enable row level security;
alter table public.legal_consent_history enable row level security;

drop policy if exists legal_current_versions_authenticated_read on public.legal_current_versions;
create policy legal_current_versions_authenticated_read
  on public.legal_current_versions
  for select to authenticated
  using (true);

drop policy if exists legal_consent_history_own_read on public.legal_consent_history;
create policy legal_consent_history_own_read
  on public.legal_consent_history
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.legal_current_versions from public, anon, authenticated;
grant select on public.legal_current_versions to authenticated;
revoke all on public.legal_consent_history from public, anon, authenticated;
grant select on public.legal_consent_history to authenticated;

-- Keep the existing protected fields and add legal fields. A client update can
-- never change these values, even though it may update other profile fields.
create or replace function public.protect_user_protected_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.role() is distinct from 'service_role'
     and current_setting('privelier.legal_consent_rpc', true) is distinct from 'on' then
    new.role := old.role;
    new.email := old.email;
    new.created_at := old.created_at;
    new.accepted_terms_version := old.accepted_terms_version;
    new.accepted_privacy_version := old.accepted_privacy_version;
    new.legal_accepted_at := old.legal_accepted_at;
    new.adult_confirmed_at := old.adult_confirmed_at;
  end if;
  return new;
end;
$function$;

-- Profile creation must not accept fabricated consent values from a client.
drop policy if exists users_insert_own on public.users;
create policy users_insert_own
  on public.users
  for insert to authenticated
  with check (
    id = (select auth.uid())
    and role in ('customer'::user_role, 'barber'::user_role)
    and accepted_terms_version is null
    and accepted_privacy_version is null
    and legal_accepted_at is null
    and adult_confirmed_at is null
  );

create or replace function public.accept_current_legal_consent(
  p_confirmed_adult boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_role user_role;
  v_privacy_version text;
  v_terms_version text;
  v_adult_confirmed boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select u.role, (u.adult_confirmed_at is not null)
    into v_role, v_adult_confirmed
    from public.users u
   where u.id = v_user_id
   for update;

  if not found or v_role not in ('customer'::user_role, 'barber'::user_role) then
    raise exception 'customer or barber profile required' using errcode = '42501';
  end if;

  if not v_adult_confirmed and coalesce(p_confirmed_adult, false) is not true then
    raise exception 'adult confirmation required' using errcode = '22023';
  end if;

  select privacy_version,
         case when v_role = 'barber'::user_role then barber_terms_version
              else customer_terms_version end
    into v_privacy_version, v_terms_version
    from public.legal_current_versions
   where singleton = true;

  if not found then
    raise exception 'legal versions are not configured' using errcode = 'P0001';
  end if;

  -- The protected-field trigger recognizes this transaction-local marker. It
  -- is set only inside this SECURITY DEFINER function, never by the client.
  perform set_config('privelier.legal_consent_rpc', 'on', true);

  update public.users
     set accepted_terms_version = v_terms_version,
         accepted_privacy_version = v_privacy_version,
         legal_accepted_at = now(),
         adult_confirmed_at = case
           when v_adult_confirmed then adult_confirmed_at
           else now()
         end
   where id = v_user_id;

  insert into public.legal_consent_history
    (user_id, role, terms_version, privacy_version, adult_confirmed, accepted_at)
  values
    (v_user_id, v_role, v_terms_version, v_privacy_version,
     true, now());
end;
$function$;

revoke execute on function public.accept_current_legal_consent(boolean)
  from public, anon, authenticated;
grant execute on function public.accept_current_legal_consent(boolean)
  to authenticated;

revoke insert, update, delete on public.legal_current_versions
  from public, anon, authenticated;
revoke insert, update, delete on public.legal_consent_history
  from public, anon, authenticated;
