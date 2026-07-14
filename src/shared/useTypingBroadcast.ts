/**
 * Typing indicator over a PRIVATE Supabase Realtime broadcast channel (chat
 * follow-on, founder-directed 2026-07-14; design:
 * docs/design/chat-read-receipts-typing-design-approval.md, decisions D4 +
 * contract C4). Topic `typing:{chat_id}`; authorization is RLS on
 * `realtime.messages` (migration 0017) — participants only, both directions.
 * Ephemeral by design: no DB rows, nothing persisted, and NOTHING fabricated
 * — `counterpartTyping` only ever reflects an event actually received.
 *
 * SEND SIDE (debounced, contract C4 — never one event per keystroke):
 * - `notifyActivity()` on each meaningful draft change: emits `typing: true`
 *   at most once per TYPING_REFRACTORY_MS (leading edge + refractory), and
 *   (re)arms a trailing idle timer that emits `typing: false` after
 *   TYPING_SENDER_IDLE_MS of silence.
 * - `notifyStopped()` (send pressed / draft cleared / blur): emits
 *   `typing: false` immediately — but only if a start was actually emitted
 *   since the last stop (no stop-spam).
 * - Sends are skipped entirely until the channel is joined (best-effort,
 *   honest: a typing hint is never worth queueing).
 *
 * RECEIVE SIDE (self-healing): `typing: true` shows the indicator and
 * (re)arms a TYPING_RECEIVER_TTL_MS clear timer, so a lost stop event can
 * never strand the indicator on-screen (honesty rule: no state may hang
 * forever). `typing: false` clears immediately.
 *
 * RECOVERY: deliberately NO baseline/refetch on rejoin — typing state is
 * ephemeral, there is nothing authoritative to refetch. After an outage the
 * indicator is simply off until the next real event, which is the honest
 * state. (The F1 refetch contract applies to persistent-row subscriptions;
 * its status-callback shape is kept for warnings only.)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

/** Minimum gap between two `typing: true` emissions. */
export const TYPING_REFRACTORY_MS = 2500;
/** Silence after the last activity before the sender emits `typing: false`. */
export const TYPING_SENDER_IDLE_MS = 3000;
/** Receiver-side TTL: clears the indicator even if the stop event is lost. */
export const TYPING_RECEIVER_TTL_MS = 5000;

/** Broadcast payload — the only shape ever sent on a typing topic. */
export type TypingPayload = { user_id: string; typing: boolean };

export type UseTypingBroadcastArgs = {
  /** The chat room; when falsy the channel stays closed. */
  roomId: string | null | undefined;
  /** The caller's own user id (stamped into payloads; own events ignored). */
  myId: string | null;
  /** Gate — the caller passes focus state (e.g. from `useFocusEffect`). */
  enabled: boolean;
};

export type TypingBroadcast = {
  /** True while the counterpart is typing (per last received real event). */
  counterpartTyping: boolean;
  /** Call on every meaningful draft change (non-empty text). Debounced. */
  notifyActivity: () => void;
  /** Call on send / cleared draft / leaving — emits stop if one is owed. */
  notifyStopped: () => void;
};

export function useTypingBroadcast({
  roomId,
  myId,
  enabled,
}: UseTypingBroadcastArgs): TypingBroadcast {
  const [counterpartTyping, setCounterpartTyping] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);
  /** Epoch ms of the last `typing: true` emission; null = stop was sent. */
  const lastStartSentAtRef = useRef<number | null>(null);
  const senderIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiverTtlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myIdRef = useRef(myId);
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  const clearSenderIdleTimer = () => {
    if (senderIdleTimerRef.current !== null) {
      clearTimeout(senderIdleTimerRef.current);
      senderIdleTimerRef.current = null;
    }
  };
  const clearReceiverTtlTimer = () => {
    if (receiverTtlTimerRef.current !== null) {
      clearTimeout(receiverTtlTimerRef.current);
      receiverTtlTimerRef.current = null;
    }
  };

  const sendTyping = (typing: boolean) => {
    const channel = channelRef.current;
    const userId = myIdRef.current;
    if (!channel || !joinedRef.current || !userId) return;
    // Fire-and-forget: a typing hint is never worth an error surface.
    void channel
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: userId, typing } satisfies TypingPayload,
      })
      .catch(() => {});
  };

  /** Emit the owed stop (if any) and reset the sender state. */
  const sendStopIfOwed = () => {
    clearSenderIdleTimer();
    if (lastStartSentAtRef.current === null) return;
    lastStartSentAtRef.current = null;
    sendTyping(false);
  };

  const notifyActivity = useCallback(() => {
    if (!joinedRef.current) return;
    const now = Date.now();
    const lastStart = lastStartSentAtRef.current;
    if (lastStart === null || now - lastStart >= TYPING_REFRACTORY_MS) {
      lastStartSentAtRef.current = now;
      sendTyping(true);
    }
    // Trailing idle stop — re-armed on every activity.
    clearSenderIdleTimer();
    senderIdleTimerRef.current = setTimeout(() => {
      senderIdleTimerRef.current = null;
      sendStopIfOwed();
    }, TYPING_SENDER_IDLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notifyStopped = useCallback(() => {
    sendStopIfOwed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled || !roomId || !myId) return;

    // No body-time state reset needed: initial state is false and the
    // previous run's cleanup already reset it.
    const channelName = `typing:${roomId}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName, {
        config: { private: true, broadcast: { self: false } },
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const p = payload as TypingPayload | undefined;
        // self:false already suppresses echoes; the id check is defensive.
        if (!p || typeof p.typing !== 'boolean' || p.user_id === myIdRef.current) return;
        if (p.typing) {
          setCounterpartTyping(true);
          clearReceiverTtlTimer();
          receiverTtlTimerRef.current = setTimeout(() => {
            receiverTtlTimerRef.current = null;
            setCounterpartTyping(false); // self-heal: lost stop can't strand it
          }, TYPING_RECEIVER_TTL_MS);
        } else {
          clearReceiverTtlTimer();
          setCounterpartTyping(false);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          joinedRef.current = false;
          console.warn(`[useTypingBroadcast] channel ${channelName} status: ${status}`);
          return;
        }
        if (status === 'SUBSCRIBED') {
          joinedRef.current = true;
        }
      });
    channelRef.current = channel;

    return () => {
      // Best-effort courtesy stop BEFORE teardown, then hard cleanup — no
      // leaked timers, no leaked channels, indicator reset for the next
      // focus cycle.
      sendStopIfOwed();
      clearReceiverTtlTimer();
      joinedRef.current = false;
      channelRef.current = null;
      lastStartSentAtRef.current = null;
      setCounterpartTyping(false);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myId, enabled]);

  return { counterpartTyping, notifyActivity, notifyStopped };
}
