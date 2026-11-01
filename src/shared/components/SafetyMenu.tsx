/**
 * Safety actions for another person: report and block/unblock. Used by both
 * conversation headers and over the photo on a barber's public profile
 * (portfolio and bio are reportable there). The database enforces the outcome: a
 * block stops new messages and booking requests in both directions and
 * hides the barber from the customer's discovery, so the copy describes
 * exactly that and nothing more.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { getAppLanguage } from '../locale';
import { haptics } from '../haptics';
import { blockUser, hasBlocked, unblockUser } from '../moderationData';
import { ActionSheet, SheetAction } from './ActionSheet';
import { ConfirmSheet } from './ConfirmSheet';
import { ReportSheet } from './ReportSheet';
import { useToast } from './ToastProvider';

type Props = {
  counterpartId: string;
  counterpartName: string;
  bookingId: string | null;
  testIDPrefix: string;
  /** Over a photo the trigger takes the caller's disc style and icon color. */
  triggerStyle?: PressableProps['style'];
  iconColor?: string;
  iconSize?: number;
};

type Mode = 'closed' | 'menu' | 'report' | 'block';

export function SafetyMenu({ counterpartId, counterpartName, bookingId, testIDPrefix, triggerStyle, iconColor, iconSize = 22 }: Props) {
  const { colors } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('closed');
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let active = true;
    void hasBlocked(counterpartId).then((value) => { if (active) setBlocked(value); });
    return () => { active = false; };
  }, [counterpartId]);

  const close = useCallback(() => setMode('closed'), []);

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
        style={triggerStyle ?? styles.trigger}
      >
        <Feather name="more-horizontal" size={iconSize} color={iconColor ?? colors.textPrimary} />
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

      <ReportSheet
        open={mode === 'report'}
        target={{ type: 'user', userId: counterpartId }}
        bookingId={bookingId}
        onClose={close}
        testIDPrefix={testIDPrefix}
      />

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

const styles = StyleSheet.create({
  trigger: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
