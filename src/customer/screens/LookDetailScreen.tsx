/**
 * One published look with its proof chain (Looks S3, flag-gated, opened from
 * the Discover rail). "Book this look" starts the normal booking flow with
 * this barber and the look's service; the look rides along and is attached
 * to the new request only after it was created. If the service is gone, it
 * opens the barber's profile instead.
 *
 * Maestro contract: customer-look-detail-screen / -back / -photo-{n} /
 * -proof / -hit-rate / -book / -barber / -report / -gone / -error.
 */
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { Notice } from '../../shared/components/Notice';
import { PortfolioGrid } from '../../shared/components/PortfolioGrid';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { getAppLanguage } from '../../shared/locale';
import { LookPhotoTile } from '../../looks/components/LookPhotoTile';
import { hitRateLine, styleList } from '../../looks/lookPresentation';
import type { FeedLook } from '../../looks/types';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { useLookDetail } from '../hooks/useLookDetail';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'LookDetail'>;
type FeatherName = ComponentProps<typeof Feather>['name'];

function proofChain(look: FeedLook, de: boolean): { icon: FeatherName; text: string }[] {
  const items: { icon: FeatherName; text: string }[] = [
    { icon: 'check-circle', text: de ? 'Termin bei Privelier abgeschlossen' : 'Appointment completed on Privelier' },
    { icon: 'user-check', text: de ? 'Vom Kunden als sein Schnitt bestätigt' : 'Confirmed by the client as their cut' },
  ];
  if (look.review_rating !== null) {
    items.push({ icon: 'star', text: de ? `Bewertung des Kunden: ${look.review_rating} von 5` : `Client rating: ${look.review_rating} of 5` });
  }
  if (look.arrival_confirmed) {
    items.push({ icon: 'navigation', text: de ? 'Ankunft live geteilt' : 'Arrival shared live' });
  }
  return items;
}

export default function LookDetailScreen({ route, navigation }: Props) {
  const de = getAppLanguage() === 'de';
  const { colors, fonts } = useTheme();
  const detail = useLookDetail(route.params.lookId);
  const { look } = detail;
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };

  const book = () => {
    if (!look) return;
    if (!detail.service) {
      navigation.navigate('BarberProfile', { barberId: look.barber_id });
      return;
    }
    navigation.navigate('BookingDateTime', {
      barberId: look.barber_id,
      barberName: look.barber_name ?? '',
      barberImage: look.barber_image,
      service: detail.service,
      lookReference: { lookId: look.look_id, style: look.styles[0] },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-look-detail-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="customer-look-detail-back" title={de ? 'Look' : 'Look'} />
      {detail.loading ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} accessibilityLabel={de ? 'Wird geladen' : 'Loading'} />
      ) : !look ? (
        <View style={styles.content}>
          {detail.error ? <Notice message={detail.error} testID="customer-look-detail-error" /> : (
            <Notice variant="info" message={de ? 'Dieser Look ist nicht mehr verfügbar.' : 'This look is no longer available.'} testID="customer-look-detail-gone" />
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{styleList(detail.styles, look.styles, de)}</Text>
            <PortfolioGrid style={styles.block}>
              {look.photo_paths.map((path, index) => (
                <LookPhotoTile
                  key={path}
                  uri={detail.urls.get(path) ?? null}
                  label={de ? `Ergebnisfoto ${index + 1}` : `Result photo ${index + 1}`}
                  testID={`customer-look-detail-photo-${index + 1}`}
                />
              ))}
            </PortfolioGrid>

            <GlassSurface style={styles.surface} testID="customer-look-detail-proof">
              <Text style={[styles.section, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Belege' : 'Proof'}</Text>
              {proofChain(look, de).map((item) => (
                <View key={item.text} style={styles.proofRow}>
                  <Feather name={item.icon} size={16} color={colors.accentText} />
                  <Text style={[styles.body, { color: colors.textPrimary, fontFamily: fonts.body }]}>{item.text}</Text>
                </View>
              ))}
              {detail.stat ? <Text style={[styles.body, muted, styles.block]} testID="customer-look-detail-hit-rate">{hitRateLine(detail.stat, de)}</Text> : null}
            </GlassSurface>

            <Pressable
              onPress={() => navigation.navigate('BarberProfile', { barberId: look.barber_id })}
              accessibilityRole="button"
              accessibilityLabel={de ? `Profil von ${look.barber_name ?? 'Barber'} öffnen` : `Open ${look.barber_name ?? 'barber'}'s profile`}
              testID="customer-look-detail-barber"
              style={({ pressed }) => [styles.barberRow, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
            >
              <View style={styles.flex}>
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 16 }}>{look.barber_name}</Text>
                <Text style={[styles.body, muted]}>
                  {de ? `${look.proof_count} bestätigte Looks` : `${look.proof_count} confirmed looks`}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </Pressable>

            <Pressable
              onPress={() => void detail.report()}
              disabled={detail.reported}
              accessibilityRole="button"
              accessibilityLabel={de ? 'Look melden' : 'Report look'}
              testID="customer-look-detail-report"
              style={({ pressed }) => [styles.report, { opacity: pressed ? pressOpacity.soft : 1 }]}
            >
              <Text style={[styles.body, muted]}>
                {detail.reported
                  ? (de ? 'Gemeldet. Wir prüfen das innerhalb von 24 Stunden.' : 'Reported. We review it within 24 hours.')
                  : (de ? 'Look melden' : 'Report look')}
              </Text>
            </Pressable>
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <PrimaryButton
              label={detail.service
                ? (de ? `Diesen Look buchen · ${detail.service.name}` : `Book this look · ${detail.service.name}`)
                : (de ? 'Barber ansehen' : 'View barber')}
              onPress={book}
              testID="customer-look-detail-book"
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  loading: { marginTop: space['2xl'] },
  content: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['2xl'] },
  title: { fontSize: 22, lineHeight: 29 },
  block: { marginTop: space.base },
  surface: { marginTop: space.lg, padding: space.base, gap: space.sm },
  section: { fontSize: 15 },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  body: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  barberRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: HAIRLINE, marginTop: space.lg, paddingVertical: space.md },
  report: { minHeight: 44, justifyContent: 'center', marginTop: space.md },
  footer: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: 20, borderTopWidth: HAIRLINE },
});
