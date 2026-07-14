/**
 * Pure unread-state logic (step 15-16 follow-on, design:
 * docs/design/step-15-16-unread-indicator-design.md). No I/O — the provider
 * hook feeds it RLS-scoped rows; these functions are the unit-tested core.
 *
 * A room is UNREAD ⇔ its latest known message exists, was sent by the
 * counterpart (own messages never count), and is newer than the caller's
 * last_read_at (no read-state row = never opened = unread). Comparisons are
 * ISO-8601 string comparisons, valid because every timestamp comes from the
 * same Postgres column family (timestamptz serialized in UTC).
 */

/** The three columns of a message the unread computation needs. */
export interface UnreadMessageInput {
  chat_id: string;
  sender_id: string;
  created_at: string;
}

/** One own-row of chat_read_state. */
export interface ReadStateInput {
  chat_id: string;
  last_read_at: string;
}

/** Latest message per room — shared by the compute and the provider. */
export function latestMessageByRoom(
  messages: UnreadMessageInput[]
): Map<string, UnreadMessageInput> {
  const latest = new Map<string, UnreadMessageInput>();
  for (const m of messages) {
    const current = latest.get(m.chat_id);
    if (!current || m.created_at > current.created_at) latest.set(m.chat_id, m);
  }
  return latest;
}

export function computeUnreadRoomIds(params: {
  roomIds: string[];
  messages: UnreadMessageInput[];
  readStates: ReadStateInput[];
  myId: string;
}): Set<string> {
  const { roomIds, messages, readStates, myId } = params;
  const latest = latestMessageByRoom(messages);
  const lastReadByRoom = new Map(readStates.map((r) => [r.chat_id, r.last_read_at]));

  const unread = new Set<string>();
  for (const roomId of roomIds) {
    const m = latest.get(roomId);
    if (!m) continue; // no messages — nothing to be unread
    if (m.sender_id === myId) continue; // own message never unread
    const lastRead = lastReadByRoom.get(roomId);
    if (lastRead === undefined || m.created_at > lastRead) unread.add(roomId);
  }
  return unread;
}

/**
 * The timestamp to write when marking a room read, or null for "write
 * nothing". The marker is the newest KNOWN message's server-generated
 * timestamp — never the device clock (realtime-optimizer finding M1,
 * 2026-07-14): since migration 0017 the marker is a counterpart-visible
 * receipt, and a device clock running AHEAD would stamp a future marker
 * that "reads" messages sent after the reader left — a fabricated receipt.
 * Pinning to the newest seen message is immune to skew in both directions:
 * it claims exactly "I have seen everything up to this message", which is
 * what a receipt means.
 *
 * Empty room ⇒ null ⇒ no write: there is nothing to have read, no unread
 * computation needs the row to exist (no message ⇒ never unread), and any
 * future first message must post-date an honest marker anyway.
 */
export function resolveReadMarker(latestMessageIso: string | null): string | null {
  return latestMessageIso;
}
