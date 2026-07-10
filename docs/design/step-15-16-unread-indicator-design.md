# Design note — unread-message indicator (Step 15-16 follow-on, founder-directed 2026-07-10)

**Feature:** per-user unread state for chat: tab badge (Inbox / Chats), bold unread thread rows, mark-as-read on opening the specific conversation, realtime badge updates anywhere in the app.
**Hard constraint (founder):** personal/private read-state only — the counterpart must never be able to see it. Read receipts remain intentionally excluded.
**Pipeline:** schema change → supabase-schema-architect migration; realtime surface → supabase-realtime-optimizer review; new RLS → security-audit pass. None skipped.

## 1. Schema (migration 0014)

New table — chosen over `chat_rooms` columns (`customer_last_read_at`/`barber_last_read_at`) because per-role columns would need an UPDATE policy on `chat_rooms` (none exists today, deliberately) plus a column-freeze trigger to stop a participant editing the other's column; a separate own-row table needs neither:

```sql
create table public.chat_read_state (
  chat_id      uuid not null references public.chat_rooms(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
```

**RLS (privacy is the point):** SELECT `user_id = auth.uid()` — strictly own rows, so the counterpart cannot read your state (this single policy is what makes it private-not-receipts). INSERT/UPDATE `with check`: `user_id = auth.uid()` AND participant-of-room EXISTS against `chat_rooms` (prevents planting rows on rooms you're not in, and prevents an UPDATE re-pointing a row at such a room). No DELETE policy. Table grants: select/insert/update to `authenticated` only (no delete), everything revoked from anon/public.

**Not in the realtime publication.** Read state syncs across the user's own devices only via refetch (MVP has one device per user); publishing it adds a channel for no current need.

**Absent row = never opened** ⇒ thread is unread iff it has any counterpart message. No backfill: pre-existing conversations start "unread" until first opened — true, and self-heals on first tap.

## 2. Unread semantics (pure, unit-tested)

A room is unread ⇔ its latest message exists, `sender_id ≠ me`, and `created_at > last_read_at` (or no read-state row). Own messages never make a room unread.

**Clock-skew guard:** mark-read writes `last_read_at = max(device now, newest known message's created_at)`. Message timestamps are server-generated; a device clock running behind would otherwise mark "read" with a timestamp *older* than the message just read, leaving it unread forever. Pure helper `resolveReadMarker(nowIso, latestMessageIso)`, unit-tested.

## 3. Runtime architecture (copies the step 13-14/15-16 realtime shape)

One **unread provider** per app (thin `UnreadContext` wrappers over a shared `useUnreadThreads` hook), mounted at the navigator root so tabs, thread lists, and conversation screens all see one source of truth:

- **Baseline:** three RLS-scoped reads — `chat_rooms` (ids + participants), `chat_read_state` (own rows), `messages` newest-first capped at 200 (same cap and caveat as the inbox preview scan) — folded through the pure compute into `unreadRoomIds: Set<string>`. Best-effort: a failed baseline degrades to "no badge", never an error screen.
- **Live:** ONE app-level `postgres_changes` INSERT subscription on `messages` with **no server-side filter** — RLS-on-WAL already scopes delivery to rooms the user participates in, which is exactly the requirement ("badge updates while elsewhere in the app"). Same F1 recovery (`onRecovered` → baseline refetch) and CLOSED-is-cleanup semantics as the other two channels. Channel count per signed-in app: bookings (focused tab) + this + at most one focused conversation.
- **Active room:** the conversation screen calls `setActiveRoom(room.id)` on focus / `null` on blur — nothing else. The provider owns mark-as-read: it fires on `setActiveRoom` (opening the specific conversation — the founder's trigger, NOT thread-list load) and again whenever an INSERT for the active room arrives (you're looking at it). Events for non-active rooms from other senders add to the unread set.
- **UI:** `tabBarBadge = unread thread count` on Inbox/Chats (count, not dot — real information, still calm); thread rows render name/preview in the bold face when `unreadRoomIds.has(room.id)`. Both apps, same pattern.

## 4. Honesty notes

- Badge/bold derive only from real rows and timestamps; nothing is fabricated or approximated except the documented 200-message scan cap (a room whose newest message fell outside the cap degrades to "not unread" — same degradation the inbox preview already accepts). The cap also bounds the clock-skew guard in the OTHER direction (review finding L3): the focus-time marker is computed from the newest *known* message, so a device clock behind the server combined with a newest message outside the cap can re-flag an already-read room after a restart — rare (needs both conditions), transient (self-heals on next open), and tracked in the backlog with the optional fix (conversation screens feeding their fully-loaded newest message back to the provider).
- Mark-as-read failing (offline) degrades silently: the room un-bolds locally for the session and re-appears unread after a restart until a successful write — imperfect but truthful; no fake persistence.
- The counterpart-visible surface is unchanged: no receipts, no presence, no typing.
