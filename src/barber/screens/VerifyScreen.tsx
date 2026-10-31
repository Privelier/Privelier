/**
 * Barber Verify tab: serif header, a status card, the two document rows
 * (government ID, barber licence), the no-biometrics footnote and the
 * membership preview. Data and upload live in useVerification; this screen
 * never writes verification_status, verified or barber_profile.
 */
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Notice } from '../../shared/components/Notice';
import { StatusCardSkeleton } from '../../shared/components/ScreenSkeletons';
import { getAppLanguage } from '../../shared/locale';
import { useTabBarClearance } from '../../shared/navigation/tabBarClearance';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { MembershipCard } from '../components/verify/MembershipCard';
import { DocRow, StatusCard, statusCopyFor } from '../components/verify/VerificationParts';
import { useVerification } from '../hooks/useVerification';
import { typeScale } from '../../theme/typography';

export default function VerifyScreen() {
  // Scroll the last row clear of the floating glass tab bar.
  const tabClearance = useTabBarClearance(32);
  const language = getAppLanguage();
  const de = language === 'de';
  const { colors, fonts } = useTheme();
  const { status, request, uploadingDoc, loading, error, load, upload } = useVerification(de);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="barber-verify-screen">
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabClearance }]}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Verifizierung' : 'Verification'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {de ? 'Unser Team prüft deine Unterlagen persönlich.' : 'A quiet, manual review by our team.'}
        </Text>

        {loading ? (
          <StatusCardSkeleton testID="barber-verify-loading" label={de ? 'Verifizierung wird geladen' : 'Loading your verification'} style={styles.noticeMargins} />
        ) : error ? (
          <Notice testID="barber-verify-error" message={error} style={styles.noticeMargins}>
            <Pressable onPress={() => void load()} accessibilityRole="button" testID="barber-verify-retry" style={styles.noticeAction}>
              <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>{de ? 'Erneut versuchen' : 'Try again'}</Text>
            </Pressable>
          </Notice>
        ) : status ? (
          <>
            <StatusCard status={status} copy={statusCopyFor(status, request, language)} />

            {status !== 'approved' ? (
              <>
                <View style={styles.docs}>
                  <DocRow
                    label={de ? 'Amtlicher Lichtbildausweis' : 'Government-issued ID'}
                    language={language}
                    uploaded={Boolean(request?.id_image_url)}
                    uploading={uploadingDoc === 'id'}
                    disabled={uploadingDoc !== null}
                    onPress={() => void upload('id')}
                    testID="barber-verify-doc-id"
                  />
                  <DocRow
                    label={de ? 'Barber-Lizenz' : 'Barber licence'}
                    language={language}
                    uploaded={Boolean(request?.license_image_url)}
                    uploading={uploadingDoc === 'license'}
                    disabled={uploadingDoc !== null}
                    onPress={() => void upload('license')}
                    testID="barber-verify-doc-license"
                  />
                </View>
                <Text style={[styles.footnote, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {de
                    ? 'Deine Unterlagen werden privat gespeichert und von unserem Team persönlich geprüft. Es gibt keine automatische Erkennung und keine biometrische Verarbeitung.'
                    : 'Documents are stored privately and reviewed by our team. There is no automated scanning or biometric processing.'}
                </Text>
              </>
            ) : null}
            {status === 'rejected' ? (
              <Pressable onPress={() => void Linking.openURL('mailto:privelier@outlook.com?subject=Verification%20help')} accessibilityRole="link" testID="barber-verify-contact" style={styles.contactAction}>
                <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>{de ? 'Verifizierungssupport kontaktieren' : 'Contact verification support'}</Text>
              </Pressable>
            ) : null}

            <MembershipCard language={language} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space['2xl'] },
  heading: { fontSize: 30 },
  subtitle: { ...typeScale.body, marginTop: 8 },
  noticeMargins: { marginTop: space.xl },
  noticeAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  contactAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: space.sm },
  docs: { marginTop: 32, gap: space.md },
  footnote: { fontSize: 12, lineHeight: 18, marginTop: 32 },
});
