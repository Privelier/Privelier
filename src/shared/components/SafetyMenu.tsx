/**
 * Safety actions for a conversation counterpart: report and block/unblock.
 * Used by both conversation headers (each app keeps its own screen; this is
 * only the shared action surface). The database enforces the outcome — a
 * block stops new messages and booking requests in both directions — so the
 * copy describes exactly that and nothing more.
 */
import { SheetTextInput } from './SheetTextInput';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { ReduceMotion } from 'react-native-reanimated';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { SheetGlassBackground } from './SheetGlassBackground';
import { getAppLanguage } from '../locale';
import { haptics } from '../haptics';
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  blockUser,
  hasBlocked,
  reportReasonLabel,
  reportUser,
  unblockUser,
  type ReportReason,
} from '../moderationData';
import { ConfirmSheet } from './ConfirmSheet';
import { useToast } from './ToastProvider';

type Props = {
  counterpartId: string;
  counterpartName: string;
  bookingId: string | null;
  testIDPrefix: string;
};

type Mode = 'closed' | 'menu' | 'report' | 'block';

export function SafetyMenu({ counterpartId, counterpartName, bookingId, testIDPrefix }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('closed');
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    void hasBlocked(counterpartId).then((value) => { if (active) setBlocked(value); });
    return () => { active = false; };
  }, [counterpartId]);

  const close = useCallback(() => setMode('closed'), []);

  const submitReport = useCallback(async () => {
    if (!reason || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const result = await reportUser({ reportedId: counterpartId, reason, details, bookingId });
    busyRef.current = false;
    setBusy(false);
    if (result.status === 'ok') {
      void haptics.success();
      setMode('closed');
      setReason(null);
      setDetails('');
      showToast({ message: de ? 'Danke. Wir prüfen deine Meldung persönlich.' : 'Thank you. We review every report personally.' });
    } else {
      showToast({ message: result.message });
    }
  }, [reason, counterpartId, details, bookingId, showToast, de]);

  const toggleBlock = useCallback(async () => {
    setMode('closed');
    const result = blocked ? await unblockUser(counterpartId) : await blockUser(counterpartId);
    if (result.status !== 'ok') {
      showToast({ message: result.message });
      return;
    }
    setBlocked(!blocked);
    void haptics.warning();
    showToast({
      message: blocked
        ? de ? `${counterpartName} ist nicht mehr blockiert.` : `${counterpartName} is unblocked.`
        : de ? `${counterpartName} ist blockiert.` : `${counterpartName} is blocked.`,
    });
  }, [blocked, counterpartId, counterpartName, showToast, de]);

  return (
    <>
      <Pressable
        onPress={() => setMode('menu')}
        accessibilityRole="button"
        accessibilityLabel={de ? 'Sicherheitsoptionen' : 'Safety options'}
        hitSlop={8}
        testID={`${testIDPrefix}-safety`}
        style={styles.trigger}
      >
        <Feather name="more-horizontal" size={22} color={colors.textPrimary} />
      </Pressable>

      <ActionSheet open={mode === 'menu'} onClose={close} testID={`${testIDPrefix}-safety-menu`}>
        <SheetAction
          icon="flag"
          label={de ? `${counterpartName} melden` : `Report ${counterpartName}`}
          onPress={() => setMode('report')}
          testID={`${testIDPrefix}-safety-report`}
        />
        <SheetAction
          icon={blocked ? 'unlock' : 'slash'}
          label={blocked
            ? de ? 'Blockierung aufheben' : 'Unblock'
            : de ? `${counterpartName} blockieren` : `Block ${counterpartName}`}
          destructive={!blocked}
          onPress={() => (blocked ? void toggleBlock() : setMode('block'))}
          testID={`${testIDPrefix}-safety-block`}
        />
      </ActionSheet>

      <ActionSheet open={mode === 'report'} onClose={close} testID={`${testIDPrefix}-report-sheet`}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {de ? 'Was ist passiert?' : 'What happened?'}
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
                  { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : 'transparent' },
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
          onPress={() => void submitReport()}
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

      <ConfirmSheet
        open={mode === 'block'}
        title={de ? `${counterpartName} blockieren?` : `Block ${counterpartName}?`}
        message={de
          ? 'Ihr könnt euch keine Nachrichten mehr senden und keine neuen Terminanfragen stellen. Bestehende Termine bleiben bestehen, bis sie abgesagt werden.'
          : 'Neither of you can send new messages or booking requests. Existing bookings stay until one of you cancels them.'}
        confirmLabel={de ? 'Blockieren' : 'Block'}
        cancelLabel={de ? 'Abbrechen' : 'Cancel'}
        destructive
        onConfirm={() => void toggleBlock()}
        onClose={close}
        testID={`${testIDPrefix}-block-confirm`}
      />
    </>
  );
}

function ActionSheet({ open, onClose, testID, children }: { open: boolean; onClose: () => void; testID: string; children: ReactNode }) {
  const { colors } = useTheme();
  const sheet = useRef<BottomSheetModal>(null);
  useEffect(() => {
    if (open) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [open]);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />,
    []
  );
  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      overrideReduceMotion={ReduceMotion.System}
      backgroundComponent={SheetGlassBackground}
      handleIndicatorStyle={{ backgroundColor: colors.accent, width: 32 }}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
    >
      <BottomSheetView style={styles.sheet} testID={testID}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
}

function SheetAction({ icon, label, onPress, destructive = false, testID }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  const tone = destructive ? colors.errorText : colors.textPrimary;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID} style={[styles.action, { borderColor: colors.border }]}>
      <Feather name={icon} size={18} color={tone} />
      <Text style={[styles.actionText, { color: tone, fontFamily: fonts.bodyMedium }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sheet: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['3xl'], gap: space.md },
  title: { fontSize: 24, lineHeight: 30 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  reason: { minHeight: 44, borderWidth: HAIRLINE, borderRadius: radius.pill, paddingHorizontal: space.base, justifyContent: 'center' },
  reasonText: { fontSize: 14 },
  details: { minHeight: 88, borderWidth: HAIRLINE, borderRadius: radius.md, padding: space.md, fontSize: 15, textAlignVertical: 'top' },
  note: { fontSize: 13, lineHeight: 19 },
  submit: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 15 },
  action: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: HAIRLINE },
  actionText: { fontSize: 16 },
});
