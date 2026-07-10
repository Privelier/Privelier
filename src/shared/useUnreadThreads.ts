/**
 * App-level unread provider hook (step 15-16 follow-on, design:
 * docs/design/step-15-16-unread-indicator-design.md). Mounted ONCE per app
 * (inside each navigator's UnreadProvider) — owns the single source of truth
 * for which rooms are unread, feeding the tab badge, the thread-list bold
 * state, and mark-as-read.
 *
 * BASELINE (best-effort): three RLS-scoped reads — own rooms, own read
 * state, newest 200 messages (same cap + degradation the inbox preview scan
 * accepts) — folded through the pure computeUnreadRoomIds. Any failure
 * degrades to an empty set (no badge), never an error surface: the badge is
 * auxiliary, the thread lists remain the authoritative UI.
 *
 * LIVE: one UNFILTERED postgres_changes INSERT subscription on messages —
 * deliberately no server-side filter, because RLS-on-WAL already scopes
 * delivery to rooms this user participates in, and the badge must react to
 * ANY of their rooms from anywhere in the app. INSERT-only: messages are
 * immutable, and filtered-DELETE delivery is unreliable by design anyway.
 *
 * ORDERING (review finding M2): the baseline load runs ON every SUBSCRIBED —
 * initial and post-outage alike — never before it. Unlike the screens, this
 * provider has no focus-refetch safety net, so a message committing between
 * a pre-subscribe baseline and the join would be silently missed forever;
 * loading only once the stream is live closes that gap, and the idempotent
 * compute plus the active-room guard make the repeat loads harmless.
 *
 * MARK-AS-READ is owned HERE, not by screens: the conversation screen only
 * declares itself active (`setActiveRoom(room.id)` on focus, null on blur).
 * The provider marks read when a room becomes active (the founder's trigger:
 * opening that specific conversation) and again when an INSERT lands for the
 * active room (the user is looking at it). The written marker is
 * resolveReadMarker(now, newest known message) — see unread.ts for the
 * clock-skew rationale. Failures degrade silently (unread returns after
 * restart until a write succeeds — truthful, nothing fake persisted).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { MessageRow } from '../types';
import {
  computeUnreadRoomIds,
  latestMessageByRoom,
  resolveReadMarker,
  type UnreadMessageInput,
} from './unread';

/** Same cap (and documented degradation) as the inbox preview scan. */
const MESSAGE_SCAN_CAP = 200;

export interface UnreadState {
  /** Rooms with at least one unread counterpart message. */
  unreadRoomIds: Set<string>;
  /** Convenience for the tab badge. */
  unreadCount: number;
  /**
   * Conversation screens call this with their room id on focus and null on
   * blur; the provider handles mark-as-read from it.
   */
  setActiveRoom: (roomId: string | null) => void;
}

export function useUnreadThreads(): UnreadState {
  const [unreadRoomIds, setUnreadRoomIds] = useState<Set<string>>(new Set());
  const [myId, setMyId] = useState<string | null>(null);

  const activeRoomRef = useRef<string | null>(null);
  const latestByRoomRef = useRef<Map<string, UnreadMessageInput>>(new Map());
  const myIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        const id = data.session?.user.id ?? null;
        myIdRef.current = id;
        setMyId(id);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  /** Fire-and-forget write; optimistic local un-flag happens at the caller. */
  const writeReadMarker = useCallback((roomId: string, userId: string) => {
    const marker = resolveReadMarker(
      new Date().toISOString(),
      latestByRoomRef.current.get(roomId)?.created_at ?? null
    );
    void supabase
      .from('chat_read_state')
      .upsert(
        { chat_id: roomId, user_id: userId, last_read_at: marker },
        { onConflict: 'chat_id,user_id' }
      )
      .then(({ error }) => {
        if (error && __DEV__) {
          console.warn('[unread] writeReadMarker failed', error);
        }
      });
  }, []);

  const markRead = useCallback(
    (roomId: string) => {
      const userId = myIdRef.current;
      if (!userId) return;
      setUnreadRoomIds((prev) => {
        if (!prev.has(roomId)) return prev; // referential no-op
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
      writeReadMarker(roomId, userId);
    },
    [writeReadMarker]
  );

  const load = useCallback(async () => {
    const userId = myIdRef.current;
    if (!userId) return;
    const [roomsResult, readResult, messagesResult] = await Promise.all([
      supabase.from('chat_rooms').select('id'),
      supabase.from('chat_read_state').select('chat_id, last_read_at'),
      supabase
        .from('messages')
        .select('chat_id, sender_id, created_at')
        .order('created_at', { ascending: false })
        .limit(MESSAGE_SCAN_CAP),
    ]);
    if (roomsResult.error || readResult.error || messagesResult.error) {
      // Best-effort: no badge beats a wrong badge or an error surface.
      if (__DEV__) {
        console.warn(
          '[unread] baseline load failed',
          roomsResult.error ?? readResult.error ?? messagesResult.error
        );
      }
      return;
    }
    const messages = (messagesResult.data ?? []) as UnreadMessageInput[];
    latestByRoomRef.current = latestMessageByRoom(messages);
    const next = computeUnreadRoomIds({
      roomIds: ((roomsResult.data ?? []) as { id: string }[]).map((r) => r.id),
      messages,
      readStates: (readResult.data ?? []) as { chat_id: string; last_read_at: string }[],
      myId: userId,
    });
    // The active room is being read right now — never re-flag it from a
    // baseline that raced a fresh message.
    if (activeRoomRef.current) next.delete(activeRoomRef.current);
    setUnreadRoomIds(next);
  }, []);

  // Ref-route the callbacks so the app-level channel's effect depends ONLY
  // on the user id — a future dep added to load/markRead must never churn
  // this channel (reviewer note, same pattern as the other realtime hooks).
  const loadRef = useRef(load);
  const markReadRef = useRef(markRead);
  useEffect(() => {
    loadRef.current = load;
    markReadRef.current = markRead;
  }, [load, markRead]);

  useEffect(() => {
    if (!myId) return;

    const channelName = `messages:unread:${myId}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        // No filter on purpose: RLS-on-WAL scopes delivery to this user's
        // rooms, and the badge must hear about all of them.
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          const row = payload.new as MessageRow;
          if (!row || !row.id) return;

          const current = latestByRoomRef.current.get(row.chat_id);
          if (!current || row.created_at > current.created_at) {
            latestByRoomRef.current.set(row.chat_id, row);
          }

          if (row.chat_id === activeRoomRef.current) {
            // The user is looking at this conversation — it stays read. Own
            // sends need no marker at all (they can never make a room
            // unread), so only counterpart messages trigger the write (L1).
            if (row.sender_id !== myIdRef.current) markReadRef.current(row.chat_id);
            return;
          }
          if (row.sender_id === myIdRef.current) return; // own send elsewhere
          setUnreadRoomIds((prev) => {
            if (prev.has(row.chat_id)) return prev; // referential no-op
            const next = new Set(prev);
            next.add(row.chat_id);
            return next;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[useUnreadThreads] channel ${channelName} status: ${status}`);
          return;
        }
        if (status === 'SUBSCRIBED') {
          // Baseline on EVERY join (M2): the initial one runs only once the
          // stream is live (no pre-subscribe gap), and each post-outage
          // rejoin re-baselines because gap events were dropped, not queued
          // (lesson F1). Idempotent compute makes repeats harmless.
          void loadRef.current();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId]);

  const setActiveRoom = useCallback(
    (roomId: string | null) => {
      activeRoomRef.current = roomId;
      if (roomId) markRead(roomId);
    },
    [markRead]
  );

  return { unreadRoomIds, unreadCount: unreadRoomIds.size, setActiveRoom };
}
