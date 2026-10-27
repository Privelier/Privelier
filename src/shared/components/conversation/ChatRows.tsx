/**
 * Rows of the inverted chat list: day dividers, pending/failed sends, sent
 * and received bubbles, and the "load earlier" control.
 *
 * A pending send renders from local state as "Sending…" and flips to
 * "Not sent · tap to retry" with the data layer's reason on failure. The
 * other person's messages can be reported (long press or the screen
 * reader's actions); a deleted sender's cannot.
 */
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { pressOpacity } from '../../../theme/motion';
import { useTheme } from '../../../theme/useTheme';
import type { MessageRow } from '../../../types';
import { formatMessageClock } from '../../format';
import { deriveIsRead } from '../../readReceipts';
import type { PendingSend } from '../../useSendQueue';
import { MessageReceipt } from '../MessageReceipt';
import { MessageText } from '../MessageText';
import type { ConversationStyles } from './conversationStyles';

type Glass = StyleProp<ViewStyle>;

export function DayDivider({ styles, label, glass }: { styles: ConversationStyles; label: string; glass: Glass }) {
  return (
    <View style={styles.dayDivider}>
      <View style={styles.dayRule} />
      <View style={[styles.dayPill, glass]}><Text style={styles.dayLabel}>{label}</Text></View>
      <View style={styles.dayRule} />
    </View>
  );
}

export function PendingBubble({ styles, pending, ownGlass, failedGlass, de, testIDPrefix, onRetry }: {
  styles: ConversationStyles;
  pending: PendingSend;
  ownGlass: Glass;
  failedGlass: Glass;
  de: boolean;
  testIDPrefix: string;
  onRetry: () => void;
}) {
  const p = pending;
  return (
    <Pressable
      disabled={!p.failed}
      onPress={onRetry}
      accessibilityRole={p.failed ? 'button' : undefined}
      accessibilityLabel={p.failed ? (de ? 'Erneut senden' : 'Retry sending message') : undefined}
      style={[styles.bubble, styles.bubbleOwn, p.failed ? failedGlass : [ownGlass, styles.bubblePending]]}
      testID={p.failed ? `${testIDPrefix}-failed-${p.key}` : `${testIDPrefix}-sending-${p.key}`}
    >
      <Text style={styles.bubbleText}>{p.text}</Text>
      <Text style={p.failed ? styles.bubbleMetaFailed : styles.bubbleMeta}>
        {p.failed ? (de ? 'Nicht gesendet · tippen zum Wiederholen' : 'Not sent · tap to retry') : (de ? 'Wird gesendet …' : 'Sending…')}
      </Text>
      {p.failed ? <MessageReceipt state="failed" testID={`${testIDPrefix}-failed-receipt-${p.key}`} /> : null}
      {/* The reason, when the data layer gave one. Without it a failure
          retrying cannot fix is an undiagnosable dead end. */}
      {p.failed && p.failureMessage ? (
        <Text style={styles.bubbleFailureReason} testID={`${testIDPrefix}-failure-reason-${p.key}`}>{p.failureMessage}</Text>
      ) : null}
    </Pressable>
  );
}

export function MessageBubble({ styles, message, own, showTimestamp, glass, counterpartLastReadAt, isReadMarker, de, testIDPrefix, onReport }: {
  styles: ConversationStyles;
  message: MessageRow;
  own: boolean;
  showTimestamp: boolean;
  glass: Glass;
  counterpartLastReadAt: string | null;
  isReadMarker: boolean;
  de: boolean;
  testIDPrefix: string;
  onReport: () => void;
}) {
  const { colors } = useTheme();
  const m = message;
  const reportable = !own && m.sender_id !== null;
  return (
    <Pressable
      disabled={!reportable}
      onLongPress={onReport}
      accessibilityActions={reportable ? [{ name: 'report', label: de ? 'Nachricht melden' : 'Report message' }] : undefined}
      onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'report') onReport(); }}
      style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleTheirs, glass]}
      testID={`${testIDPrefix}-message-${m.id}`}
    >
      <MessageText text={m.message} style={styles.bubbleText} linkColor={colors.accentText} testID={`${testIDPrefix}-text-${m.id}`} />
      {showTimestamp || own ? (
        <View style={styles.bubbleFooter}>
          {showTimestamp ? <Text style={styles.bubbleMeta}>{formatMessageClock(m.created_at)}</Text> : null}
          {own ? (
            <MessageReceipt
              state={deriveIsRead(counterpartLastReadAt, m.created_at) ? 'read' : 'sent'}
              testID={isReadMarker ? `${testIDPrefix}-read-marker` : `${testIDPrefix}-receipt-${m.id}`}
            />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function LoadEarlier({ styles, loading, error, de, testIDPrefix, onPress }: {
  styles: ConversationStyles;
  loading: boolean;
  error: string | null;
  de: boolean;
  testIDPrefix: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const label = de ? 'Ältere Nachrichten laden' : 'Load earlier messages';
  return (
    <View style={styles.historyControl}>
      {error ? (
        <Text accessibilityRole="alert" style={styles.earlierError} testID={`${testIDPrefix}-earlier-error`}>{error}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: loading, busy: loading }}
        disabled={loading}
        onPress={onPress}
        style={({ pressed }) => [styles.loadEarlierButton, loading ? styles.loadEarlierButtonDisabled : pressed ? { opacity: pressOpacity.firm } : null]}
        testID={`${testIDPrefix}-load-earlier`}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} style={styles.loadEarlierIndicator} testID={`${testIDPrefix}-loading-earlier`} />
        ) : null}
        <Text style={styles.loadEarlierLabel}>{label}</Text>
      </Pressable>
    </View>
  );
}
