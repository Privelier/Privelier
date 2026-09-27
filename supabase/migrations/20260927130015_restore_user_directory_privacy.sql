-- Keep private user rows owner/admin-only. Cross-user barber discovery uses
-- the explicitly allowlisted, approved-only directory view.
drop policy if exists users_select_own_or_admin_or_approved_barber on public.users;
drop policy if exists users_select_own_or_admin on public.users;

create policy users_select_own_or_admin
  on public.users for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin());

revoke all on table public.users from public, anon, authenticated;
grant select, insert, update on table public.users to authenticated;

-- The directory view only exposes its fixed safe projection and approved
-- rows. Owner privileges are required for its joins to owner-only records.
alter view public.barber_directory reset (security_invoker);
