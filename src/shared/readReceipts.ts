/**
 * Pure read-receipt logic (chat follow-on, founder-directed 2026-07-14;
 * design: docs/design/chat-read-receipts-typing-design-approval.md). No I/O —
 * the hook feeds it RLS-scoped values; these functions are the unit-tested
 * core.
 *
 * COMPARISON IS NUMERIC BY DESIGN (decision D3): the receipt comparison
 * (counterpart `last_read_at` vs own message `created_at`) crosses the
 * PostgREST/Realtime serialization boundary, so ISO-string comparison — valid
 * elsewhere in this codebase for same-source strings — is NOT safe here.
 * `Date.parse` normalizes both variants to epoch ms. Millisecond truncation is
 * safe because `resolveReadMarker` (unread.ts) writes the marker as EXACTLY
 * the newest known message's server-generated `created_at` — the device clock
 * is never consulted (realtime-optimizer finding M1, 2026-07-14: since
 * migration 0017 the marker is a counterpart-visible receipt, and a fast
 * device clock would fabricate one). A marker covering a message is therefore
 * `>=` its timestamp by construction, with equality the normal case.
 *
 * Malformed/unparseable timestamps degrade to "not read" (the honest
 * default: never render a receipt that was not actually established).
 */
import type { MessageRow } from '../types';

/** Epoch ms, or null when the input is absent or unparseable. */
export function parseTimestampMs(iso: string | null | undefined): number | null {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Has the counterpart read a message with this `created_at`? True iff BOTH
 * timestamps parse and the read marker is at-or-after the message.
 */
export function deriveIsRead(
  counterpartLastReadAt: string | null,
  messageCreatedAt: string
): boolean {
  const readMs = parseTimestampMs(counterpartLastReadAt);
  const messageMs = parseTimestampMs(messageCreatedAt);
  if (readMs === null || messageMs === null) return false;
  return readMs >= messageMs;
}

/**
 * Monotonic merge of the counterpart's `last_read_at` (contract C3): a
 * late/stale/replayed event can never move an established receipt backward.
 * Returns `current` (same reference/value) on a proven no-op so callers'
 * referential bail-outs hold, and ignores incoming values that do not parse.
 */
export function mergeLastReadAt(
  current: string | null,
  incoming: string | null | undefined
): string | null {
  const incomingMs = parseTimestampMs(incoming);
  if (incomingMs === null) return current;
  const currentMs = parseTimestampMs(current);
  if (currentMs !== null && incomingMs <= currentMs) return current;
  return incoming as string;
}

/**
 * The newest own message in an ascending-sorted list (the conversation
 * screens' sort order) — the single message the quiet "Read" marker may
 * attach to (decision D5). Null when the caller has sent nothing.
 */
export function findNewestOwnMessage(
  messages: MessageRow[],
  myId: string | null
): MessageRow | null {
  if (!myId) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === myId) return messages[i];
  }
  return null;
}

/**
 * The id of the message the "Read" marker renders under, or null for none —
 * the ONE derivation both conversation screens share (extracted per
 * realtime-optimizer finding L2 so the copies cannot drift): the newest own
 * message, and only once the counterpart's marker actually covers it.
 */
export function deriveReadMarkerId(
  messages: MessageRow[],
  myId: string | null,
  counterpartLastReadAt: string | null
): string | null {
  const newestOwn = findNewestOwnMessage(messages, myId);
  if (!newestOwn) return null;
  return deriveIsRead(counterpartLastReadAt, newestOwn.created_at) ? newestOwn.id : null;
}
