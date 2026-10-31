/**
 * Messages, sync and sending for the booking chat (ConversationView).
 *
 * REALTIME + FOCUS (same architecture as useBookingsRealtime):
 * - Channel gated on focus via useFocusEffect, opened BEFORE the baseline
 *   fetch so no message is missed in the gap window; torn down on blur.
 * - Snapshot rows and stream events both fold through applyMessageChange
 *   (idempotent upsert-by-id) with the reference-preserving sorted-merge
 *   bailout (lesson F2), sorted created_at ascending, id tiebreak.
 * - onRecovered re-runs the baseline fetch after a reconnect (lesson F1);
 *   once paginated, recovery pages forward from the REST high-water mark.
 *
 * SENDING: honest optimistic state via useSendQueue, no fabricated rows. An
 * in-flight send renders from local state, then is replaced by the
 * authoritative server row, whose realtime echo reconciles to a no-op.
 * Double-fire protection is synchronous (review finding M1): the draft
 * mirror ref here plus the in-flight key guard inside useSendQueue.
 *
 * READ RECEIPTS + TYPING (migration 0017): observed, never invented.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import type { ChatRoomRow, MessageRow } from '../types';
import { buildInvertedChatItems } from './chatPresentation';
import type { ConversationCursor } from './conversationPagination';
import { applyMessageChange, applyMessageChangeSorted, type MessageChangeEvent } from './messageRealtime';
import { deriveReadMarkerId } from './readReceipts';
import { useMessagesRealtime } from './useMessagesRealtime';
import { useReadReceipt } from './useReadReceipt';
import { useSendQueue, type PendingSend } from './useSendQueue';
import { useTypingBroadcast } from './useTypingBroadcast';
import { getUnsentDraft, setUnsentDraft } from './unsentDrafts';

type Failure = { status: 'error'; message: string };

/** Each app passes its own data layer; both share these result shapes. */
export interface ConversationApi {
  fetchConversation: (
    roomId: string,
    before?: ConversationCursor
  ) => Promise<
    | { status: 'ok'; messages: MessageRow[]; hasEarlier: boolean; earliestCursor: ConversationCursor | null; latestCursor?: ConversationCursor | null }
    | Failure
  >;
  fetchConversationNewerThan: (
    roomId: string,
    after: ConversationCursor
  ) => Promise<{ status: 'ok'; messages: MessageRow[]; hasNewer: boolean; latestCursor: ConversationCursor | null } | Failure>;
  sendMessage: (roomId: string, text: string, messageId: string) => Promise<{ status: 'ok'; message: MessageRow } | Failure>;
}

/** Inverted-list row: newest first (index 0 renders at the bottom). */
export type ConversationListItem =
  | { kind: 'pending'; pending: PendingSend }
  | ReturnType<typeof buildInvertedChatItems>[number];

/** Ascending by created_at, id tiebreak so equal timestamps stay stable. */
function sortAsc(rows: MessageRow[]): MessageRow[] {
  return [...rows].sort((a, b) => {
    const c = a.created_at.localeCompare(b.created_at);
    return c !== 0 ? c : a.id.localeCompare(b.id);
  });
}

function mergeMessageRows(previous: MessageRow[], rows: MessageRow[]): MessageRow[] {
  let next = previous;
  for (const row of rows) {
    next = applyMessageChange(next, { eventType: 'INSERT', row });
  }
  return next === previous ? previous : sortAsc(next);
}

export function useConversation(room: ChatRoomRow, api: ConversationApi, setActiveRoom: (roomId: string | null) => void) {
  const { fetchConversation, fetchConversationNewerThan, sendMessage } = api;
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [earliestCursor, setEarliestCursor] = useState<ConversationCursor | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState<string | null>(null);
  const paginationInitializedRef = useRef(false);
  const loadingEarlierRef = useRef(false);
  const restHighWaterRef = useRef<ConversationCursor | null>(null);
  const refreshRunningRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  // An unsent draft survives leaving and reopening the room (unsentDrafts).
  const [draft, setDraft] = useState(() => getUnsentDraft(room.id));
  // Synchronous mirror of the draft: a same-tick double-fire of Send reads
  // '' from here and no-ops (review finding M1) — setDraft('') alone only
  // lands after the next commit.
  const draftRef = useRef(draft);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setMyId(data.session?.user.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchConversation(room.id);
    setLoading(false);
    if (result.status === 'ok') {
      paginationInitializedRef.current = true;
      restHighWaterRef.current = result.latestCursor ?? null;
      setHasEarlier(result.hasEarlier);
      setEarliestCursor(result.earliestCursor);
      setMessages((prev) => mergeMessageRows(prev, result.messages));
    } else {
      setError(result.message);
    }
  }, [room.id, fetchConversation]);

  const runRecoveryPass = useCallback(async () => {
    const preRecoveryHighWater = restHighWaterRef.current;
    setLoading(true);
    setError(null);

    const snapshot = await fetchConversation(room.id);
    if (snapshot.status !== 'ok') {
      setLoading(false);
      setError(snapshot.message);
      return;
    }
    setMessages((prev) => mergeMessageRows(prev, snapshot.messages));

    if (!preRecoveryHighWater) {
      restHighWaterRef.current = snapshot.latestCursor ?? null;
      setLoading(false);
      return;
    }

    let cursor = preRecoveryHighWater;
    while (true) {
      const page = await fetchConversationNewerThan(room.id, cursor);
      if (page.status !== 'ok') {
        setLoading(false);
        setError(page.message);
        return;
      }
      setMessages((prev) => mergeMessageRows(prev, page.messages));
      if (page.latestCursor) cursor = page.latestCursor;
      if (!page.hasNewer || !page.latestCursor) break;
    }

    restHighWaterRef.current = cursor;
    setLoading(false);
  }, [room.id, fetchConversation, fetchConversationNewerThan]);

  const refreshConversation = useCallback(async () => {
    refreshQueuedRef.current = true;
    if (refreshRunningRef.current) return;

    refreshRunningRef.current = true;
    try {
      while (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        if (paginationInitializedRef.current) {
          await runRecoveryPass();
        } else {
          await loadInitial();
        }
      }
    } finally {
      refreshRunningRef.current = false;
    }
  }, [loadInitial, runRecoveryPass]);

  const loadEarlier = useCallback(async () => {
    if (loadingEarlierRef.current || !hasEarlier || !earliestCursor) return;

    loadingEarlierRef.current = true;
    setLoadingEarlier(true);
    setEarlierError(null);
    try {
      const result = await fetchConversation(room.id, earliestCursor);
      if (result.status === 'ok') {
        setMessages((prev) => mergeMessageRows(prev, result.messages));
        setHasEarlier(result.hasEarlier);
        setEarliestCursor(result.earliestCursor);
      } else {
        setEarlierError(result.message);
      }
    } finally {
      loadingEarlierRef.current = false;
      setLoadingEarlier(false);
    }
  }, [earliestCursor, hasEarlier, room.id, fetchConversation]);

  // Mark-as-read is owned by the app's unread provider; this only declares
  // which room is being looked at (the trigger: OPENING this conversation).
  useFocusEffect(
    useCallback(() => {
      // Open the channel (focused -> enabled) BEFORE the refetch; tear it
      // down on blur.
      setFocused(true);
      setActiveRoom(room.id);
      void refreshConversation();
      return () => {
        setFocused(false);
        setActiveRoom(null);
      };
    }, [refreshConversation, room.id, setActiveRoom])
  );

  const onRealtimeChange = useCallback((event: MessageChangeEvent) => {
    setMessages((prev) => applyMessageChangeSorted(prev, event, sortAsc));
  }, []);

  useMessagesRealtime({
    roomId: room.id,
    onChange: onRealtimeChange,
    // A reconnect may have dropped events — refetch (idempotent merge makes
    // this race-free; lesson F1).
    onRecovered: () => void refreshConversation(),
    enabled: focused,
  });

  const performSend = useCallback(
    async (text: string, messageId: string) => {
      const result = await sendMessage(room.id, text, messageId);
      return result.status === 'ok'
        ? ({ status: 'ok', row: result.message } as const)
        : // Carry the already-mapped copy (never raw server text) to the bubble.
          ({ status: 'failed', message: result.message } as const);
    },
    [room.id, sendMessage]
  );

  const onSent = useCallback((row: MessageRow) => {
    // Merge the authoritative row now; its realtime echo no-ops.
    setMessages((prev) => applyMessageChangeSorted(prev, { eventType: 'INSERT', row }, sortAsc));
  }, []);

  const { pending, submit, retry } = useSendQueue<MessageRow>({ send: performSend, onSent });

  const { counterpartLastReadAt } = useReadReceipt({ roomId: room.id, myId, enabled: focused });
  const { counterpartTyping, notifyActivity, notifyStopped } = useTypingBroadcast({ roomId: room.id, myId, enabled: focused });

  const onChangeDraft = useCallback(
    (text: string) => {
      draftRef.current = text;
      setDraft(text);
      setUnsentDraft(room.id, text);
      if (text.trim().length > 0) {
        notifyActivity(); // debounced inside the hook — never per-keystroke traffic
      } else {
        notifyStopped();
      }
    },
    [notifyActivity, notifyStopped, room.id]
  );

  const send = useCallback(() => {
    const text = draftRef.current.trim();
    if (text.length === 0) return;
    draftRef.current = ''; // synchronous — a double-fire sees '' and no-ops
    setDraft('');
    setUnsentDraft(room.id, '');
    notifyStopped();
    submit(text);
  }, [submit, notifyStopped, room.id]);

  // The single quiet "Read" marker (design D5) — shared derivation (L2).
  const readMarkerId = useMemo(
    () => deriveReadMarkerId(messages, myId, counterpartLastReadAt),
    [messages, myId, counterpartLastReadAt]
  );

  // Inverted list: newest first. Pending sends are newer than everything.
  const listData = useMemo<ConversationListItem[]>(() => {
    const rows: ConversationListItem[] = [];
    for (let i = pending.length - 1; i >= 0; i--) {
      rows.push({ kind: 'pending', pending: pending[i] });
    }
    rows.push(...buildInvertedChatItems(messages));
    return rows;
  }, [pending, messages]);

  return {
    myId,
    listData,
    loading: loading && messages.length === 0,
    error: messages.length === 0 ? error : null,
    hasEarlier,
    loadingEarlier,
    earlierError,
    loadEarlier,
    retry,
    counterpartLastReadAt,
    counterpartTyping,
    readMarkerId,
    draft,
    onChangeDraft,
    send,
  };
}
