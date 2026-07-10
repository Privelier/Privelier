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
 * The timestamp to write when marking a room read: the LATER of device time
 * and the newest known message's (server-generated) timestamp. Message
 * timestamps come from the server clock; a device clock running behind would
 * otherwise stamp a marker OLDER than the message just read, leaving it
 * unread forever. String max is valid for same-format UTC ISO strings.
 */
export function resolveReadMarker(nowIso: string, latestMessageIso: string | null): string {
  if (latestMessageIso !== null && latestMessageIso > nowIso) return latestMessageIso;
  return nowIso;
}
