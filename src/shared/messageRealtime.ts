/**
 * Pure realtime-merge reducer for the MESSAGES table (build-order step
 * 15-16). This is the chat copy of `bookingRealtime.ts` — the step 13-14
 * reference architecture — with the same contract:
 *
 * CONTRACT — idempotency is the whole point:
 * Re-applying the SAME event yields an equal list, so the realtime echo of a
 * message the caller just sent is a no-op, and a row that appears in BOTH
 * the baseline snapshot and the live stream is harmless (see the "open
 * channel before refetch" rule in the hook). Proven no-ops return the SAME
 * array reference so React referential-equality bail-outs hold (lesson F2 —
 * callers must preserve that reference; use {@link applyMessageChangeSorted}).
 *
 * Messages are immutable once sent (no UPDATE/DELETE RLS policies exist),
 * so in practice only INSERT events ever arrive. UPDATE shares the upsert
 * path anyway (a replayed/out-of-order event still converges) and DELETE is
 * defensive dead code — note that a server-side `chat_id` filter can never
 * match a DELETE event under replica identity DEFAULT (PK-only old record),
 * so nothing may ever rely on filtered DELETE delivery (review finding F5).
 */
import type { MessageRow } from '../types';

/** A normalized postgres_changes event, already narrowed to a MessageRow. */
export type MessageChangeEvent = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  row: MessageRow;
};

/**
 * Upsert-by-id merge of a single realtime event into the current list.
 * Position is preserved on replace; ordering is the CALLER's job (the
 * conversation screens sort by created_at ascending, tiebroken by id).
 * Returns the SAME array reference on a proven no-op.
 */
export function applyMessageChange(
  current: MessageRow[],
  event: MessageChangeEvent
): MessageRow[] {
  const { eventType, row } = event;

  if (eventType === 'DELETE') {
    const index = current.findIndex((m) => m.id === row.id);
    if (index === -1) return current;
    const next = current.slice();
    next.splice(index, 1);
    return next;
  }

  // INSERT and UPDATE share one upsert path.
  const index = current.findIndex((m) => m.id === row.id);
  if (index === -1) {
    return [...current, row];
  }
  if (areMessagesEqual(current[index], row)) {
    // Idempotent echo of an already-current row — no state change.
    return current;
  }
  const next = current.slice();
  next[index] = row;
  return next;
}

/**
 * Merge one event and re-sort WITHOUT paying for the sort (and the re-render
 * a fresh array forces) when the event was a proven no-op — the F2 lesson,
 * same as `applyBookingChangeSorted`. All screen-side merge call sites go
 * through this instead of sorting inline.
 */
export function applyMessageChangeSorted(
  current: MessageRow[],
  event: MessageChangeEvent,
  sort: (rows: MessageRow[]) => MessageRow[]
): MessageRow[] {
  const next = applyMessageChange(current, event);
  return next === current ? current : sort(next);
}

/**
 * Shallow field-by-field equality over the known MessageRow columns —
 * MessageRow is a flat record of primitives, so this is exact.
 */
function areMessagesEqual(a: MessageRow, b: MessageRow): boolean {
  return (
    a.id === b.id &&
    a.chat_id === b.chat_id &&
    a.sender_id === b.sender_id &&
    a.message === b.message &&
    a.created_at === b.created_at
  );
}
