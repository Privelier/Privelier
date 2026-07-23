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
 * Document upload IS wired here (build-order step 17): each row picks an image
 * (expo-image-picker), then runs the strict two-step data-layer flow —
 * uploadVerificationDocument (bytes → private bucket) then
 * submitVerificationDocument (path → own verification_requests row) — and
 * refetches only on success. This screen still NEVER writes verification_status
 * / verified / barber_profile. The fetch(uri).arrayBuffer() read inside the data
 * layer only truly runs on-device after a dev-client rebuild with the picker.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { fetchOwnProfile } from '../../auth/authService';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { Notice } from '../../shared/components/Notice';
import type { VerificationDocType, VerificationRequestRow, VerificationStatus } from '../../types';
import { fetchOwnBarberProfile, fetchOwnVerificationRequest } from '../profileData';
import { submitVerificationDocument, uploadVerificationDocument } from '../verificationData';

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
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<VerificationDocType | null>(null);
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
    const id = profileResult.profile.id;
    setUserId(id);

    const [barberProfileResult, requestResult] = await Promise.all([
      fetchOwnBarberProfile(id),
      fetchOwnVerificationRequest(id),
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

  const handleUpload = useCallback(
    async (docType: VerificationDocType) => {
      if (!userId) {
        Alert.alert('One moment', 'Your profile is still loading — try again shortly.');
        return;
      }
      // Belt-and-suspenders: the rows are already disabled while a doc uploads.
      if (uploadingDoc) return;

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'Allow photo access to upload your documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];

      setUploadingDoc(docType);
      try {
        // Strict order: bytes to the private bucket first, then the row upsert,
        // then refetch. A failure at either step surfaces its honest message and
        // never refetches (no fabricated "uploaded" state).
        const uploaded = await uploadVerificationDocument(userId, docType, asset.uri, asset.mimeType);
        if (uploaded.status !== 'ok') {
          Alert.alert('Upload failed', uploaded.message);
          return;
        }
        const submitted = await submitVerificationDocument(userId, docType, uploaded.path);
        if (submitted.status !== 'ok') {
          Alert.alert('Upload failed', submitted.message);
          return;
        }
        await load();
      } finally {
        setUploadingDoc(null);
      }
    },
    [userId, uploadingDoc, load]
  );

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
          <Notice testID="barber-verify-error" message={error} style={styles.noticeMargins} />
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
                uploading={uploadingDoc === 'id'}
                disabled={uploadingDoc !== null}
                onPress={() => void handleUpload('id')}
                testID="barber-verify-doc-id"
              />
              <DocRow
                label="Barber licence"
                uploaded={Boolean(request?.license_image_url)}
                uploading={uploadingDoc === 'license'}
                disabled={uploadingDoc !== null}
                onPress={() => void handleUpload('license')}
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
  uploading,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  uploaded: boolean;
  uploading: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  // Dim only the other (idle) row while a sibling uploads; the active row keeps
  // full opacity so its brass spinner reads clearly.
  const dimmed = disabled && !uploading;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: uploading }}
      testID={testID}
      style={({ pressed }) => [
        styles.docRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          // Active uploading row is `disabled`, so `pressed` can never fire on
          // it — no scale mid-upload. Idle sibling dims to 0.5 while disabled.
          opacity: dimmed ? 0.5 : pressed ? pressOpacity.soft : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.docText}>
        <Text style={[styles.docLabel, { color: colors.textPrimary, fontFamily: fonts.body }]}>
          {label}
        </Text>
        <View style={styles.docStateRow}>
          {uploaded ? <Feather name="check" size={12} color={colors.successText} /> : null}
          <Text style={[styles.docState, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {uploaded ? 'Uploaded' : 'Not uploaded'}
          </Text>
        </View>
      </View>
      {uploading ? (
        <View style={styles.docAction} testID={`${testID}-uploading`}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.docActionText, { color: colors.accentText, fontFamily: fonts.body }]}>
            Uploading…
          </Text>
        </View>
      ) : (
        // Idle state — brass is reserved for the one genuinely active upload
        // (above); with two rows visible at once, an idle "Upload"/"Replace"
        // affordance in brass would double it for no reason (Step-18 Ultra
        // pass, increment 6).
        <View style={styles.docAction}>
          <Feather name="upload" size={14} color={colors.textSecondary} />
          <Text style={[styles.docActionText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {uploaded ? 'Replace' : 'Upload'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space['2xl'] },
  heading: { fontSize: 30 },
  subtitle: { fontSize: 12, marginTop: 4 },

  spinner: { marginTop: 48, alignSelf: 'center' },
  noticeMargins: { marginTop: space.xl },

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
  statusLine: { fontSize: 12, marginTop: 4 },

  docs: { marginTop: 32, gap: space.md },
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

  footnote: { fontSize: 12, lineHeight: 18, marginTop: 32 },
});
