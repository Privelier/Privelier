/**
 * "Delete account" for both apps. The sheet states exactly what happens and
 * needs the word DELETE (LÖSCHEN) typed before it acts. The server
 * (delete-account Edge Function + delete_own_account, migration 0057)
 * cancels upcoming bookings, erases the account and keeps the other
 * person's history anonymized. After success `onDeleted` clears the session.
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
          ? 'Dein Profil, deine Fotos und Dokumente werden dauerhaft gelöscht, offene und kommende Termine werden abgesagt. Wer mit dir gebucht oder geschrieben hat, behält den Verlauf ohne deinen Namen. Das kann nicht rückgängig gemacht werden.'
          : 'Your profile, photos and documents are permanently deleted, and pending or upcoming bookings are cancelled. People you booked or chatted with keep their history without your name. This cannot be undone.'}
        confirmPhrase={de
          ? { word: 'LÖSCHEN', prompt: 'Tippe LÖSCHEN, um zu bestätigen' }
          : { word: 'DELETE', prompt: 'Type DELETE to confirm' }}
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
