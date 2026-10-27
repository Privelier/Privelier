/**
 * The verification status card and the two document rows. Display only:
 * nothing here writes verification_status.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { pressOpacity } from '../../../theme/motion';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';
import type { VerificationRequestRow, VerificationStatus } from '../../../types';

type Language = 'de' | 'en';
type StatusCopy = { word: string; line: string; icon: keyof typeof Feather.glyphMap };

const STATUS_COPY: Record<Language, Record<VerificationStatus, StatusCopy>> = {
  de: {
    pending: { word: 'In Prüfung', line: 'Unser Team prüft deine Unterlagen persönlich.', icon: 'clock' },
    approved: { word: 'Verifiziert', line: 'Dein Profil ist für Kunden als verifiziert sichtbar.', icon: 'shield' },
    rejected: { word: 'Abgelehnt', line: 'Bitte kontaktiere unseren Support.', icon: 'x-circle' },
  },
  en: {
    pending: { word: 'Pending', line: 'Our team reviews your documents in person.', icon: 'clock' },
    approved: { word: 'Approved', line: 'Your profile appears as verified to customers.', icon: 'shield' },
    rejected: { word: 'Declined', line: 'Please contact our support team.', icon: 'x-circle' },
  },
};

function formatVerifiedSince(reviewedAt: string | null | undefined, language: Language): string {
  if (!reviewedAt) return language === 'de' ? 'Dein Profil ist verifiziert.' : 'Your profile is verified.';
  const date = new Date(reviewedAt);
  if (Number.isNaN(date.getTime())) return language === 'de' ? 'Dein Profil ist verifiziert.' : 'Your profile is verified.';
  const formatted = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'medium' }).format(date);
  return language === 'de' ? `Verifiziert seit ${formatted}.` : `Verified since ${formatted}.`;
}

/** A pending barber with no documents yet is told what to do, not "Pending". */
export function statusCopyFor(status: VerificationStatus, request: VerificationRequestRow | null, language: Language): StatusCopy {
  const hasAnyDocument = Boolean(request?.id_image_url || request?.license_image_url);
  if (status === 'pending' && !hasAnyDocument) {
    return {
      word: language === 'de' ? 'Unterlagen fehlen' : 'Documents needed',
      line: language === 'de' ? 'Lade beide Dokumente für die manuelle Prüfung hoch.' : 'Upload both documents to enter manual review.',
      icon: 'upload',
    };
  }
  if (status === 'approved') {
    return { word: language === 'de' ? 'Verifiziert' : 'Verified', line: formatVerifiedSince(request?.reviewed_at, language), icon: 'shield' };
  }
  return STATUS_COPY[language][status];
}

export function StatusCard({ status, copy }: { status: VerificationStatus; copy: StatusCopy }) {
  const { colors, fonts } = useTheme();
  const statusColor = status === 'approved' ? colors.successText : status === 'rejected' ? colors.errorText : colors.accentText;
  return (
    <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="barber-verify-status">
      <Feather name={copy.icon} size={28} color={statusColor} />
      <View style={styles.statusText}>
        <Text style={[styles.statusWord, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{copy.word}</Text>
        <Text style={[styles.statusLine, { color: colors.textSecondary, fontFamily: fonts.body }]}>{copy.line}</Text>
      </View>
    </View>
  );
}

export function DocRow({ label, language, uploaded, uploading, disabled, onPress, testID }: {
  label: string;
  language: Language;
  uploaded: boolean;
  uploading: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  const de = language === 'de';
  // Dim only the other (idle) row while a sibling uploads; the active row keeps
  // full opacity so its brass spinner reads clearly.
  const dimmed = disabled && !uploading;
  const stateWord = uploaded ? (de ? 'Hochgeladen' : 'Uploaded') : (de ? 'Noch nicht hochgeladen' : 'Not uploaded');
  const hint = uploading ? (de ? 'Wird hochgeladen' : 'Uploading') : (de ? 'Zum Hochladen antippen' : 'Tap to upload');
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${stateWord}. ${hint}`}
      accessibilityState={{ disabled, busy: uploading }}
      testID={testID}
      style={({ pressed }) => [
        styles.docRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          // The uploading row is disabled, so `pressed` never fires on it.
          opacity: dimmed ? 0.5 : pressed ? pressOpacity.soft : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.docText}>
        <Text style={[styles.docLabel, { color: colors.textPrimary, fontFamily: fonts.body }]}>{label}</Text>
        <View style={styles.docStateRow}>
          {uploaded ? <Feather name="check" size={12} color={colors.successText} /> : null}
          <Text style={[styles.docState, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {uploaded ? (de ? 'Hochgeladen' : 'Uploaded') : (de ? 'Nicht hochgeladen' : 'Not uploaded')}
          </Text>
        </View>
      </View>
      {uploading ? (
        <View style={styles.docAction} testID={`${testID}-uploading`}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.docActionText, { color: colors.accentText, fontFamily: fonts.body }]}>{de ? 'Wird hochgeladen…' : 'Uploading…'}</Text>
        </View>
      ) : (
        // Brass is reserved for the one active upload; idle rows stay quiet.
        <View style={styles.docAction}>
          <Feather name="upload" size={14} color={colors.textSecondary} />
          <Text style={[styles.docActionText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {uploaded ? (de ? 'Ersetzen' : 'Replace') : (de ? 'Hochladen' : 'Upload')}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.base,
    borderWidth: HAIRLINE,
    borderRadius: radius.sm,
    padding: space.lg,
    marginTop: space.xl,
  },
  statusText: { flexShrink: 1, minWidth: 0 },
  statusWord: { fontSize: 18 },
  statusLine: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: HAIRLINE,
    borderRadius: radius.sm,
    padding: space.base,
  },
  docText: { flex: 1, minWidth: 0 },
  docLabel: { fontSize: 14 },
  docStateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  docState: { fontSize: 12 },
  docAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docActionText: { fontSize: 12 },
});
