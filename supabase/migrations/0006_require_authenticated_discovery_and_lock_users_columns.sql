-- Fix (HIGH + MEDIUM, from the Stage-7 security audit on the auth feature;
-- product decision from the founders): "Require authentication for barber
-- discovery. Users must sign in before browsing or searching for barbers.
-- The users table should never expose private fields such as email or
-- phone to anonymous users or other clients." Two problems existed in 0001:
--
--   1. (HIGH) `grant select, insert, update, delete ... to anon,
--      authenticated` (0001:188-192) let the public anon key read every
--      table with zero login -- including `users`, whose
--      `users_select_own_or_admin_or_approved_barber` policy (0001:214-227)
--      let anyone view a *full* row (email, phone, created_at, everything)
--      for any barber once verification_status = 'approved'. That's
--      scrapeable with just the public anon key: a real harassment/spam
--      vector, and it contradicts the "premium, private, trustworthy"
--      positioning.
--   2. (MEDIUM) `alter default privileges ... grant ... to anon,
--      authenticated` (0001:194-195) means any future table that forgets
--      `enable row level security` before this default fires is fully open
--      (read+write, anon+authenticated) rather than failing closed.
--
-- This migration:
--   A. Removes the anon role's entire footprint on public tables/functions.
--      Anon never legitimately reads or writes anything: sign-up/sign-in go
--      through the Supabase Auth API against the `auth` schema (see
--      src/auth/authService.ts), not PostgREST against `public`, and every
--      real table write already required an authenticated auth.uid() to
--      match a row-owner column -- something anon (whose auth.uid() is
--      always null) could never satisfy anyway. This also supersedes the
--      0002 note that "is_admin() is intentionally left executable by
--      anon/authenticated ... If browsing should require login, that's a
--      product/RLS decision to make deliberately" -- that decision has now
--      been made.
--   B. Drops the blanket default-privilege grant so a future migration that
--      forgets to enable RLS on a new table fails closed (no privilege at
--      all) instead of silently opening it to anon+authenticated.
--   C. Column-locks `public.users`: only the row owner or an admin may ever
--      select email/phone/created_at (or any other column) from the base
--      table -- the "approved barber" branch that used to leak full rows is
--      removed outright, not just narrowed.
--   D. Adds `public.barber_directory`, a hand-picked, non-sensitive column
--      projection, as the ONLY discovery surface. It deliberately does NOT
--      include email, phone, created_at, verification_status, or any
--      identity-document field.
--   E. Scopes every discovery-surface RLS policy explicitly `to
--      authenticated` (defense in depth: even if a future migration
--      re-grants anon table access by mistake, the row-level policy itself
--      still refuses the anon role -- the two layers are independent, per
--      the reasoning in each step below).
--
-- Out of scope, deliberately not touched here (CLAUDE.md's "schema is
-- sacred" / "one feature per pipeline run" rules): bookings / chat_rooms /
-- messages / verification_requests RLS *policies* are already
-- participant/owner-scoped via auth.uid() equality (meaningless for anon)
-- and are not part of this finding -- they are not modified beyond the
-- incidental anon GRANT revoke in step A, which changes no policy logic.
-- Migration 0002/0004/0005's role-escalation and verification-tamper
-- trigger fixes are untouched.
--
-- A future migration, during the booking-flow pipeline run (CLAUDE.md
-- build-order step 11-14, not yet built), will need to add a narrow,
-- booking-scoped SELECT policy (or a second view joined through
-- `bookings`) letting two matched participants see each other's
-- email/phone once a booking exists between them. That is intentionally
-- NOT designed or built in this migration -- flagging it here so it is not
-- silently dropped from scope.

-- ============================================================
-- A. Revoke every anon-role table privilege and RPC-callable function
--    privilege. Anon has no legitimate table access left now that
--    discovery requires authentication.
-- ============================================================

revoke select, insert, update, delete on
  public.users, public.barber_profile, public.services, public.availability,
  public.bookings, public.chat_rooms, public.messages, public.portfolio,
  public.reviews, public.verification_requests
from anon;

-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default at function
-- creation time; a plain `revoke ... from anon` does NOT undo that (anon
-- still has execute via the PUBLIC entry, independent of any per-role
-- revoke). Must revoke from `public` itself, then re-grant to
-- `authenticated` only -- the exact pattern 0002 already used for the
-- trigger-only functions.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.has_role(user_role) from public, anon;
grant execute on function public.has_role(user_role) to authenticated;

-- Anon has no remaining reason to even see the schema: every table grant
-- and every RPC-callable function grant above has just been revoked.
revoke usage on schema public from anon;

-- ============================================================
-- B. Drop the blanket default-privilege grant. Future migrations must
--    `enable row level security` AND grant explicitly, per table, per
--    role -- never rely on a default to open a new table.
-- ============================================================

alter default privileges in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

-- ============================================================
-- C. Lock public.users down to owner-or-admin only, with no column-level
--    exception left for anyone else. This removes the "approved barber"
--    branch that used to leak email/phone/created_at to any caller once a
--    barber was approved.
-- ============================================================

drop policy if exists "users_select_own_or_admin_or_approved_barber" on public.users;
drop policy if exists "users_select_own_or_admin" on public.users;
create policy "users_select_own_or_admin"
  on public.users for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
  );

-- Defense in depth: these never depended on the approved-barber branch and
-- their USING/WITH CHECK logic is unchanged, but scope them to
-- `authenticated` explicitly too, so the anon GRANT revoke in step A isn't
-- the only thing stopping an anon caller from reaching them.
alter policy users_insert_own on public.users to authenticated;
alter policy users_update_own on public.users to authenticated;

-- ============================================================
-- D. Public-safe discovery projection. Column allowlist only -- no email,
--    no phone, no created_at, no verification_status, no identity-document
--    field. This view is the ONLY discovery surface; app code (the
--    not-yet-built customer discovery screens, CLAUDE.md build-order step
--    9-10) must query this, never `public.users` directly, for barber
--    listing/search.
--
--    Deliberately created WITHOUT `security_invoker` (Postgres default:
--    the view runs with the view owner's privileges/row-visibility, the
--    same way a SECURITY DEFINER function does). That is intentional here,
--    not an oversight: the view's entire purpose is to show approved
--    barbers to callers who are NEITHER the row owner NOR an admin, i.e. it
--    must bypass the owner-or-admin restriction just added to the base
--    `users`/`barber_profile` tables above. The `where
--    bp.verification_status = 'approved'` clause is the real gate here, not
--    the caller's relationship to the row -- and since the SELECT list
--    below never names email/phone/created_at/verification_status/rating-
--    source columns beyond what's listed, there is no column for a caller
--    to leak even if the WHERE clause were ever loosened by mistake.
-- ============================================================

drop view if exists public.barber_directory;
create view public.barber_directory as
  select
    u.id,
    u.name,
    u.city,
    u.country,
    u.profile_image,
    bp.bio,
    bp.rating
  from public.users u
  join public.barber_profile bp on bp.user_id = u.id
  where bp.verification_status = 'approved';

grant select on public.barber_directory to authenticated;

-- ============================================================
-- E. Scope the remaining discovery-surface tables' existing policies to
--    `authenticated` (same defense-in-depth reasoning as step C -- USING/
--    WITH CHECK expressions are unchanged). barber_profile / services /
--    availability / portfolio / reviews contain no email/phone/created_at
--    columns, so the HIGH column-exposure finding does not apply to them
--    directly -- only the "require login to browse" product decision does.
-- ============================================================

alter policy barber_profile_select_own_or_admin_or_approved on public.barber_profile to authenticated;
alter policy barber_profile_insert_own on public.barber_profile to authenticated;
alter policy barber_profile_update_own on public.barber_profile to authenticated;

alter policy services_select_all on public.services to authenticated;
alter policy services_write_own on public.services to authenticated;

alter policy availability_select_all on public.availability to authenticated;
alter policy availability_write_own on public.availability to authenticated;

alter policy portfolio_select_all on public.portfolio to authenticated;
alter policy portfolio_write_own on public.portfolio to authenticated;

alter policy reviews_select_all on public.reviews to authenticated;
alter policy reviews_insert_own_customer on public.reviews to authenticated;

-- NOTE for whoever builds the reviews UI (not yet built): reviews_select_all
-- still exposes customer_id/barber_id/rating/comment to any authenticated
-- caller, but a reviewer's display name can no longer be joined from
-- `public.users` (owner-or-admin only as of this migration). If a reviewer
-- name/avatar is ever needed, it should come from its own narrow
-- projection (e.g. a `public.customer_public` view exposing only
-- name/profile_image), not from loosening users' SELECT policy again.
