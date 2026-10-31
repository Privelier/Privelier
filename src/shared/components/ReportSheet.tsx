/**
 * Report a user, a chat message or a review. The server checks that the
 * reporter can see the target, snapshots the reported text for the
 * founders, and limits reports per hour (migrations 0042, 0055, 0056).
 */
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { getAppLanguage } from '../locale';
import { haptics } from '../haptics';
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  reportReasonLabel,
  reportUser,
  type ReportReason,
  type ReportTarget,
} from '../moderationData';
import { ActionSheet } from './ActionSheet';
import { SheetTextInput } from './SheetTextInput';
import { useToast } from './ToastProvider';
import { typeScale } from '../../theme/typography';

type Props = {
  open: boolean;
  target: ReportTarget;
  bookingId?: string | null;
  onClose: () => void;
  testIDPrefix: string;
};

export function ReportSheet({ open, target, bookingId = null, onClose, testIDPrefix }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const busyRef = useRef(false);

  const submit = useCallback(async () => {
    if (!reason || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const result = await reportUser({ target, reason, details, bookingId });
    busyRef.current = false;
    setBusy(false);
    if (result.status === 'ok') {
      void haptics.success();
      setReason(null);
      setDetails('');
      onClose();
      showToast({ message: de ? 'Danke. Wir prüfen deine Meldung persönlich.' : 'Thank you. We review every report personally.' });
    } else {
      showToast({ message: result.message });
    }
  }, [reason, target, details, bookingId, onClose, showToast, de]);

  const title = target.type === 'message'
    ? de ? 'Nachricht melden' : 'Report message'
    : target.type === 'review'
      ? de ? 'Bewertung melden' : 'Report review'
      : de ? 'Was ist passiert?' : 'What happened?';

  return (
    <ActionSheet open={open} onClose={onClose} testID={`${testIDPrefix}-report-sheet`}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {title}
      </Text>
      <View style={styles.reasons}>
        {REPORT_REASONS.map((key) => {
          const selected = reason === key;
          return (
            <Pressable
              key={key}
              onPress={() => { void haptics.selection(); setReason(key); }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={`${testIDPrefix}-report-reason-${key}`}
              style={[
                styles.reason,
                { borderColor: selected ? colors.accent : colors.inputBorder, backgroundColor: selected ? colors.accent : 'transparent' },
              ]}
            >
              <Text style={[styles.reasonText, { color: selected ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
                {reportReasonLabel(key)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <SheetTextInput
        value={details}
        onChangeText={(text) => setDetails(text.slice(0, REPORT_DETAILS_MAX))}
        placeholder={de ? 'Details (optional)' : 'Details (optional)'}
        placeholderTextColor={colors.textSecondary}
        multiline
        accessibilityLabel={de ? 'Details zur Meldung' : 'Report details'}
        testID={`${testIDPrefix}-report-details`}
        style={[styles.details, { borderColor: colors.border, color: colors.textPrimary, fontFamily: fonts.body }]}
      />
      <Text style={[styles.note, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {de
          ? 'Bei unmittelbarer Gefahr ruf bitte den Notruf 112 an.'
          : 'If you are in immediate danger, call your local emergency number.'}
      </Text>
      <Pressable
        onPress={() => void submit()}
        disabled={!reason || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !reason || busy, busy }}
        testID={`${testIDPrefix}-report-submit`}
        style={[styles.submit, { backgroundColor: reason ? colors.accent : colors.border }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={[styles.submitText, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
            {de ? 'Meldung senden' : 'Send report'}
          </Text>
        )}
      </Pressable>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, lineHeight: 30 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  reason: { minHeight: 44, borderWidth: HAIRLINE, borderRadius: radius.pill, paddingHorizontal: space.base, justifyContent: 'center' },
  reasonText: { fontSize: 14 },
  details: { minHeight: 88, borderWidth: HAIRLINE, borderRadius: radius.md, padding: space.md, fontSize: 15, textAlignVertical: 'top' },
  note: { ...typeScale.secondary },
  submit: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 15 },
});
