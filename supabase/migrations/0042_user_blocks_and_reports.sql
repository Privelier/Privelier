-- Wave 7 moderation: block and report, enforced in the database.
--
-- user_blocks: a user blocks another user. Only the blocker can see, add or
-- remove their own blocks. Enforcement does not rely on the client:
-- RESTRICTIVE policies on messages and bookings reject a new message or a
-- new booking between two users when either has blocked the other. The
-- check runs through is_blocked_between(), SECURITY DEFINER, so the blocked
-- party is refused without being able to read the blocker's rows.
--
-- user_reports: insert-only for the reporter (who may read their own back);
-- founders review them as admins. No update/delete for clients, so a report
-- cannot be edited or withdrawn after the fact.
--
-- Additive only: existing permissive policies are untouched; RESTRICTIVE
-- policies narrow them.

create table public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

create policy user_blocks_select_own on public.user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy user_blocks_insert_own on public.user_blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy user_blocks_delete_own on public.user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1 from public.user_blocks ub
    where (ub.blocker_id = p_a and ub.blocked_id = p_b)
       or (ub.blocker_id = p_b and ub.blocked_id = p_a)
  );
$function$;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- No new messages across a block (either direction).
create policy messages_insert_not_blocked on public.messages
  as restrictive for insert to authenticated
  with check (
    not exists (
      select 1 from public.chat_rooms cr
      where cr.id = messages.chat_id
        and public.is_blocked_between(cr.customer_id, cr.barber_id)
    )
  );

-- No new booking requests across a block (either direction).
create policy bookings_insert_not_blocked on public.bookings
  as restrictive for insert to authenticated
  with check (not public.is_blocked_between(customer_id, barber_id));

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  reported_id uuid not null references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  reason text not null check (reason in ('harassment', 'safety', 'no_show', 'inappropriate_content', 'fraud', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  constraint user_reports_not_self check (reporter_id <> reported_id)
);
create index user_reports_reported_idx on public.user_reports (reported_id, created_at desc);
create index user_reports_reporter_idx on public.user_reports (reporter_id);

alter table public.user_reports enable row level security;
revoke all on public.user_reports from public, anon, authenticated;
grant select, insert on public.user_reports to authenticated;

create policy user_reports_insert_own on public.user_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    -- A booking reference, when given, must be one the reporter took part in.
    and (
      booking_id is null
      or exists (
        select 1 from public.bookings b
        where b.id = user_reports.booking_id
          and (select auth.uid()) in (b.customer_id, b.barber_id)
          and user_reports.reported_id in (b.customer_id, b.barber_id)
      )
    )
  );
create policy user_reports_select_own_or_admin on public.user_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());
