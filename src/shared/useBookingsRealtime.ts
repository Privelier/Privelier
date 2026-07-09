/**
 * React hook wrapping a Supabase `postgres_changes` subscription on
 * `public.bookings` — the app's FIRST realtime channel (build-order step
 * 13-14). Chat (step 15-16) should mirror this file's shape.
 *
 * WHAT IT DOES: opens ONE channel per (filterColumn, filterValue) and hands
 * every INSERT/UPDATE/DELETE to `onChange` as a normalized
 * {@link BookingChangeEvent}, which the caller folds into list state with
 * {@link applyBookingChange}.
 *
 * ORDERING CONTRACT (caller MUST honor, this is why events can't be lost):
 * 1. Open this channel (set `enabled` true) BEFORE kicking off the baseline
 *    refetch. Any write that lands in the gap between "subscription active"
 *    and "snapshot returned" then arrives on the stream too, so nothing is
 *    missed. Opening AFTER the fetch would drop writes in that window.
 * 2. Because `applyBookingChange` is idempotent, a row that shows up in BOTH
 *    the snapshot and the stream reconciles to the same state — the overlap
 *    from rule 1 is harmless by construction, no dedup logic required.
 * 3. `applyBookingChange` appends unknown INSERTs; the caller re-sorts (this
 *    hook is ordering-policy-free).
 * 4. Pass `onRecovered` and re-run the same baseline fetch from it: Supabase
 *    does NOT replay events that fired while the socket was down, so after a
 *    mid-focus network blip the auto-rejoined channel alone leaves the list
 *    silently stale (retroactive design review finding F1). `onRecovered`
 *    fires exactly when the channel re-enters SUBSCRIBED after an error —
 *    never on the initial subscribe, which rule 1's fetch already covers —
 *    and the refetch is race-free for the same idempotency reason as rule 2.
 *
 * LIFECYCLE: the CALLER drives `enabled`, normally from `useFocusEffect`.
 * Bottom-tab screens stay mounted when backgrounded, so gating on mount/
 * unmount would leak the channel across tab switches; gating on focus tears
 * the channel down on blur and reopens it on focus. The channel effect
 * depends ONLY on [filterColumn, filterValue, enabled] and removes the
 * channel in its cleanup, so repeated focus cycles never leak a channel.
 *
 * SECURITY: row visibility is already enforced by RLS
 * (`bookings_select_participants`); the server-side `filter` below is a
 * traffic optimization only, not a security boundary.
 */
import { useEffect, useRef } from 'react';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { BookingRow } from '../types';
import type { BookingChangeEvent } from './bookingRealtime';

/** Which participant column scopes the stream to the signed-in user. */
export type BookingFilterColumn = 'barber_id' | 'customer_id';

export type UseBookingsRealtimeArgs = {
  /** `'barber_id'` in the barber app, `'customer_id'` in the customer app. */
  filterColumn: BookingFilterColumn;
  /** The signed-in user's id; when falsy the channel stays closed. */
  filterValue: string | null | undefined;
  /** Fed one normalized event per change to pass to `applyBookingChange`. */
  onChange: (event: BookingChangeEvent) => void;
  /**
   * Called when the channel re-enters SUBSCRIBED after an error/timeout —
   * i.e. after a reconnect whose gap may have dropped events. Re-run the
   * baseline fetch here (see ordering-contract rule 4). Never called on the
   * initial, healthy subscribe.
   */
  onRecovered?: () => void;
  /** Gate — the caller passes focus state (e.g. from `useFocusEffect`). */
  enabled: boolean;
};

/**
 * Subscribe to booking changes for one participant. Returns nothing — state
 * lives in the caller, which reduces each event via `applyBookingChange`.
 */
export function useBookingsRealtime({
  filterColumn,
  filterValue,
  onChange,
  onRecovered,
  enabled,
}: UseBookingsRealtimeArgs): void {
  // Keep the latest callbacks in refs so unstable callback identities do
  // NOT tear down and recreate the channel every render.
  const onChangeRef = useRef(onChange);
  const onRecoveredRef = useRef(onRecovered);
  useEffect(() => {
    onChangeRef.current = onChange;
    onRecoveredRef.current = onRecovered;
  }, [onChange, onRecovered]);

  useEffect(() => {
    if (!enabled || !filterValue) return;

    // Scoped to this channel instance: flips true on an error/timeout so the
    // NEXT healthy SUBSCRIBED is recognized as a recovery (with a possible
    // missed-event gap) rather than the initial subscribe.
    let hadChannelError = false;

    // Stable, unique channel name per (column, value) so two screens filtered
    // on the same user share one logical channel identity rather than
    // colliding on a generic name.
    const channelName = `bookings:${filterColumn}:${filterValue}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload: RealtimePostgresChangesPayload<BookingRow>) => {
          const eventType = payload.eventType; // 'INSERT' | 'UPDATE' | 'DELETE'
          // new for INSERT/UPDATE, old for DELETE (only its id is used there).
          const row = (
            eventType === 'DELETE' ? payload.old : payload.new
          ) as BookingRow;
          if (!row || !row.id) return;
          onChangeRef.current({ eventType, row });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Log once; the supabase-js client auto-reconnects, so do NOT
          // implement a custom retry loop here. 'CLOSED' is deliberately not
          // treated as an error — it is what our own cleanup produces.
          hadChannelError = true;
          console.warn(
            `[useBookingsRealtime] channel ${channelName} status: ${status}`
          );
          return;
        }
        if (status === 'SUBSCRIBED' && hadChannelError) {
          // Auto-rejoin after an outage: events from the gap were dropped,
          // not queued — hand control back to the caller for a baseline
          // refetch (ordering-contract rule 4).
          hadChannelError = false;
          onRecoveredRef.current?.();
        }
      });

    return () => {
      // Removes the channel on disable, unmount, or any dep change — the one
      // guard against leaked channels across repeated focus cycles.
      void supabase.removeChannel(channel);
    };
  }, [filterColumn, filterValue, enabled]);
}
