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
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { fetchOwnProfile } from '../../auth/authService';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { Notice } from '../../shared/components/Notice';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { getAppLanguage } from '../../shared/locale';
import type { VerificationDocType, VerificationRequestRow, VerificationStatus } from '../../types';
import { fetchOwnBarberProfile, fetchOwnVerificationRequest } from '../profileData';
import { submitVerificationDocument, uploadVerificationDocument } from '../verificationData';

const STATUS_COPY: Record<'de' | 'en', Record<VerificationStatus, { word: string; line: string; icon: keyof typeof Feather.glyphMap }>> = {
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

export default function VerifyScreen() {
  const { colors, fonts } = useTheme();
  const language = getAppLanguage();

  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [request, setRequest] = useState<VerificationRequestRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<VerificationDocType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemFeedback, setRedeemFeedback] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'apple' | 'google' | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);

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
    if (requestResult.status !== 'ok') {
      setError(requestResult.message);
      return;
    }
    setStatus(barberProfileResult.profile?.verification_status ?? null);
    setRequest(requestResult.request);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleUpload = useCallback(
    async (docType: VerificationDocType) => {
      if (!userId) {
        Alert.alert(
          language === 'de' ? 'Einen Moment' : 'One moment',
          language === 'de' ? 'Dein Profil wird noch geladen. Versuch es gleich noch einmal.' : 'Your profile is still loading. Try again shortly.'
        );
        return;
      }
      // Belt-and-suspenders: the rows are already disabled while a doc uploads.
      if (uploadingDoc) return;

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          language === 'de' ? 'Zugriff auf Fotos nötig' : 'Photo access needed',
          language === 'de' ? 'Erlaube den Fotozugriff in den Einstellungen, um deine Unterlagen hochzuladen.' : 'Allow photo access in Settings to upload your documents.',
          [
          { text: language === 'de' ? 'Später' : 'Not now', style: 'cancel' },
          { text: language === 'de' ? 'Einstellungen öffnen' : 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
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
          Alert.alert(language === 'de' ? 'Upload fehlgeschlagen' : 'Upload failed', uploaded.message);
          return;
        }
        const submitted = await submitVerificationDocument(userId, docType, uploaded.path);
        if (submitted.status !== 'ok') {
          Alert.alert(language === 'de' ? 'Upload fehlgeschlagen' : 'Upload failed', submitted.message);
          return;
        }
        await load();
      } finally {
        setUploadingDoc(null);
      }
    },
    [userId, uploadingDoc, load, language]
  );

  const statusColor =
    status === 'approved'
      ? colors.successText
      : status === 'rejected'
        ? colors.errorText
        : colors.accentText;
  const hasAnyDocument = Boolean(request?.id_image_url || request?.license_image_url);
  const statusCopy = status === 'pending' && !hasAnyDocument
    ? { word: language === 'de' ? 'Unterlagen fehlen' : 'Documents needed', line: language === 'de' ? 'Lade beide Dokumente für die manuelle Prüfung hoch.' : 'Upload both documents to enter manual review.', icon: 'upload' as const }
    : status === 'approved'
      ? { word: language === 'de' ? 'Verifiziert' : 'Verified', line: formatVerifiedSince(request?.reviewed_at, language), icon: 'shield' as const }
      : status ? STATUS_COPY[language][status] : null;

  const applyRedeemCode = () => {
    setRedeemFeedback(
      redeemCode.trim()
        ? language === 'de'
          ? 'Die Codeprüfung ist noch nicht verfügbar. Es wurde kein Rabatt angewendet.'
          : 'Code checks are not active yet. No discount has been applied.'
        : language === 'de' ? 'Gib zuerst einen Code ein.' : 'Enter a code to check it.'
    );
  };

  const continueToPayment = () => {
    setPaymentFeedback(language === 'de' ? 'Zahlungen sind noch nicht aktiv. Es wurde nichts abgebucht.' : 'Payments are not active yet. No charge has been made.');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="barber-verify-screen"
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {language === 'de' ? 'Verifizierung' : 'Verification'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {language === 'de' ? 'Unser Team prüft deine Unterlagen persönlich.' : 'A quiet, manual review by our team.'}
        </Text>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="barber-verify-loading"
          />
        ) : error ? (
          <Notice testID="barber-verify-error" message={error} style={styles.noticeMargins}>
            <Pressable onPress={() => void load()} accessibilityRole="button" testID="barber-verify-retry" style={styles.noticeAction}>
              <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>{language === 'de' ? 'Erneut versuchen' : 'Try again'}</Text>
            </Pressable>
          </Notice>
        ) : status && statusCopy ? (
          <>
            <View
              style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              testID="barber-verify-status"
            >
              <Feather name={statusCopy.icon} size={28} color={statusColor} />
              <View style={styles.statusText}>
                <Text style={[styles.statusWord, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                  {statusCopy.word}
                </Text>
                <Text style={[styles.statusLine, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {statusCopy.line}
                </Text>
              </View>
            </View>

            {status !== 'approved' ? (
              <>
                <View style={styles.docs}>
                  <DocRow
                    label={language === 'de' ? 'Amtlicher Lichtbildausweis' : 'Government-issued ID'}
                    language={language}
                    uploaded={Boolean(request?.id_image_url)}
                    uploading={uploadingDoc === 'id'}
                    disabled={uploadingDoc !== null}
                    onPress={() => void handleUpload('id')}
                    testID="barber-verify-doc-id"
                  />
                  <DocRow
                    label={language === 'de' ? 'Barber-Lizenz' : 'Barber licence'}
                    language={language}
                    uploaded={Boolean(request?.license_image_url)}
                    uploading={uploadingDoc === 'license'}
                    disabled={uploadingDoc !== null}
                    onPress={() => void handleUpload('license')}
                    testID="barber-verify-doc-license"
                  />
                </View>

                <Text style={[styles.footnote, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {language === 'de'
                    ? 'Deine Unterlagen werden privat gespeichert und von unserem Team persönlich geprüft. Es gibt keine automatische Erkennung und keine biometrische Verarbeitung.'
                    : 'Documents are stored privately and reviewed by our team. There is no automated scanning or biometric processing.'}
                </Text>
              </>
            ) : null}
            {status === 'rejected' ? (
              <Pressable onPress={() => void Linking.openURL('mailto:privelier@outlook.com?subject=Verification%20help')} accessibilityRole="link" testID="barber-verify-contact" style={styles.contactAction}>
                <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>{language === 'de' ? 'Verifizierungssupport kontaktieren' : 'Contact verification support'}</Text>
              </Pressable>
            ) : null}

            <View style={styles.membership} testID="barber-membership">
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{language === 'de' ? 'Privelier Mitgliedschaft' : 'Privelier membership'}</Text>
              <GlassSurface style={styles.membershipCard} testID="barber-membership-card">
                <Text style={[styles.membershipEyebrow, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{language === 'de' ? 'Monatliche Mitgliedschaft' : 'Monthly membership'}</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
                    {formatEuroPrice(35, language)}
                  </Text>
                  <Text style={[styles.perMonth, { color: colors.textSecondary, fontFamily: fonts.body }]}>{language === 'de' ? 'pro Monat' : 'per month'}</Text>
                </View>
                <Text style={[styles.paymentFootnote, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="barber-membership-availability">{language === 'de' ? 'Vorschau · Zahlungen und Codeprüfung sind noch nicht verfügbar. Deine Auswahl löst keine Zahlung aus.' : 'Preview · Payments and code checks are not available yet. Your selection will not start a payment.'}</Text>
                <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.sectionLabel, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{language === 'de' ? 'Code einlösen' : 'Redeem a code'}</Text>
                <View style={styles.redeemRow}>
                  <TextInput
                    value={redeemCode}
                    onChangeText={(value) => { setRedeemCode(value); setRedeemFeedback(null); }}
                    placeholder={language === 'de' ? 'Code eingeben' : 'Enter your code'}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel={language === 'de' ? 'Mitgliedschaftscode' : 'Membership redeem code'}
                    testID="barber-membership-code"
                    style={[styles.codeInput, { color: colors.textPrimary, borderColor: colors.border, fontFamily: fonts.body }]}
                  />
                  <Pressable
                    onPress={applyRedeemCode}
                    accessibilityRole="button"
                    accessibilityLabel={language === 'de' ? 'Code prüfen' : 'Check redeem code'}
                    testID="barber-membership-code-apply"
                    style={({ pressed }) => [styles.codeButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
                  >
                    <Text style={[styles.codeButtonText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{language === 'de' ? 'Prüfen' : 'Check'}</Text>
                  </Pressable>
                </View>
                {redeemFeedback ? <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="barber-membership-code-feedback">{redeemFeedback}</Text> : null}

                <Text style={[styles.sectionLabel, styles.paymentLabel, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{language === 'de' ? 'Zahlungsmethode' : 'Payment method'}</Text>
                <View style={styles.paymentMethods}>
                  <PaymentMethodOption label="Apple Pay" selected={paymentMethod === 'apple'} onPress={() => { setPaymentMethod('apple'); setPaymentFeedback(null); }} testID="barber-membership-apple-pay" />
                  <PaymentMethodOption label="Google Pay" selected={paymentMethod === 'google'} onPress={() => { setPaymentMethod('google'); setPaymentFeedback(null); }} testID="barber-membership-google-pay" />
                </View>
                <Pressable
                  onPress={continueToPayment}
                  disabled={!paymentMethod}
                  accessibilityRole="button"
                  accessibilityLabel={language === 'de' ? 'Zahlungsstatus ansehen' : 'View payment availability'}
                  accessibilityState={{ disabled: !paymentMethod }}
                  testID="barber-membership-continue"
                  style={({ pressed }) => [styles.continueButton, { backgroundColor: paymentMethod ? colors.accent : colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
                >
                  <Text style={[styles.continueText, { color: paymentMethod ? colors.onAccent : colors.textSecondary, fontFamily: fonts.bodySemiBold }]}>{language === 'de' ? 'Zahlungsstatus ansehen' : 'View payment availability'}</Text>
                </Pressable>
                {paymentFeedback ? <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="barber-membership-payment-feedback">{paymentFeedback}</Text> : null}
                <Text style={[styles.paymentFootnote, { color: colors.textSecondary, fontFamily: fonts.body }]}>{language === 'de' ? 'Apple Pay und Google Pay werden später eingerichtet. Die Auswahl startet keine Zahlung.' : 'Apple Pay and Google Pay setup is coming later. Choosing a method here never starts a payment.'}</Text>
              </GlassSurface>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentMethodOption({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={({ pressed }) => [styles.paymentOption, { borderColor: selected ? colors.accentText : colors.border, backgroundColor: selected ? colors.surface : 'transparent', opacity: pressed ? pressOpacity.soft : 1 }]}
    >
      <FontAwesome5 name={label === 'Apple Pay' ? 'apple-pay' : 'google-pay'} size={30} color={colors.textPrimary} accessible={false} />
      <Text style={[styles.paymentOptionText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
      {selected ? <Feather name="check-circle" size={16} color={colors.accentText} /> : null}
    </Pressable>
  );
}

function formatVerifiedSince(reviewedAt: string | null | undefined, language: 'de' | 'en'): string {
  if (!reviewedAt) return language === 'de' ? 'Dein Profil ist verifiziert.' : 'Your profile is verified.';
  const date = new Date(reviewedAt);
  if (Number.isNaN(date.getTime())) return language === 'de' ? 'Dein Profil ist verifiziert.' : 'Your profile is verified.';
  const formatted = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'medium' }).format(date);
  return language === 'de' ? `Verifiziert seit ${formatted}.` : `Verified since ${formatted}.`;
}

function formatEuroPrice(amount: number, language: 'de' | 'en'): string {
  return new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

function DocRow({
  label,
  language,
  uploaded,
  uploading,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  language: 'de' | 'en';
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
      accessibilityLabel={`${label}. ${uploaded ? language === 'de' ? 'Hochgeladen' : 'Uploaded' : language === 'de' ? 'Noch nicht hochgeladen' : 'Not uploaded'}. ${uploading ? language === 'de' ? 'Wird hochgeladen' : 'Uploading' : language === 'de' ? 'Zum Hochladen antippen' : 'Tap to upload'}`}
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
            {uploaded ? language === 'de' ? 'Hochgeladen' : 'Uploaded' : language === 'de' ? 'Nicht hochgeladen' : 'Not uploaded'}
          </Text>
        </View>
      </View>
      {uploading ? (
        <View style={styles.docAction} testID={`${testID}-uploading`}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.docActionText, { color: colors.accentText, fontFamily: fonts.body }]}>
            {language === 'de' ? 'Wird hochgeladen…' : 'Uploading…'}
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
            {uploaded ? language === 'de' ? 'Ersetzen' : 'Replace' : language === 'de' ? 'Hochladen' : 'Upload'}
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
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 8 },

  spinner: { marginTop: 48, alignSelf: 'center' },
  noticeMargins: { marginTop: space.xl },
  noticeAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  contactAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: space.sm },
  membership: { marginTop: space['2xl'] },
  sectionTitle: { fontSize: 22, lineHeight: 30 },
  membershipCard: { padding: space.lg, marginTop: space.md },
  membershipEyebrow: { fontSize: 13, lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm },
  price: { fontSize: 34, lineHeight: 44, fontVariant: ['tabular-nums'] },
  perMonth: { fontSize: 13 },
  sectionDivider: { height: HAIRLINE, marginVertical: space.lg },
  sectionLabel: { fontSize: 14, lineHeight: 20 },
  redeemRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  codeInput: { flex: 1, minWidth: 0, minHeight: 48, borderWidth: HAIRLINE, borderRadius: radius.sm, paddingHorizontal: space.md, fontSize: 14 },
  codeButton: { minWidth: 76, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: HAIRLINE, borderRadius: radius.sm, paddingHorizontal: space.md },
  codeButtonText: { fontSize: 13 },
  feedback: { fontSize: 12, lineHeight: 18, marginTop: space.sm },
  paymentLabel: { marginTop: space.lg },
  paymentMethods: { gap: space.sm, marginTop: space.sm },
  paymentOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: HAIRLINE, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  paymentOptionText: { flex: 1, fontSize: 14 },
  continueButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, marginTop: space.md },
  continueText: { fontSize: 14 },
  paymentFootnote: { fontSize: 13, lineHeight: 20, marginTop: space.md },

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
