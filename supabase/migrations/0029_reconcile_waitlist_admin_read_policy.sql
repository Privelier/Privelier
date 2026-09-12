-- The waitlist is not part of the current app surface, but the live table may
-- contain founder-owned contact data. Keep it non-public and non-writable while
-- giving authenticated admins an explicit, least-privilege read path.
alter table public.waitlist enable row level security;

drop policy if exists waitlist_admin_select on public.waitlist;
create policy waitlist_admin_select
  on public.waitlist
  for select
  to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.waitlist from anon, authenticated;
