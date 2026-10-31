/**
 * Shown after sign-in when the server has no record that this account
 * accepted the CURRENT terms and privacy notice (migration 0033): accounts
 * created before consent was recorded, and everyone after a version bump.
 * Acceptance goes only through accept_current_legal_consent(), which stamps
 * the versions and time server-side.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LegalConsentFields, LegalLinks } from '../../legal/LegalComponents';
import { getAppLanguage } from '../../shared/locale';
import { useTheme } from '../../theme/useTheme';
import type { Role } from '../../types';
import { AuthScreenShell, Notice, PrimaryButton, ScreenHeading, TextLink } from './ui';
import { typeScale } from '../../theme/typography';

export type LegalConsentView =
  | { kind: 'checking' }
  | { kind: 'required' }
  | { kind: 'failure'; message: string };

interface Props {
  view: LegalConsentView;
  role: Role | 'admin';
  onAccept: (confirmedAdult: boolean) => Promise<string | null>;
  onRetry: () => void;
  onSignOut: () => void;
}

export default function LegalConsentGateScreen({ view, role, onAccept, onRetry, onSignOut }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setAttempted(true);
    if (!termsAccepted || !adultConfirmed) return;
    setSubmitting(true);
    setError(null);
    const failure = await onAccept(adultConfirmed);
    setSubmitting(false);
    if (failure) setError(failure);
  }, [termsAccepted, adultConfirmed, onAccept]);

  if (view.kind === 'checking') {
    return (
      <AuthScreenShell testID="legal-consent-checking">
        <View style={styles.center} accessible accessibilityRole="progressbar" accessibilityLabel={de ? 'Wird geprüft' : 'Checking'}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </AuthScreenShell>
    );
  }

  if (view.kind === 'failure') {
    return (
      <AuthScreenShell testID="legal-consent-failure">
        <Notice kind="error" message={view.message} testID="legal-consent-failure-notice" />
        <PrimaryButton label={de ? 'Erneut versuchen' : 'Try again'} onPress={onRetry} testID="legal-consent-retry" />
        <TextLink label={de ? 'Abmelden' : 'Log out'} onPress={onSignOut} testID="legal-consent-sign-out" />
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell testID="legal-consent-screen">
      <ScreenHeading
        title={de ? 'Bevor es weitergeht' : 'Before you continue'}
        subtitle={de
          ? 'Bitte lies die aktuellen Nutzungsbedingungen und die Datenschutzerklärung und stimme ihnen zu.'
          : 'Please review and accept the current terms and privacy notice.'}
      />
      {error ? <Notice kind="error" message={error} testID="legal-consent-error" /> : null}
      <LegalConsentFields
        role={role === 'admin' ? null : role}
        termsAccepted={termsAccepted}
        adultConfirmed={adultConfirmed}
        onTermsChange={() => setTermsAccepted((current) => !current)}
        onAdultChange={() => setAdultConfirmed((current) => !current)}
        termsError={attempted && !termsAccepted ? (de ? 'Bitte stimme den Bedingungen zu.' : 'Accept the terms to continue.') : undefined}
        adultError={attempted && !adultConfirmed ? (de ? 'Bitte bestätige, dass du mindestens 18 bist.' : 'You must confirm that you are at least 18.') : undefined}
        testIDPrefix="legal-consent"
      />
      <PrimaryButton label={de ? 'Zustimmen und fortfahren' : 'Accept and continue'} onPress={() => void submit()} loading={submitting} testID="legal-consent-accept" />
      <TextLink label={de ? 'Abmelden' : 'Log out'} onPress={onSignOut} testID="legal-consent-sign-out" />
      <Text style={[styles.footnote, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {de ? 'Deine Zustimmung wird mit Version und Zeitpunkt gespeichert.' : 'Your acceptance is stored with its version and time.'}
      </Text>
      <LegalLinks role={role === 'admin' ? undefined : role} testIDPrefix="legal-consent-links" />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  footnote: { ...typeScale.secondary, marginTop: 12, textAlign: 'center' },
});
