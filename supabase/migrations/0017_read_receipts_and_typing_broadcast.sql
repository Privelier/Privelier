-- Chat read receipts + typing indicator (founder-directed 2026-07-14).
-- Design approved: docs/design/chat-read-receipts-typing-design-approval.md
-- (decisions D1-D4 are implemented precisely here; D5/D6 are app-side).
--
-- DECISION REVERSAL ON RECORD: migration 0014's header documented
-- chat_read_state as private read-state, "deliberately NOT read receipts."
-- The founder reversed that stance on 2026-07-14 by requesting this feature;
-- the design doc above is the paper trail. This migration widens exactly one
-- policy to make the reversal real -- nothing else about 0014 changes.
--
-- KEY DECISIONS (do not "optimise" these away without founder sign-off):
--
--  1. WIDENED SELECT, not an RPC (design D1). The 0012 narrow-RPC precedent
--     cannot work here because postgres_changes delivery is RLS-on-WAL: a
--     subscriber only ever RECEIVES rows their SELECT policy passes, so no
--     RPC can make the counterpart's receipt arrive live. The new policy
--     scopes to room participants via chat_rooms membership -- the exact
--     predicate shape messages_select_participants already uses. The
--     EXPOSURE DELTA IS ONE TIMESTAMP (last_read_at) to exactly ONE
--     counterpart per room; nothing else becomes visible. Write policies
--     (insert/update own-row + membership) and grants are NOT touched --
--     the unread provider remains the sole writer (design C5).
--
--  2. PUBLICATION ADD (design D2): chat_read_state joins supabase_realtime
--     so the counterpart's receipt flips live while the sender is looking at
--     the conversation (poll-on-focus would only update on re-focus).
--     Replica identity stays DEFAULT and that is sufficient: consumed events
--     are INSERT/UPDATE (full new row; the realtime filter column chat_id is
--     in the PK), and DELETE does not occur on this table: no DELETE policy,
--     no DELETE grant, AND -- the actual load-bearing invariant -- parent
--     chat_rooms/bookings rows are never deleted (0014's ON DELETE CASCADE
--     runs as table owner and would bypass grants and policies, so the
--     grant/policy absence alone is NOT the guarantee; realtime-optimizer
--     finding L1, 2026-07-14). If a deletion path is ever introduced,
--     re-review this section. So the F5 filtered-DELETE trap does not apply.
--     The add is guarded against re-run (ALTER PUBLICATION ... ADD TABLE
--     errors on duplicates).
--
--  3. PRIVATE BROADCAST AUTHORIZATION (design D4): typing uses a private
--     Realtime broadcast channel with topic 'typing:{chat_id}', ephemeral
--     only -- no DB rows, nothing persisted. realtime.messages has RLS
--     enabled and ZERO policies today (live-verified 2026-07-14), so private
--     channels currently deny everyone; the two policies below are the first
--     broadcast authorization in this codebase. Both (receive = SELECT,
--     send = INSERT) require extension = 'broadcast', the 'typing' topic
--     namespace, and room membership.
--
--  4. TEXT COMPARISON, NEVER A UUID CAST, on the topic's room segment:
--     cr.id::text = split_part(realtime.topic(), ':', 2). Casting the topic
--     segment to uuid instead would THROW on any malformed topic and turn a
--     failed predicate into a channel error; the text comparison makes a
--     malformed topic simply fail authorization. Do not "simplify" this.
--
--  5. NAMESPACE PIN: split_part(realtime.topic(), ':', 1) = 'typing' is
--     required in BOTH policies so they can never accidentally authorize a
--     future channel namespace that happens to carry a chat_id-shaped second
--     segment. Any future broadcast feature must add its own policies.
--
--  6. SHIPS TOGETHER WITH THE C1 APP-SIDE GUARD (design C1): under the
--     widened policy of section 1, useUnreadThreads.load()'s previously
--     unfiltered chat_read_state read starts returning counterpart rows and
--     would corrupt computeUnreadRoomIds (two rows per room, insertion order
--     decides -- silent wrong badges). The provider MUST add
--     .eq('user_id', myId); that JS change and this migration land in the
--     same release. No standalone builds exist at MVP, so there is no
--     stale-client window.

-- ============================================================
-- 1. chat_read_state SELECT: own-row -> room participants (D1).
--    The old policy is dropped explicitly; the new one is guarded so
--    re-running is a no-op. INSERT/UPDATE policies and grants untouched.
-- ============================================================

drop policy if exists chat_read_state_select_own on public.chat_read_state;

drop policy if exists chat_read_state_select_participants on public.chat_read_state;
create policy chat_read_state_select_participants
  on public.chat_read_state for select
  using (
    exists (
      select 1 from public.chat_rooms cr
      where cr.id = chat_read_state.chat_id
        and (cr.customer_id = auth.uid() or cr.barber_id = auth.uid())
    )
  );

-- ============================================================
-- 2. Publication membership (D2) -- idempotent: ALTER PUBLICATION ... ADD
--    TABLE errors on duplicates, so guard against pg_publication_tables.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_read_state'
  ) then
    alter publication supabase_realtime add table public.chat_read_state;
  end if;
end $$;

-- ============================================================
-- 3. Private typing-broadcast authorization on realtime.messages (D4).
--    Receive (SELECT) and send (INSERT) are separate policies with the
--    identical predicate: broadcast extension only, 'typing' namespace only,
--    and the topic's second segment must be a room the caller belongs to.
-- ============================================================

drop policy if exists typing_broadcast_recv_participants on realtime.messages;
create policy typing_broadcast_recv_participants
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and split_part(realtime.topic(), ':', 1) = 'typing'
    and exists (
      select 1 from public.chat_rooms cr
      where cr.id::text = split_part(realtime.topic(), ':', 2)
        and (cr.customer_id = auth.uid() or cr.barber_id = auth.uid())
    )
  );

drop policy if exists typing_broadcast_send_participants on realtime.messages;
create policy typing_broadcast_send_participants
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and split_part(realtime.topic(), ':', 1) = 'typing'
    and exists (
      select 1 from public.chat_rooms cr
      where cr.id::text = split_part(realtime.topic(), ':', 2)
        and (cr.customer_id = auth.uid() or cr.barber_id = auth.uid())
    )
  );
