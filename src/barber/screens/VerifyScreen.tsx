/**
 * Barber Verify tab — rebuild of the prototype's barber.verification
 * route: serif header + "A quiet, manual review by our team." subtitle, a
 * status card (icon + status word + one-line explainer), two document rows
 * (government ID, barber licence), and the no-biometrics footnote.
 *
 * Real data: the status card reads barber_profile.verification_status and
 * the document rows read the barber's own verification_requests row (both
 * RLS-verified own-row reads). Everything here is DISPLAY-ONLY:
 * verification_status is admin-owned (trigger-protected, migration 0005) —
 * the prototype's client-side status write is deliberately NOT ported, and
 * no code in this app may ever write that column.
 *
 * Document upload itself is build-order step 17 (private storage bucket +
 * image picker, a native module needing a new dev-client build) — the
 * upload affordances explain that until then.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fetchOwnProfile } from '../../auth/authService';
import { useTheme } from '../../theme/useTheme';
import type { VerificationRequestRow, VerificationStatus } from '../../types';
import { fetchOwnBarberProfile, fetchOwnVerificationRequest } from '../profileData';

const STATUS_COPY: Record<VerificationStatus, { word: string; line: string; icon: keyof typeof Feather.glyphMap }> = {
  pending: {
    word: 'Pending',
    line: 'Our team reviews manually — no automated checks.',
    icon: 'clock',
  },
  approved: {
    word: 'Approved',
    line: 'You appear as verified across Privelier.',
    icon: 'shield',
  },
  rejected: {
    word: 'Declined',
    line: 'We could not verify your documents — please contact us.',
    icon: 'x-circle',
  },
};

export default function VerifyScreen() {
  const { colors, fonts } = useTheme();

  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [request, setRequest] = useState<VerificationRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error' || !profileResult.profile) {
      setLoading(false);
      setError(
        profileResult.status === 'error'
          ? profileResult.message
          : 'Could not load your profile.'
      );
      return;
    }
    const userId = profileResult.profile.id;

    const [barberProfileResult, requestResult] = await Promise.all([
      fetchOwnBarberProfile(userId),
      fetchOwnVerificationRequest(userId),
    ]);
    setLoading(false);
    if (barberProfileResult.status !== 'ok') {
      setError(barberProfileResult.message);
      return;
    }
    setStatus(barberProfileResult.profile?.verification_status ?? null);
    setRequest(requestResult.status === 'ok' ? requestResult.request : null);
  }, []);

  useEffect(() => {
    let active = true;
    // Deferred via .then() (not called directly) for the same
    // react-hooks/set-state-in-effect reason as the other data screens.
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const onUpload = useCallback(() => {
    Alert.alert('Uploads open soon', 'Document upload is coming in an upcoming update.');
  }, []);

  const statusColor =
    status === 'approved'
      ? colors.successText
      : status === 'rejected'
        ? colors.errorText
        : colors.accentText;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="barber-verify-screen"
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Verification
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          A quiet, manual review by our team.
        </Text>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="barber-verify-loading"
          />
        ) : error ? (
          <View
            testID="barber-verify-error"
            accessibilityRole="alert"
            style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
              {error}
            </Text>
          </View>
        ) : status ? (
          <>
            <View
              style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              testID="barber-verify-status"
            >
              <Feather name={STATUS_COPY[status].icon} size={28} color={statusColor} />
              <View style={styles.statusText}>
                <Text style={[styles.statusWord, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                  {STATUS_COPY[status].word}
                </Text>
                <Text style={[styles.statusLine, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {STATUS_COPY[status].line}
                </Text>
              </View>
            </View>

            <View style={styles.docs}>
              <DocRow
                label="Government-issued ID"
                uploaded={Boolean(request?.id_image_url)}
                onPress={onUpload}
                testID="barber-verify-doc-id"
              />
              <DocRow
                label="Barber licence"
                uploaded={Boolean(request?.license_image_url)}
                onPress={onUpload}
                testID="barber-verify-doc-license"
              />
            </View>

            <Text style={[styles.footnote, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              Documents are stored privately. No automated scanning, no biometrics — a human on
              our team reviews them.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DocRow({
  label,
  uploaded,
  onPress,
  testID,
}: {
  label: string;
  uploaded: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={[styles.docRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.docText}>
        <Text style={[styles.docLabel, { color: colors.textPrimary, fontFamily: fonts.body }]}>
          {label}
        </Text>
        <Text style={[styles.docState, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {uploaded ? 'Uploaded' : 'Not uploaded'}
        </Text>
      </View>
      <View style={styles.docAction}>
        <Feather name="upload" size={14} color={colors.accentText} />
        <Text style={[styles.docActionText, { color: colors.accentText, fontFamily: fonts.body }]}>
          {uploaded ? 'Replace' : 'Upload'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  heading: { fontSize: 24 },
  subtitle: { fontSize: 12, marginTop: 4 },

  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 24 },
  noticeText: { fontSize: 14 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 20,
    marginTop: 24,
  },
  statusText: { flexShrink: 1, minWidth: 0 },
  statusWord: { fontSize: 18 },
  statusLine: { fontSize: 12, marginTop: 4 },

  docs: { marginTop: 32, gap: 12 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 16,
  },
  docText: { flex: 1, minWidth: 0 },
  docLabel: { fontSize: 14 },
  docState: { fontSize: 12, marginTop: 4 },
  docAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docActionText: { fontSize: 12 },

  footnote: { fontSize: 10, lineHeight: 16, marginTop: 32 },
});
