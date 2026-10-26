/**
 * The booking chat, shared by both apps' Conversation screens (each app keeps
 * its own screen, navigation and data layer and passes them in).
 *
 * REALTIME + FOCUS (same architecture as useBookingsRealtime):
 * - Channel gated on focus via useFocusEffect, opened BEFORE the baseline
 *   fetch so no message is missed in the gap window; torn down on blur.
 * - Snapshot rows and stream events both fold through applyMessageChange
 *   (idempotent upsert-by-id) with the reference-preserving sorted-merge
 *   bailout (lesson F2), sorted created_at ascending, id tiebreak.
 * - onRecovered re-runs the baseline fetch after a reconnect (lesson F1).
 *
 * SENDING: honest optimistic state via useSendQueue, no fabricated rows. An
 * in-flight send renders as a distinct "Sending…" bubble from local state,
 * then is replaced by the authoritative server row on success, whose
 * realtime echo reconciles to a no-op. A failed send flips to "Not sent, tap
 * to retry" for as long as the screen is up. Double-fire protection is
 * synchronous (review finding M1): the draft mirror ref here plus the
 * in-flight key guard inside useSendQueue.
 *
 * READ RECEIPTS + TYPING (migration 0017): the receipt comes from the
 * counterpart's own chat_read_state.last_read_at via useReadReceipt, typing
 * from a private typing:{chat_id} broadcast; both observed, never invented.
 *
 * SAFETY: the other person's messages can be reported (long press or the
 * screen reader's actions); the header menu reports or blocks the person.
 * Neither appears once that person deleted their account (migration 0057).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import { getAppLanguage } from '../locale';
import { pressOpacity } from '../../theme/motion';
import { Notice } from './Notice';
import { ConversationSkeleton } from './ScreenSkeletons';
import { BackButton } from './ScreenBackHeader';
import type { Palette } from '../../theme/colors';
import type { ChatRoomRow, MessageRow } from '../../types';
import type { ConversationCursor } from '../conversationPagination';
import {
  applyMessageChange,
  applyMessageChangeSorted,
  type MessageChangeEvent,
} from '../messageRealtime';
import { useMessagesRealtime } from '../useMessagesRealtime';
import { useReadReceipt } from '../useReadReceipt';
import { useTypingBroadcast } from '../useTypingBroadcast';
import { deriveIsRead, deriveReadMarkerId } from '../readReceipts';
import { MessageReceipt } from './MessageReceipt';
import { GlassSurface, glass, useGlassStyle } from './GlassSurface';
import { JumpToLatestButton, JUMP_TO_LATEST_THRESHOLD } from './JumpToLatestButton';
import { Feather } from '@expo/vector-icons';
import { SafetyMenu } from './SafetyMenu';
import { ReportSheet } from './ReportSheet';
import { MessageText } from './MessageText';
import { useSendQueue, type PendingSend } from '../useSendQueue';
import { MAX_MESSAGE_LENGTH, MESSAGE_COUNTER_VISIBLE_AT } from '../messageLimits';
import { formatMessageClock } from '../format';
import { buildInvertedChatItems } from '../chatPresentation';
import { Avatar } from './Avatar';

type Failure = { status: 'error'; message: string };

/** Each app passes its own data layer; both share these result shapes. */
interface ConversationApi {
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

interface ConversationCounterpart {
  id: string;
  name: string | null;
  profile_image: string | null;
}

interface Props {
  room: ChatRoomRow;
  title: string;
  subtitle?: string | null;
  counterpart: ConversationCounterpart | null;
  /** The other participant's id from the room; null once they deleted their account. */
  counterpartFallbackId: string | null;
  api: ConversationApi;
  /** Tells the app's unread provider which room is on screen (null on blur). */
  setActiveRoom: (roomId: string | null) => void;
  onBack: () => void;
  /** Shown above an empty composer; tapping one fills it, sending stays manual. */
  quickReplies?: readonly string[];
  /** `${testIDPrefix}` | 'barber-conversation': keeps Maestro ids stable. */
  testIDPrefix: string;
}

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

/** Inverted-list row: newest first (index 0 renders at the bottom). */
type ListItem =
  | { kind: 'pending'; pending: PendingSend }
  | ReturnType<typeof buildInvertedChatItems>[number];

export function ConversationView({
  room,
  title,
  subtitle,
  counterpart,
  counterpartFallbackId,
  api,
  setActiveRoom,
  onBack,
  quickReplies,
  testIDPrefix,
}: Props) {
  const de = getAppLanguage() === 'de';
  const { fetchConversation, fetchConversationNewerThan, sendMessage } = api;
  const { colors } = useTheme();
  const styles = useStyles(colors);
  // Glass bubbles: yours in brass glass, theirs in neutral glass, a failed
  // send in danger glass. One shared Reduce Transparency fallback.
  const ownGlass = useGlassStyle('brass');
  const theirGlass = useGlassStyle('neutral');
  const failedGlass = useGlassStyle('danger');
  const listRef = useRef<FlatList<ListItem>>(null);
  const [awayFromLatest, setAwayFromLatest] = useState(false);

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

  const [draft, setDraft] = useState('');
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  // Synchronous mirror of the draft: a same-tick double-fire of Send reads
  // '' from here and no-ops (review finding M1) — setDraft('') alone only
  // lands after the next commit.
  const draftRef = useRef('');

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

  // Mark-as-read is owned by the app's unread provider; this view only
  // declares which room is being looked at (the trigger: OPENING this
  // specific conversation, not the thread list loading).
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

  // Read receipt (counterpart's marker, live) + typing indicator (private
  // broadcast) — both real state only, nothing fabricated (design D5/C6).
  const { counterpartLastReadAt } = useReadReceipt({
    roomId: room.id,
    myId,
    enabled: focused,
  });
  const { counterpartTyping, notifyActivity, notifyStopped } = useTypingBroadcast({
    roomId: room.id,
    myId,
    enabled: focused,
  });

  const onChangeDraft = useCallback(
    (text: string) => {
      draftRef.current = text;
      setDraft(text);
      if (text.trim().length > 0) {
        notifyActivity(); // debounced inside the hook — never per-keystroke traffic
      } else {
        notifyStopped();
      }
    },
    [notifyActivity, notifyStopped]
  );

  const onSend = useCallback(() => {
    const text = draftRef.current.trim();
    if (text.length === 0) return;
    draftRef.current = ''; // synchronous — a double-fire sees '' and no-ops
    setDraft('');
    notifyStopped();
    submit(text);
  }, [submit, notifyStopped]);

  // The single quiet "Read" marker (design D5) — shared derivation (L2).
  const readMarkerId = useMemo(
    () => deriveReadMarkerId(messages, myId, counterpartLastReadAt),
    [messages, myId, counterpartLastReadAt]
  );

  // Inverted list: newest first. Pending sends are newer than everything.
  const listData = useMemo<ListItem[]>(() => {
    const rows: ListItem[] = [];
    for (let i = pending.length - 1; i >= 0; i--) {
      rows.push({ kind: 'pending', pending: pending[i] });
    }
    rows.push(...buildInvertedChatItems(messages));
    return rows;
  }, [pending, messages]);

  const showSpinner = loading && messages.length === 0;
  const showError = error !== null && messages.length === 0;
  const canSend = draft.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']} testID={`${testIDPrefix}-screen`}>
      <GlassSurface variant="navigation" style={styles.header} testID={`${testIDPrefix}-header-glass`}>
        <BackButton
          onPress={onBack}
          accessibilityLabel={de ? 'Zurück' : 'Back'}
          testID={`${testIDPrefix}-back`}
        />
        <Avatar id={counterpart?.id ?? counterpartFallbackId ?? room.id} name={counterpart?.name ?? title} imageUrl={counterpart?.profile_image} size={44} accessible={false} testID={`${testIDPrefix}-avatar`} />
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {/* Nobody to report or block once the other person deleted their account. */}
        {counterpart?.id ?? counterpartFallbackId ? (
          <SafetyMenu
            counterpartId={counterpart?.id ?? counterpartFallbackId ?? ''}
            counterpartName={counterpart?.name ?? title}
            bookingId={room.booking_id}
            testIDPrefix={testIDPrefix}
          />
        ) : null}
      </GlassSurface>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {showSpinner ? (
          <ConversationSkeleton
            testID={`${testIDPrefix}-loading`}
            label={getAppLanguage() === 'de' ? 'Nachrichten werden geladen' : 'Loading messages'}
          />
        ) : showError ? (
          <Notice testID={`${testIDPrefix}-error`} message={error ?? ''} style={styles.noticeMargins} />
        ) : (
          <FlatList
            ref={listRef}
            inverted
            testID={`${testIDPrefix}-list`}
            onScroll={(event) => {
              // Inverted: offset 0 is the newest message.
              const away = event.nativeEvent.contentOffset.y > JUMP_TO_LATEST_THRESHOLD;
              if (away !== awayFromLatest) setAwayFromLatest(away);
            }}
            scrollEventThrottle={64}
            data={listData}
            keyExtractor={(item) =>
              item.kind === 'pending' ? `pending-${item.pending.key}` : item.kind === 'day' ? item.key : item.message.id
            }
            contentContainerStyle={styles.listContent}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListFooterComponent={
              hasEarlier ? (
                <View style={styles.historyControl}>
                  {earlierError ? (
                    <Text
                      accessibilityRole="alert"
                      style={styles.earlierError}
                      testID={`${testIDPrefix}-earlier-error`}
                    >
                      {earlierError}
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={de ? 'Ältere Nachrichten laden' : 'Load earlier messages'}
                    accessibilityState={{ disabled: loadingEarlier, busy: loadingEarlier }}
                    disabled={loadingEarlier}
                    onPress={loadEarlier}
                    style={({ pressed }) => [
                      styles.loadEarlierButton,
                      loadingEarlier
                        ? styles.loadEarlierButtonDisabled
                        : pressed
                          ? { opacity: pressOpacity.firm }
                          : null,
                    ]}
                    testID={`${testIDPrefix}-load-earlier`}
                  >
                    {loadingEarlier ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.accent}
                        style={styles.loadEarlierIndicator}
                        testID={`${testIDPrefix}-loading-earlier`}
                      />
                    ) : null}
                    <Text style={styles.loadEarlierLabel}>{de ? 'Ältere Nachrichten laden' : 'Load earlier messages'}</Text>
                  </Pressable>
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              // NO manual counter-transform here: VirtualizedList composes its
              // own inversion style onto ListEmptyComponent, and on Android
              // that inversion is scale(-1) (both axes), not scaleY(-1) — a
              // manual transform overrides RN's counter-flip (same style key)
              // and mirrors the text horizontally.
              <View style={styles.empty}>
                <Text style={styles.emptyText} testID={`${testIDPrefix}-empty`}>
                  {de ? 'Noch keine Nachrichten. Sag hallo.' : 'No messages yet. Say hello.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.kind === 'day') return (
                <View style={styles.dayDivider}>
                  <View style={styles.dayRule} />
                  <View style={[styles.dayPill, theirGlass]}><Text style={styles.dayLabel}>{item.label}</Text></View>
                  <View style={styles.dayRule} />
                </View>
              );
              if (item.kind === 'pending') {
                const p = item.pending;
                return (
                  <Pressable
                    disabled={!p.failed}
                    onPress={() => retry(p.key)}
                    accessibilityRole={p.failed ? 'button' : undefined}
                    accessibilityLabel={p.failed ? (de ? 'Erneut senden' : 'Retry sending message') : undefined}
                    style={[styles.bubble, styles.bubbleOwn, p.failed ? failedGlass : [ownGlass, styles.bubblePending]]}
                    testID={
                      p.failed
                        ? `${testIDPrefix}-failed-${p.key}`
                        : `${testIDPrefix}-sending-${p.key}`
                    }
                  >
                    <Text style={styles.bubbleText}>{p.text}</Text>
                    <Text style={p.failed ? styles.bubbleMetaFailed : styles.bubbleMeta}>
                      {p.failed ? (de ? 'Nicht gesendet · tippen zum Wiederholen' : 'Not sent · tap to retry') : (de ? 'Wird gesendet …' : 'Sending…')}
                    </Text>
                    {p.failed ? <MessageReceipt state="failed" testID={`${testIDPrefix}-failed-receipt-${p.key}`} /> : null}
                    {/* The reason, when the data layer gave one. Without it a
                        failure retrying cannot fix is an undiagnosable dead end. */}
                    {p.failed && p.failureMessage ? (
                      <Text
                        style={styles.bubbleFailureReason}
                        testID={`${testIDPrefix}-failure-reason-${p.key}`}
                      >
                        {p.failureMessage}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              }
              const m = item.message;
              const own = m.sender_id === myId;
              // Their messages can be reported (long press, or the screen
              // reader's actions menu); a deleted sender's cannot.
              const reportable = !own && m.sender_id !== null;
              return (
                <Pressable
                  disabled={!reportable}
                  onLongPress={() => setReportMessageId(m.id)}
                  accessibilityActions={reportable ? [{ name: 'report', label: de ? 'Nachricht melden' : 'Report message' }] : undefined}
                  onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'report') setReportMessageId(m.id); }}
                  style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleTheirs, own ? ownGlass : theirGlass]}
                  testID={`${testIDPrefix}-message-${m.id}`}
                >
                  <MessageText text={m.message} style={styles.bubbleText} linkColor={colors.accentText} testID={`${testIDPrefix}-text-${m.id}`} />
                  {item.showTimestamp || own ? (
                    <View style={styles.bubbleFooter}>
                      {item.showTimestamp ? <Text style={styles.bubbleMeta}>{formatMessageClock(m.created_at)}</Text> : null}
                      {own ? (
                        <MessageReceipt
                          state={deriveIsRead(counterpartLastReadAt, m.created_at) ? 'read' : 'sent'}
                          testID={m.id === readMarkerId ? `${testIDPrefix}-read-marker` : `${testIDPrefix}-receipt-${m.id}`}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}

        {reportMessageId ? (
          <ReportSheet
            open
            target={{ type: 'message', messageId: reportMessageId }}
            bookingId={room.booking_id}
            onClose={() => setReportMessageId(null)}
            testIDPrefix={`${testIDPrefix}-message`}
          />
        ) : null}

        <JumpToLatestButton
          visible={awayFromLatest && !showSpinner && !showError}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          label={de ? 'Zur neuesten Nachricht' : 'Jump to latest message'}
          testID={`${testIDPrefix}-jump-latest`}
        />

        {/* Fixed-height slot: the indicator appears/disappears without any
            layout shift (typing state is ephemeral and frequent). */}
        <View style={styles.typingSlot} accessibilityLiveRegion="polite">
          {counterpartTyping ? (
            <Text style={styles.typingText} testID={`${testIDPrefix}-typing`}>
              {de ? 'Schreibt …' : 'Typing…'}
            </Text>
          ) : null}
        </View>

        {/* Quiet until the cap is actually near — see MESSAGE_COUNTER_VISIBLE_AT. */}
        {draft.length >= MESSAGE_COUNTER_VISIBLE_AT ? (
          <Text
            style={styles.messageCounter}
            accessibilityLabel={`${MAX_MESSAGE_LENGTH - draft.length} characters left`}
            testID={`${testIDPrefix}-counter`}
          >
            {draft.length} / {MAX_MESSAGE_LENGTH}
          </Text>
        ) : null}

        {quickReplies && draft.length === 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.quickRow}
            testID={`${testIDPrefix}-quick-replies`}
          >
            {quickReplies.map((reply, index) => (
              <Pressable
                key={reply}
                onPress={() => onChangeDraft(reply)}
                accessibilityRole="button"
                accessibilityLabel={reply}
                testID={`${testIDPrefix}-quick-reply-${index}`}
                style={({ pressed }) => [styles.quickChip, theirGlass, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.quickText}>{reply}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <GlassSurface variant="navigation" style={styles.inputRow} testID={`${testIDPrefix}-composer-glass`}>
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={getAppLanguage() === 'de' ? 'Nachricht schreiben' : 'Write a message'}
            accessibilityLabel={getAppLanguage() === 'de' ? 'Nachricht schreiben' : 'Write a message'}
            selectionColor={colors.accent}
            placeholderTextColor={colors.textSecondary}
            multiline
            // Mirrors the DB constraint so the server bound can never be the
            // rejecter (migration 0018 shipped without this, which is what made
            // an over-length paste permanently unsendable).
            maxLength={MAX_MESSAGE_LENGTH}
            style={styles.input}
            testID={`${testIDPrefix}-input`}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getAppLanguage() === 'de' ? 'Nachricht senden' : 'Send message'}
            onPress={onSend}
            disabled={!canSend}
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend ? styles.sendButtonDisabled : pressed ? { opacity: pressOpacity.firm } : null,
            ]}
            testID={`${testIDPrefix}-send`}
          >
            <Feather name="arrow-up" size={20} color={colors.onAccent} />
          </Pressable>
        </GlassSurface>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useStyles(colors: Palette) {
  const { fonts } = useTheme();
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 12,
      marginHorizontal: 12,
      marginTop: 8,
      borderRadius: 22,
    },
    headerText: { flex: 1, minWidth: 0 },
    headerTitle: { fontSize: 18, color: colors.textPrimary, fontFamily: fonts.headingMedium },
    headerSubtitle: { fontSize: 13, marginTop: 2, color: colors.textSecondary, fontFamily: fonts.body },

    body: { flex: 1 },
    noticeMargins: { marginTop: 24, marginHorizontal: 24 },

    listContent: { paddingHorizontal: 24, paddingVertical: 16, flexGrow: 1 },
    dayDivider: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34, marginVertical: 6 },
    dayRule: { flex: 1, height: 0.5, backgroundColor: 'rgba(191,160,107,0.32)' },
    dayPill: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
    dayLabel: { color: colors.textSecondary, fontSize: 11, fontFamily: fonts.bodyMedium },
    historyControl: { alignItems: 'center', paddingBottom: 16 },
    earlierError: {
      maxWidth: 280,
      marginBottom: 8,
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'center',
      color: colors.errorText,
      fontFamily: fonts.body,
    },
    loadEarlierButton: {
      minWidth: 200,
      minHeight: 44,
      paddingHorizontal: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
      borderRadius: 8,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    loadEarlierButtonDisabled: { opacity: 0.6 },
    loadEarlierIndicator: { position: 'absolute', left: 16 },
    loadEarlierLabel: { fontSize: 13, color: colors.accentText, fontFamily: fonts.bodyMedium },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body },

    bubble: {
      maxWidth: '86%',
      borderWidth: 0.5,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
      overflow: 'hidden',
    },
    bubbleTheirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
    bubbleOwn: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
    // Not yet confirmed by the server: a touch quieter than a delivered bubble.
    bubblePending: { opacity: 0.78 },
    bubbleText: { fontSize: 16, lineHeight: 23, color: colors.textPrimary, fontFamily: fonts.body },
    bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
    bubbleMeta: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },
    bubbleMetaFailed: { fontSize: 12, marginTop: 4, color: colors.errorText, fontFamily: fonts.bodyMedium },
    bubbleFailureReason: {
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
      color: colors.textSecondary,
      fontFamily: fonts.body,
    },
    // Muted and weight-only near the cap — never red: maxLength makes overflow
    // impossible, so reaching the limit is not an error state.
    messageCounter: {
      fontSize: 11,
      textAlign: 'right',
      paddingHorizontal: 16,
      paddingBottom: 4,
      color: colors.textSecondary,
      fontFamily: fonts.body,
    },

    typingSlot: { height: 18, justifyContent: 'center', paddingHorizontal: 24 },
    typingText: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginHorizontal: 12,
      marginBottom: 6,
      borderRadius: 22,
    },
    input: {
      flex: 1,
      minHeight: 48,
      maxHeight: 144,
      borderWidth: 0.5,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      // A recessed well inside the glass composer.
      borderColor: glass.edge,
      backgroundColor: 'rgba(8,8,10,0.42)',
      color: colors.textPrimary,
      fontFamily: fonts.body,
    },
    // Round brass send disc with a lit top edge, aligned to the input's last line.
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      experimental_backgroundImage: 'linear-gradient(160deg, rgba(255,240,210,0.38) 0%, rgba(255,240,210,0) 55%)',
      boxShadow: 'inset 0 1px 0 rgba(255,248,232,0.45), 0 6px 16px rgba(191,160,107,0.22)',
    },
    sendButtonDisabled: { opacity: 0.45 },

    quickRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    quickChip: { minHeight: 36, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 14, overflow: 'hidden' },
    quickText: { fontSize: 13, color: colors.textPrimary, fontFamily: fonts.body },
  });
}
