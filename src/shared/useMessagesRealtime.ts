/**
 * React hook wrapping a Supabase `postgres_changes` subscription on
 * `public.messages`, scoped to ONE chat room (build-order step 15-16). This
 * is the chat copy of `useBookingsRealtime.ts` — the step 13-14 reference
 * architecture — including the F1 recovery contract. Divergences from that
 * file are deliberate and minimal: the filter column is fixed (`chat_id`),
 * and the subscriber is a stack screen rather than a tab, but the lifecycle
 * contract is identical (the caller still drives `enabled` from focus).
 *
 * ORDERING CONTRACT (caller MUST honor):
 * 1. Open this channel (set `enabled` true) BEFORE kicking off the baseline
 *    fetch — a message that lands in the gap arrives on the stream, so
 *    nothing is missed. Opening AFTER the fetch would drop it.
 * 2. `applyMessageChange` is idempotent, so snapshot/stream overlap is
 *    harmless by construction — no dedup logic.
 * 3. The reducer appends unknown INSERTs; the caller re-sorts (created_at
 *    ascending in the conversation screens).
 * 4. Pass `onRecovered` and re-run the baseline fetch from it: Supabase does
 *    NOT replay events that fired while the socket was down (lesson F1). It
 *    fires exactly when the channel re-enters SUBSCRIBED after an
 *    error/timeout — never on the initial subscribe.
 *
 * SECURITY: row visibility is enforced by RLS (`messages_select_participants`
 * via the parent room); the server-side `chat_id` filter below is a traffic
 * optimization only, not a security boundary.
 */
import { useEffect, useRef } from 'react';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { MessageRow } from '../types';
import type { MessageChangeEvent } from './messageRealtime';

export type UseMessagesRealtimeArgs = {
  /** The chat room to stream; when falsy the channel stays closed. */
  roomId: string | null | undefined;
  /** Fed one normalized event per change to pass to `applyMessageChange`. */
  onChange: (event: MessageChangeEvent) => void;
  /**
   * Called when the channel re-enters SUBSCRIBED after an error/timeout —
   * re-run the baseline fetch here (ordering-contract rule 4). Never called
   * on the initial, healthy subscribe.
   */
  onRecovered?: () => void;
  /** Gate — the caller passes focus state (e.g. from `useFocusEffect`). */
  enabled: boolean;
};

/** Subscribe to message changes for one room; state lives in the caller. */
export function useMessagesRealtime({
  roomId,
  onChange,
  onRecovered,
  enabled,
}: UseMessagesRealtimeArgs): void {
  // Latest callbacks live in refs so identity churn does NOT tear down and
  // recreate the channel every render.
  const onChangeRef = useRef(onChange);
  const onRecoveredRef = useRef(onRecovered);
  useEffect(() => {
    onChangeRef.current = onChange;
    onRecoveredRef.current = onRecovered;
  }, [onChange, onRecovered]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    // Flips true on an error/timeout so the NEXT healthy SUBSCRIBED is
    // recognized as a recovery (possible missed-event gap), not the initial
    // subscribe.
    let hadChannelError = false;

    const channelName = `messages:chat_id:${roomId}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          const eventType = payload.eventType; // 'INSERT' | 'UPDATE' | 'DELETE'
          const row = (
            eventType === 'DELETE' ? payload.old : payload.new
          ) as MessageRow;
          if (!row || !row.id) return;
          onChangeRef.current({ eventType, row });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Log once; supabase-js auto-reconnects — no custom retry loop.
          // 'CLOSED' is deliberately not an error: it is our own cleanup.
          hadChannelError = true;
          console.warn(
            `[useMessagesRealtime] channel ${channelName} status: ${status}`
          );
          return;
        }
        if (status === 'SUBSCRIBED' && hadChannelError) {
          // Auto-rejoin after an outage: gap events were dropped, not
          // queued — hand control back to the caller for a baseline refetch.
          hadChannelError = false;
          onRecoveredRef.current?.();
        }
      });

    return () => {
      // Removes the channel on disable, unmount, or dep change — the guard
      // against leaked channels across focus cycles.
      void supabase.removeChannel(channel);
    };
  }, [roomId, enabled]);
}
