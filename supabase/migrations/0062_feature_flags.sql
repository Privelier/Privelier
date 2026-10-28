-- Feature flags (Looks, slice S1; docs/genius/LOOKS.md, LOOKS_REVIEW.md P1/X1).
--
-- New features ship dark: nothing is visible until a founder enables a flag
-- for a user in the SQL editor. The flag tables live in `private`, which the
-- Data API does not expose; clients only learn their own enabled keys through
-- public.my_feature_flags(). Server-side code checks private.flag_enabled()
-- itself, so a disabled feature is off for the API too, not just hidden in
-- the app.
--
-- Enable a flag for one person:
--   insert into private.feature_flag_users (flag_key, user_id)
--   select 'looks', id from auth.users where email = '<email>';
-- Enable it for everyone:
--   update private.feature_flags set enabled_for_all = true where key = 'looks';

create table private.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  description text not null default '',
  enabled_for_all boolean not null default false,
  created_at timestamptz not null default now()
);

create table private.feature_flag_users (
  flag_key text not null references private.feature_flags(key) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (flag_key, user_id)
);
create index feature_flag_users_user_idx on private.feature_flag_users (user_id);

alter table private.feature_flags enable row level security;
alter table private.feature_flag_users enable row level security;
revoke all on private.feature_flags from public, anon, authenticated;
revoke all on private.feature_flag_users from public, anon, authenticated;

insert into private.feature_flags (key, description)
values ('looks', 'Looks: proof looks, look match, feed, search, wishes, look pass')
on conflict (key) do nothing;

-- Policy and RPC helper: is this flag on for the signed-in caller?
create or replace function private.flag_enabled(p_key text)
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
        or exists (
          select 1 from private.feature_flag_users u
          where u.flag_key = f.key and u.user_id = (select auth.uid())
        )
      )
  );
$function$;
revoke all on function private.flag_enabled(text) from public, anon;
grant execute on function private.flag_enabled(text) to authenticated;

-- The caller's enabled flag keys, sorted. Unknown or disabled flags are
-- simply absent, so the app treats anything missing as off.
create or replace function public.my_feature_flags()
returns text[]
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(array_agg(f.key order by f.key), '{}'::text[])
  from private.feature_flags f
  where private.flag_enabled(f.key);
$function$;
revoke all on function public.my_feature_flags() from public, anon;
grant execute on function public.my_feature_flags() to authenticated;
