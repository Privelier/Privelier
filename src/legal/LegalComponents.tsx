import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAppLanguage } from '../shared/locale';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { Role } from '../types';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/spacing';
import type { LegalDocument } from './legalConfig';

type LegalNavigationParams = { Legal: { document: LegalDocument } };

// The documents themselves are German (German law); English UI names them
// in English so links never switch language mid-screen.
const DOCUMENT_LABELS: Record<'de' | 'en', Record<LegalDocument, string>> = {
  de: {
    impressum: 'Impressum',
    privacy: 'Datenschutzerklärung',
    customerTerms: 'Nutzungsbedingungen Kunden',
    barberTerms: 'Nutzungsbedingungen Barber',
  },
  en: {
    impressum: 'Legal notice',
    privacy: 'Privacy policy',
    customerTerms: 'Customer terms',
    barberTerms: 'Barber terms',
  },
};

const labelFor = (document: LegalDocument) => DOCUMENT_LABELS[getAppLanguage() === 'de' ? 'de' : 'en'][document];

function openDocument(navigation: NavigationProp<LegalNavigationParams>, document: LegalDocument) {
  navigation.navigate('Legal', { document });
}

function LegalLink({ document, testID }: { document: LegalDocument; testID: string }) {
  const { colors, fonts } = useTheme();
  const navigation = useNavigation<NavigationProp<LegalNavigationParams>>();
  return (
    <Pressable
      onPress={() => openDocument(navigation, document)}
      accessibilityRole="link"
      accessibilityLabel={getAppLanguage() === 'de' ? `${labelFor(document)} öffnen` : `Open ${labelFor(document)}`}
      testID={testID}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={[styles.link, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
        {labelFor(document)}
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
  const navigation = useNavigation<NavigationProp<LegalNavigationParams>>();
  const termsDocument = role === 'barber' ? 'barberTerms' : role === 'customer' ? 'customerTerms' : null;
  const de = getAppLanguage() === 'de';
  const termsLabel = labelFor(role === 'barber' ? 'barberTerms' : 'customerTerms');
  const privacyLabel = labelFor('privacy');
  const linkStyle = { color: colors.accentText, fontFamily: fonts.bodyMedium };
  const termsLink = termsDocument ? (
    <Text
      onPress={() => openDocument(navigation, termsDocument)}
      accessibilityRole="link"
      testID={`${testIDPrefix}-legal-terms-link`}
      style={linkStyle}
    >
      {termsLabel}
    </Text>
  ) : <Text>{termsLabel}</Text>;
  const privacyLink = (
    <Text
      onPress={() => openDocument(navigation, 'privacy')}
      accessibilityRole="link"
      testID={`${testIDPrefix}-legal-privacy-link`}
      style={linkStyle}
    >
      {privacyLabel}
    </Text>
  );

  return (
    <View style={styles.consent} testID={`${testIDPrefix}-legal-consent`}>
      <View style={styles.consentRow}>
        <Pressable
          onPress={role ? onTermsChange : undefined}
          accessibilityRole="checkbox"
          accessibilityLabel={de
            ? `${termsLabel} akzeptieren und Datenschutzerklärung zur Kenntnis nehmen`
            : `Accept the ${termsLabel.toLowerCase()} and acknowledge the privacy policy`}
          accessibilityState={{ checked: termsAccepted, disabled: !role }}
          testID={`${testIDPrefix}-legal-terms`}
          // 22pt visual box, 44pt touch target.
          hitSlop={11}
          style={[styles.checkbox, { borderColor: termsError ? colors.error : termsAccepted ? colors.accent : colors.inputBorder }]}
        >
          {termsAccepted ? <Text style={[styles.checkmark, { color: colors.accentText }]}>✓</Text> : null}
        </Pressable>
        {de ? (
          <Text style={[styles.consentText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            Ich akzeptiere die {termsLink} und bestätige, die {privacyLink} zur Kenntnis genommen zu haben.
            {' '}Beleidigende, bedrohende oder anstößige Inhalte und Verhalten dulden wir nicht; Konten, die dagegen verstoßen, werden entfernt.
          </Text>
        ) : (
          <Text style={[styles.consentText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            I accept the {termsLink} and confirm I have read the {privacyLink} (both in German).
            {' '}Privelier has zero tolerance for abusive, threatening or objectionable content and behaviour; accounts that break this rule are removed.
          </Text>
        )}
      </View>
      {termsError ? <Text style={[styles.error, { color: colors.errorText, fontFamily: fonts.body }]}>{termsError}</Text> : null}

      <View style={styles.consentRow}>
        <Pressable
          onPress={onAdultChange}
          accessibilityRole="checkbox"
          accessibilityLabel={getAppLanguage() === 'de' ? 'Bestätige, dass du mindestens 18 Jahre alt bist' : 'Confirm that you are at least 18 years old'}
          accessibilityState={{ checked: adultConfirmed }}
          testID={`${testIDPrefix}-legal-adult`}
          // 22pt visual box, 44pt touch target.
          hitSlop={11}
          style={[styles.checkbox, { borderColor: adultError ? colors.error : adultConfirmed ? colors.accent : colors.inputBorder }]}
        >
          {adultConfirmed ? <Text style={[styles.checkmark, { color: colors.accentText }]}>✓</Text> : null}
        </Pressable>
        <Text style={[styles.consentText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {de ? 'Ich bestätige, mindestens 18 Jahre alt zu sein.' : 'I confirm that I am at least 18 years old.'}
        </Text>
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
