/**
 * Customer conversation screen (build-order step 15-16) — one chat room,
 * reached from an Inbox thread row. Serif header (barber name + service
 * context), inverted message list, input row with send.
 *
 * REALTIME + FOCUS (copies the step 13-14 reference architecture verbatim):
 * - Channel gated on focus via useFocusEffect, opened BEFORE the baseline
 *   fetch so no message is missed in the gap window; torn down on blur.
 * - Snapshot rows and stream events both fold through applyMessageChange
 *   (idempotent upsert-by-id) with the reference-preserving sorted-merge
 *   bailout (lesson F2), sorted created_at ascending, id tiebreak.
 * - onRecovered re-runs the baseline fetch after a reconnect (lesson F1).
 *
 * SENDING — honest optimistic state via useSendQueue, no fabricated rows: an
 * in-flight send renders as a distinct "Sending…" bubble from local state
 * (its text only, no fake id/timestamp), then is replaced by the
 * authoritative server row on success — whose realtime echo reconciles to a
 * no-op. A failed send flips to "Not sent — tap to retry" and stays visible
 * for as long as this screen is up (it is local state, so it does not
 * survive leaving the screen — nothing fake is ever persisted). Double-fire
 * protection is SYNCHRONOUS (review finding M1): the draft mirror ref here
 * plus the in-flight key guard inside useSendQueue — React state alone
 * commits too late, and a duplicate message insert would be permanent. No
 * read receipts, no typing indicator, no presence — none of those are real.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import type { Palette } from '../../theme/colors';
import type { MessageRow } from '../../types';
import type { CustomerStackParamList } from '../CustomerNavigator';
import { fetchConversation, sendMessage } from '../conversationData';
import {
  applyMessageChange,
  applyMessageChangeSorted,
  type MessageChangeEvent,
} from '../../shared/messageRealtime';
import { useMessagesRealtime } from '../../shared/useMessagesRealtime';
import { useSendQueue, type PendingSend } from '../../shared/useSendQueue';
import { formatMessageTime } from '../../shared/format';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Conversation'>;

/** Ascending by created_at, id tiebreak so equal timestamps stay stable. */
function sortAsc(rows: MessageRow[]): MessageRow[] {
  return [...rows].sort((a, b) => {
    const c = a.created_at.localeCompare(b.created_at);
    return c !== 0 ? c : a.id.localeCompare(b.id);
  });
}

/** Inverted-list row: newest first (index 0 renders at the bottom). */
type ListItem =
  | { kind: 'pending'; pending: PendingSend }
  | { kind: 'message'; message: MessageRow };

export default function ConversationScreen({ route, navigation }: Props) {
  const { room, title, subtitle } = route.params;
  const { colors } = useTheme();
  const styles = useStyles(colors);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchConversation(room.id);
    setLoading(false);
    if (result.status === 'ok') {
      setMessages((prev) => {
        let next = prev;
        for (const row of result.messages) {
          next = applyMessageChange(next, { eventType: 'INSERT', row });
        }
        // All-no-op snapshot (the common recovery case): same reference,
        // no sort, no re-render.
        return next === prev ? prev : sortAsc(next);
      });
    } else {
      setError(result.message);
    }
  }, [room.id]);

  useFocusEffect(
    useCallback(() => {
      // Open the channel (focused -> enabled) BEFORE the refetch; tear it
      // down on blur.
      setFocused(true);
      void load();
      return () => setFocused(false);
    }, [load])
  );

  const onRealtimeChange = useCallback((event: MessageChangeEvent) => {
    setMessages((prev) => applyMessageChangeSorted(prev, event, sortAsc));
  }, []);

  useMessagesRealtime({
    roomId: room.id,
    onChange: onRealtimeChange,
    // A reconnect may have dropped events — refetch (idempotent merge makes
    // this race-free; lesson F1).
    onRecovered: load,
    enabled: focused,
  });

  const performSend = useCallback(
    async (text: string) => {
      const result = await sendMessage(room.id, text);
      return result.status === 'ok'
        ? ({ status: 'ok', row: result.message } as const)
        : ({ status: 'failed' } as const);
    },
    [room.id]
  );

  const onSent = useCallback((row: MessageRow) => {
    // Merge the authoritative row now; its realtime echo no-ops.
    setMessages((prev) => applyMessageChangeSorted(prev, { eventType: 'INSERT', row }, sortAsc));
  }, []);

  const { pending, submit, retry } = useSendQueue<MessageRow>({ send: performSend, onSent });

  const onChangeDraft = useCallback((text: string) => {
    draftRef.current = text;
    setDraft(text);
  }, []);

  const onSend = useCallback(() => {
    const text = draftRef.current.trim();
    if (text.length === 0) return;
    draftRef.current = ''; // synchronous — a double-fire sees '' and no-ops
    setDraft('');
    submit(text);
  }, [submit]);

  // Inverted list: newest first. Pending sends are newer than everything.
  const listData = useMemo<ListItem[]>(() => {
    const rows: ListItem[] = [];
    for (let i = pending.length - 1; i >= 0; i--) {
      rows.push({ kind: 'pending', pending: pending[i] });
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      rows.push({ kind: 'message', message: messages[i] });
    }
    return rows;
  }, [pending, messages]);

  const showSpinner = loading && messages.length === 0;
  const showError = error !== null && messages.length === 0;
  const canSend = draft.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']} testID="customer-conversation-screen">
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          testID="customer-conversation-back"
        >
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>
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
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {showSpinner ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="customer-conversation-loading"
          />
        ) : showError ? (
          <View testID="customer-conversation-error" accessibilityRole="alert" style={styles.notice}>
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            inverted
            data={listData}
            keyExtractor={(item) =>
              item.kind === 'pending' ? `pending-${item.pending.key}` : item.message.id
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              // NO manual counter-transform here: VirtualizedList composes its
              // own inversion style onto ListEmptyComponent, and on Android
              // that inversion is scale(-1) (both axes), not scaleY(-1) — a
              // manual transform overrides RN's counter-flip (same style key)
              // and mirrors the text horizontally. Founder-reported bug,
              // fixed 2026-07-10.
              <View style={styles.empty}>
                <Text style={styles.emptyText} testID="customer-conversation-empty">
                  No messages yet. Say hello.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.kind === 'pending') {
                const p = item.pending;
                return (
                  <Pressable
                    disabled={!p.failed}
                    onPress={() => retry(p.key)}
                    accessibilityRole={p.failed ? 'button' : undefined}
                    accessibilityLabel={p.failed ? 'Retry sending message' : undefined}
                    style={[styles.bubble, styles.bubbleOwn, p.failed ? styles.bubbleFailed : null]}
                    testID={
                      p.failed
                        ? `customer-conversation-failed-${p.key}`
                        : `customer-conversation-sending-${p.key}`
                    }
                  >
                    <Text style={styles.bubbleText}>{p.text}</Text>
                    <Text style={p.failed ? styles.bubbleMetaFailed : styles.bubbleMeta}>
                      {p.failed ? 'Not sent — tap to retry' : 'Sending…'}
                    </Text>
                  </Pressable>
                );
              }
              const m = item.message;
              const own = m.sender_id === myId;
              return (
                <View
                  style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleTheirs]}
                  testID={`customer-conversation-message-${m.id}`}
                >
                  <Text style={styles.bubbleText}>{m.message}</Text>
                  <Text style={styles.bubbleMeta}>{formatMessageTime(m.created_at)}</Text>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Write a message"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={styles.input}
            testID="customer-conversation-input"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={onSend}
            disabled={!canSend}
            style={[styles.sendButton, !canSend ? styles.sendButtonDisabled : null]}
            testID="customer-conversation-send"
          >
            <Text style={styles.sendLabel}>Send</Text>
          </Pressable>
        </View>
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
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    backGlyph: { fontSize: 22, color: colors.textPrimary },
    headerText: { flex: 1, minWidth: 0 },
    headerTitle: { fontSize: 18, color: colors.textPrimary, fontFamily: fonts.headingMedium },
    headerSubtitle: { fontSize: 12, marginTop: 2, color: colors.textSecondary, fontFamily: fonts.body },

    body: { flex: 1 },
    spinner: { marginTop: 48 },
    notice: {
      borderWidth: 0.5,
      borderRadius: 8,
      padding: 12,
      marginTop: 24,
      marginHorizontal: 24,
      borderColor: colors.error,
      backgroundColor: colors.surface,
    },
    noticeText: { fontSize: 14, color: colors.errorText, fontFamily: fonts.bodyMedium },

    listContent: { paddingHorizontal: 24, paddingVertical: 16, flexGrow: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body },

    bubble: {
      maxWidth: '80%',
      borderWidth: 0.5,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
      backgroundColor: colors.surface,
    },
    bubbleTheirs: { alignSelf: 'flex-start', borderColor: colors.border },
    bubbleOwn: { alignSelf: 'flex-end', borderColor: colors.accent },
    bubbleFailed: { borderColor: colors.error },
    bubbleText: { fontSize: 14, lineHeight: 20, color: colors.textPrimary, fontFamily: fonts.body },
    bubbleMeta: { fontSize: 10, marginTop: 4, color: colors.textSecondary, fontFamily: fonts.body },
    bubbleMetaFailed: { fontSize: 10, marginTop: 4, color: colors.errorText, fontFamily: fonts.bodyMedium },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderWidth: 0.5,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: fonts.body,
    },
    sendButton: {
      borderRadius: 8,
      paddingHorizontal: 18,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    sendButtonDisabled: { opacity: 0.4 },
    sendLabel: { fontSize: 14, color: colors.onAccent, fontFamily: fonts.bodySemiBold },
  });
}
