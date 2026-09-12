-- Pair the admin-only RLS policy from migration 0029 with the minimum
-- table privilege required for authenticated admins to read waitlist rows.
grant select on public.waitlist to authenticated;
