import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { Role } from '../types';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/spacing';
import { LEGAL_URLS, type LegalDocument } from './legalConfig';

const DOCUMENT_LABELS: Record<LegalDocument, string> = {
  impressum: 'Impressum',
  privacy: 'Datenschutzerklärung',
  customerTerms: 'Customer terms',
  barberTerms: 'Barber terms',
};

export async function openLegalDocument(document: LegalDocument): Promise<void> {
  await WebBrowser.openBrowserAsync(LEGAL_URLS[document]);
}

function LegalLink({ document, testID }: { document: LegalDocument; testID: string }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={() => void openLegalDocument(document)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${DOCUMENT_LABELS[document]}`}
      testID={testID}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={[styles.link, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
        {DOCUMENT_LABELS[document]}
      </Text>
    </Pressable>
  );
}

export function LegalLinks({
  role,
  includeAll = false,
  testIDPrefix = 'legal',
}: {
  role?: Role | null;
  includeAll?: boolean;
  testIDPrefix?: string;
}) {
  const documents: LegalDocument[] = includeAll
    ? ['impressum', 'privacy', 'customerTerms', 'barberTerms']
    : ['impressum', 'privacy', role === 'barber' ? 'barberTerms' : 'customerTerms'];

  return (
    <View style={styles.links} testID={`${testIDPrefix}-links`}>
      {documents.map((document) => (
        <LegalLink key={document} document={document} testID={`${testIDPrefix}-${document}`} />
      ))}
    </View>
  );
}

export function LegalConsentFields({
  role,
  termsAccepted,
  adultConfirmed,
  onTermsChange,
  onAdultChange,
  termsError,
  adultError,
  testIDPrefix,
}: {
  role: Role | null;
  termsAccepted: boolean;
  adultConfirmed: boolean;
  onTermsChange: () => void;
  onAdultChange: () => void;
  termsError?: string;
  adultError?: string;
  testIDPrefix: string;
}) {
  const { colors, fonts } = useTheme();
  const termsDocument = role === 'barber' ? 'barberTerms' : role === 'customer' ? 'customerTerms' : null;
  const termsLabel = role === 'barber' ? 'barber terms' : 'customer terms';

  return (
    <View style={styles.consent} testID={`${testIDPrefix}-legal-consent`}>
      <View style={styles.consentRow}>
        <Pressable
          onPress={role ? onTermsChange : undefined}
          accessibilityRole="checkbox"
          accessibilityLabel={`Accept ${termsLabel} and acknowledge privacy policy`}
          accessibilityState={{ checked: termsAccepted, disabled: !role }}
          testID={`${testIDPrefix}-legal-terms`}
          style={[styles.checkbox, { borderColor: termsError ? colors.error : colors.border }]}
        >
          {termsAccepted ? <Text style={[styles.checkmark, { color: colors.accentText }]}>✓</Text> : null}
        </Pressable>
        <Text style={[styles.consentText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          I accept the{' '}
          {termsDocument ? (
            <Text
              onPress={() => void openLegalDocument(termsDocument)}
              accessibilityRole="link"
              testID={`${testIDPrefix}-legal-terms-link`}
              style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}
            >
              {termsLabel}
            </Text>
          ) : (
            <Text>{termsLabel}</Text>
          )}{' '}
          and acknowledge the{' '}
          <Text
            onPress={() => void openLegalDocument('privacy')}
            accessibilityRole="link"
            testID={`${testIDPrefix}-legal-privacy-link`}
            style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}
          >
            privacy policy
          </Text>
          .
        </Text>
      </View>
      {termsError ? <Text style={[styles.error, { color: colors.errorText, fontFamily: fonts.body }]}>{termsError}</Text> : null}

      <View style={styles.consentRow}>
        <Pressable
          onPress={onAdultChange}
          accessibilityRole="checkbox"
          accessibilityLabel="Confirm that you are at least 18 years old"
          accessibilityState={{ checked: adultConfirmed }}
          testID={`${testIDPrefix}-legal-adult`}
          style={[styles.checkbox, { borderColor: adultError ? colors.error : colors.border }]}
        >
          {adultConfirmed ? <Text style={[styles.checkmark, { color: colors.accentText }]}>✓</Text> : null}
        </Pressable>
        <Text style={[styles.consentText, { color: colors.textSecondary, fontFamily: fonts.body }]}>I confirm that I am at least 18 years old.</Text>
      </View>
      {adultError ? <Text style={[styles.error, { color: colors.errorText, fontFamily: fonts.body }]}>{adultError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center', marginTop: space.lg },
  link: { fontSize: 12, textDecorationLine: 'underline' },
  consent: { marginTop: space.md, marginBottom: space.md, gap: space.xs },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkmark: { fontSize: 17, lineHeight: 19 },
  consentText: { flex: 1, fontSize: 13, lineHeight: 19 },
  error: { marginLeft: 30, fontSize: 12, lineHeight: 17 },
});
