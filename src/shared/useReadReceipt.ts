/**
 * Read-receipt hook: the counterpart's `last_read_at` for ONE chat room,
 * kept live (chat follow-on, founder-directed 2026-07-14; design:
 * docs/design/chat-read-receipts-typing-design-approval.md).
 *
 * Copies the house realtime architecture (contract C2): focus-gated channel,
 * callbacks through refs, stable channel name, cleanup via removeChannel.
 * Unlike `useMessagesRealtime` this hook OWNS its state (a single value, not
 * a list), so the baseline strategy is the unread provider's M2 shape: the
 * baseline fetch runs on EVERY `SUBSCRIBED` — initial and post-outage alike,
 * never before the join — which is the F1 recovery and the no-missed-events
 * ordering in one move. The monotonic merge (`mergeLastReadAt`, contract C3)
 * makes repeated baselines and stale/replayed events harmless: an
 * established receipt can never move backward.
 *
 * READS ONLY (contract C5): the unread provider remains the sole writer of
 * `last_read_at`. Row visibility is RLS
 * (`chat_read_state_select_participants`, migration 0017); the server-side
 * `chat_id` filter is a traffic optimization, not a security boundary.
 */
import { useEffect, useState } from 'react';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { ChatReadStateRow } from '../types';
import { mergeLastReadAt } from './readReceipts';

export type UseReadReceiptArgs = {
  /** The chat room to watch; when falsy the channel stays closed. */
  roomId: string | null | undefined;
  /** The caller's own user id — own-row events are not receipts. */
  myId: string | null;
  /** Gate — the caller passes focus state (e.g. from `useFocusEffect`). */
  enabled: boolean;
};

export type ReadReceiptState = {
  /**
   * The counterpart's newest known `last_read_at` for this room, or null
   * until one has actually been observed (nothing is ever fabricated).
   */
  counterpartLastReadAt: string | null;
};

export function useReadReceipt({ roomId, myId, enabled }: UseReadReceiptArgs): ReadReceiptState {
  // State is keyed by room: a value from a previous room is never exposed
  // (derived null below), so no reset-on-room-change effect is needed. Within
  // one room the value survives blur/refocus, which the monotonic merge makes
  // safe — an established receipt is still true later.
  const [receipt, setReceipt] = useState<{ roomId: string; lastReadAt: string | null } | null>(
    null
  );
  const counterpartLastReadAt =
    receipt && roomId && receipt.roomId === roomId ? receipt.lastReadAt : null;

  useEffect(() => {
    if (!enabled || !roomId || !myId) return;

    let disposed = false;

    // Every source (baseline row, realtime event) merges through the same
    // monotonic reducer; the functional update keeps this race-free, and a
    // proven no-op returns the same object so React bails out (C3/F2).
    const mergeIncoming = (incoming: string | null | undefined) => {
      setReceipt((prev) => {
        const base = prev && prev.roomId === roomId ? prev.lastReadAt : null;
        const next = mergeLastReadAt(base, incoming);
        if (prev && prev.roomId === roomId && next === base) return prev;
        return { roomId, lastReadAt: next };
      });
    };

    const loadBaseline = async () => {
      const { data, error } = await supabase
        .from('chat_read_state')
        .select('chat_id, user_id, last_read_at')
        .eq('chat_id', roomId)
        .neq('user_id', myId)
        .maybeSingle();
      if (disposed || error || !data) return; // best-effort: absence = no receipt
      mergeIncoming((data as ChatReadStateRow).last_read_at);
    };

    const channelName = `read_state:chat_id:${roomId}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_read_state',
          filter: `chat_id=eq.${roomId}`,
        },
        (payload: RealtimePostgresChangesPayload<ChatReadStateRow>) => {
          // Does not occur today: no DELETE policy/grant AND rooms are never
          // deleted (a cascade would bypass both — L1). Defensive regardless.
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as ChatReadStateRow;
          if (!row || !row.user_id || row.user_id === myId) return; // own row is not a receipt
          mergeIncoming(row.last_read_at);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[useReadReceipt] channel ${channelName} status: ${status}`);
          return;
        }
        if (status === 'SUBSCRIBED') {
          // Baseline on EVERY join (M2 shape): the initial one runs only once
          // the stream is live (no pre-subscribe gap), and each post-outage
          // rejoin re-baselines because gap events were dropped, not queued
          // (lesson F1). The monotonic merge makes repeats harmless.
          void loadBaseline();
        }
      });

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId, myId, enabled]);

  return { counterpartLastReadAt };
}
