-- Unread-message indicator (step 15-16 follow-on, founder-directed
-- 2026-07-10; design: docs/design/step-15-16-unread-indicator-design.md).
--
-- Per-user, per-room "last read" marker. PRIVACY IS THE POINT: SELECT is
-- strictly own-row (user_id = auth.uid()), so the OTHER participant can
-- never read your state — this is private read-state, deliberately NOT read
-- receipts (which stay excluded per the project's honesty rule).
--
-- A separate table was chosen over per-role columns on chat_rooms because
-- chat_rooms deliberately has no UPDATE policy at all, and per-role columns
-- would need one plus a column-freeze trigger to stop a participant editing
-- the other's column. Own-row RLS on a dedicated table needs neither.
--
-- An absent row means "never opened this conversation" — the app treats
-- that as unread if any counterpart message exists. No backfill on purpose:
-- pre-existing conversations start unread and self-heal on first open.
--
-- NOT added to the supabase_realtime publication: read state only needs to
-- sync across the same user's devices, which refetch covers at MVP scale.

create table if not exists public.chat_read_state (
  chat_id      uuid not null references public.chat_rooms(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

alter table public.chat_read_state enable row level security;

-- Own rows only — the single policy that makes this private-not-receipts.
drop policy if exists chat_read_state_select_own on public.chat_read_state;
create policy chat_read_state_select_own
  on public.chat_read_state for select
  using (user_id = auth.uid());

-- Writes: own user_id AND actual membership of the room, so a caller can
-- neither plant read-state rows on rooms they are not in, nor (via UPDATE)
-- re-point an existing row at one. The client writes via upsert
-- (INSERT ... ON CONFLICT (chat_id, user_id) DO UPDATE), which is why both
-- INSERT and UPDATE are granted.
drop policy if exists chat_read_state_insert_own on public.chat_read_state;
create policy chat_read_state_insert_own
  on public.chat_read_state for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_rooms cr
      where cr.id = chat_read_state.chat_id
        and (cr.customer_id = auth.uid() or cr.barber_id = auth.uid())
    )
  );

drop policy if exists chat_read_state_update_own on public.chat_read_state;
create policy chat_read_state_update_own
  on public.chat_read_state for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_rooms cr
      where cr.id = chat_read_state.chat_id
        and (cr.customer_id = auth.uid() or cr.barber_id = auth.uid())
    )
  );

-- No DELETE policy (and no DELETE grant below): read state is never removed
-- by clients; rooms cascade it away if they are ever deleted.

-- The PK serves (chat_id, user_id) lookups; the baseline "all MY read
-- state" scan needs the reverse entry point.
create index if not exists idx_chat_read_state_user_id
  on public.chat_read_state (user_id);

-- Grants: mirror the project posture (0006) — anon has no business here at
-- all; authenticated gets exactly select/insert/update, nothing else.
revoke all on public.chat_read_state from public, anon, authenticated;
grant select, insert, update on public.chat_read_state to authenticated;
