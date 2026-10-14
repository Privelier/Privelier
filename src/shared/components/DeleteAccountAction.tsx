/**
 * "Delete account" for both apps (migration 0043). A destructive row
 * opens a confirmation sheet that states exactly what is removed; the server
 * function deletes only the signed-in account and refuses while a booking is
 * pending or accepted, which is surfaced as guidance rather than an error.
 * After a successful deletion the local session is cleared via `onDeleted`.
 */
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { pressOpacity } from '../../theme/motion';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { getAppLanguage } from '../locale';
import { deleteOwnAccount } from '../moderationData';
import { ConfirmSheet } from './ConfirmSheet';
import { useToast } from './ToastProvider';

export function DeleteAccountAction({ onDeleted, testID }: { onDeleted: () => void; testID: string }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  const runDelete = useCallback(async () => {
    setConfirming(false);
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    const result = await deleteOwnAccount();
    deletingRef.current = false;
    setDeleting(false);
    if (result.status === 'ok') {
      showToast({ message: de ? 'Dein Konto wurde gelöscht.' : 'Your account has been deleted.' });
      onDeleted();
      return;
    }
    showToast({ message: result.message, durationMs: 7000 });
  }, [onDeleted, showToast, de]);

  return (
    <>
      <Pressable
        onPress={() => setConfirming(true)}
        disabled={deleting}
        accessibilityRole="button"
        accessibilityLabel={de ? 'Konto löschen' : 'Delete account'}
        accessibilityState={{ busy: deleting, disabled: deleting }}
        testID={testID}
        style={({ pressed }) => [styles.row, pressed ? { opacity: pressOpacity.soft } : null]}
      >
        {deleting ? <ActivityIndicator size="small" color={colors.errorText} /> : <Feather name="trash-2" size={20} color={colors.errorText} />}
        <Text style={[styles.label, { color: colors.errorText, fontFamily: fonts.body }]}>
          {de ? 'Konto löschen' : 'Delete account'}
        </Text>
      </Pressable>
      <ConfirmSheet
        open={confirming}
        title={de ? 'Konto endgültig löschen?' : 'Delete your account?'}
        message={de
          ? 'Dein Profil, deine Termine, Chats, Bewertungen und Bilder werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden. Offene oder bestätigte Termine musst du vorher absagen.'
          : 'Your profile, bookings, chats, reviews and photos are permanently deleted. This cannot be undone. Pending or accepted bookings must be cancelled first.'}
        confirmLabel={de ? 'Endgültig löschen' : 'Delete permanently'}
        cancelLabel={de ? 'Behalten' : 'Keep account'}
        destructive
        onConfirm={() => void runDelete()}
        onClose={() => setConfirming(false)}
        testID={`${testID}-confirm`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  label: { fontSize: 14 },
});
