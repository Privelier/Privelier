/**
 * Pure realtime-merge reducer for the BOOKINGS table (build-order step
 * 13-14, the app's FIRST realtime subscription — chat in step 15-16 copies
 * this shape).
 *
 * This module is deliberately side-effect free and framework-free so it can
 * be unit-tested in isolation. The React subscription that feeds it lives in
 * `useBookingsRealtime.ts`; the screens own baseline fetching and ordering.
 *
 * CONTRACT — idempotency is the whole point:
 * Re-applying the SAME event to a list yields an equal list. This is what
 * makes the realtime echo of a caller's own optimistic write a no-op (the
 * row is already in its final shape, so replace-in-place changes nothing)
 * and what makes a row that appears in BOTH the baseline snapshot and the
 * live stream harmless (see the "open channel before refetch" note in the
 * hook). Callers can therefore fold snapshot rows and stream events through
 * the same reducer without guarding against duplicates.
 */
import type { BookingRow } from '../types';

/**
 * A normalized postgres_changes event, already narrowed to a BookingRow.
 * `eventType` mirrors Supabase's `payload.eventType`; `row` is the affected
 * row — `payload.new` for INSERT/UPDATE, `payload.old` for DELETE (only its
 * `id` is relied upon for removal).
 */
export type BookingChangeEvent = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  row: BookingRow;
};

/**
 * Upsert-by-id merge of a single realtime event into the current list.
 *
 * - INSERT / UPDATE: if a row with the same `id` exists, replace it IN PLACE
 *   (position preserved — the data layer, not this reducer, owns ordering by
 *   date/time); otherwise append. INSERT and UPDATE are treated identically
 *   so an out-of-order or replayed event still converges to the same state.
 * - DELETE: remove the row with the matching `id`; a no-op if absent.
 *
 * Returns a NEW array on a real change and the SAME array reference when the
 * event is a proven no-op (a DELETE of an absent id, or an UPDATE/INSERT
 * whose row is already deeply-equal), so React referential-equality bail-outs
 * hold and the list does not flicker on echoes.
 *
 * NOTE ON ORDERING: appended INSERTs land at the end of the list. The caller
 * is responsible for re-sorting (customer bookings sort date/time desc,
 * barber requests sort date/time asc) — this keeps the reducer pure and
 * ordering-policy-free so both apps can share it.
 */
export function applyBookingChange(
  current: BookingRow[],
  event: BookingChangeEvent
): BookingRow[] {
  const { eventType, row } = event;

  if (eventType === 'DELETE') {
    const index = current.findIndex((b) => b.id === row.id);
    if (index === -1) return current;
    const next = current.slice();
    next.splice(index, 1);
    return next;
  }

  // INSERT and UPDATE share one upsert path.
  const index = current.findIndex((b) => b.id === row.id);
  if (index === -1) {
    return [...current, row];
  }
  if (areBookingsEqual(current[index], row)) {
    // Idempotent echo of an already-current row — no state change.
    return current;
  }
  const next = current.slice();
  next[index] = row;
  return next;
}

/**
 * Shallow field-by-field equality over the known BookingRow columns. Used
 * only to short-circuit no-op upserts; BookingRow is a flat record of
 * primitives, so a shallow compare is exact here.
 */
function areBookingsEqual(a: BookingRow, b: BookingRow): boolean {
  return (
    a.id === b.id &&
    a.customer_id === b.customer_id &&
    a.barber_id === b.barber_id &&
    a.service_id === b.service_id &&
    a.date === b.date &&
    a.time === b.time &&
    a.location === b.location &&
    a.price === b.price &&
    a.status === b.status &&
    a.created_at === b.created_at
  );
}
