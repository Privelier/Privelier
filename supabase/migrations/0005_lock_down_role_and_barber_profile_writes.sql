-- Fix 1: users_insert_own only checked id = auth.uid(), never the role value.
-- users.role is the system-wide trust anchor -- is_admin() and has_role()
-- both read it -- so any authenticated caller could self-provision
-- role='admin' at signup and instantly pass every admin check in every RLS
-- policy. Clients may only ever create themselves as customer or barber;
-- admin rows are created exclusively via service_role (Supabase dashboard).
alter policy users_insert_own on public.users
with check (
  id = auth.uid()
  and role in ('customer'::user_role, 'barber'::user_role)
);

-- Fix 2: users_update_own lets a user update their own row, and nothing
-- stopped them from flipping role after signup (e.g. customer -> admin,
-- reopening the same escalation Fix 1 closes at INSERT time). Freeze the
-- protected columns on UPDATE with the same silent-revert pattern as
-- protect_barber_verification_fields: non-service_role callers keep the old
-- values, the rest of the row updates normally; service_role (a founder, via
-- the dashboard) stays exempt.
--   role       -- the system-wide trust anchor read by is_admin()/has_role().
--   email      -- must mirror auth.users.email; a client-side edit here would
--                 silently desync the two. Any future email-change feature
--                 must sync both via service_role, not this table directly.
--   created_at -- frozen for audit integrity.
-- Deliberately NOT enforced as a role whitelist in users_update_own's
-- WITH CHECK: RLS WITH CHECK evaluates the row after BEFORE triggers run,
-- and a ('customer','barber') whitelist there would reject legitimate
-- self-updates by the founders' admin rows even though this trigger keeps
-- role unchanged.
create or replace function public.protect_user_protected_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    new.role := old.role;
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_user_protected_fields on public.users;
create trigger trg_protect_user_protected_fields
  before update on public.users
  for each row execute function public.protect_user_protected_fields();

-- Trigger function only, never meant to be callable via the PostgREST RPC
-- endpoint; revoking EXECUTE does not affect trigger firing (same rationale
-- as 0002).
revoke execute on function public.protect_user_protected_fields() from public, anon, authenticated;

-- Fix 3: protect_barber_verification_fields only fired on UPDATE, so a barber
-- could INSERT their barber_profile row already carrying verified=true,
-- verification_status='approved', or a fabricated rating -- bypassing manual
-- verification entirely and appearing in customer search immediately. On
-- INSERT from any non-service_role caller, force the admin-owned columns to
-- their untrusted defaults. On UPDATE, keep the existing silent-revert of
-- verified/verification_status and additionally revert rating: rating is
-- derived from reviews and must never be client-writable.
create or replace function public.protect_barber_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.verification_status := 'pending'::verification_status_type;
      new.rating := 0;
    else
      new.verified := old.verified;
      new.verification_status := old.verification_status;
      new.rating := old.rating;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_barber_verification on public.barber_profile;
create trigger trg_protect_barber_verification
  before insert or update on public.barber_profile
  for each row execute function public.protect_barber_verification_fields();
