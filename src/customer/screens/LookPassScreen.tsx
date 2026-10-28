/**
 * The client's private look pass (Looks S6, flag-gated, opened from the
 * Discover looks rail). Each look the client confirmed as their cut, newest
 * first: what they asked for (their reference photo or the feed look they
 * booked from) next to the result, the barber and the styles. "This look
 * again" starts the normal booking with the same barber and service, the
 * look riding along as the reference. Only the client sees this screen.
 *
 * Maestro contract: customer-look-pass-screen / -back / -empty / -error /
 * -look-{lookId} / -reference-{lookId} / -result-{lookId} / -again-{lookId}.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../../shared/components/EmptyState';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { Notice } from '../../shared/components/Notice';
import { PortfolioGrid, portfolioTileStyle } from '../../shared/components/PortfolioGrid';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { formatShortDate } from '../../shared/format';
import { getAppLanguage } from '../../shared/locale';
import { LookPhotoTile } from '../../looks/components/LookPhotoTile';
import { styleList } from '../../looks/lookPresentation';
import type { PassLook } from '../../looks/types';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { useLookPass } from '../hooks/useLookPass';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'LookPass'>;

export default function LookPassScreen({ navigation }: Props) {
  const de = getAppLanguage() === 'de';
  const { colors, fonts } = useTheme();
  const pass = useLookPass();
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };

  const bookAgain = (look: PassLook) => void pass.serviceFor(look).then((service) => {
    if (!service) {
      navigation.navigate('BarberProfile', { barberId: look.barber_id });
      return;
    }
    navigation.navigate('BookingDateTime', {
      barberId: look.barber_id,
      barberName: look.barber_name ?? '',
      barberImage: look.barber_image,
      service,
      // Only a shown look can be attached by id; otherwise the style rides along.
      lookReference: { lookId: look.status === 'published' ? look.look_id : null, style: look.styles[0] },
    });
  });

  // Same two-column tile contract as every look photo; an empty side is a
  // quiet outlined square with one line of why.
  const tile = (uri: string | null, label: string, emptyText: string, testID: string) => (uri ? (
    <LookPhotoTile uri={uri} label={label} testID={testID} />
  ) : (
    <View style={[portfolioTileStyle, styles.placeholder, { borderColor: colors.border }]} testID={testID} accessible accessibilityLabel={`${label}: ${emptyText}`}>
      <Text style={[styles.placeholderText, muted]}>{emptyText}</Text>
    </View>
  ));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-look-pass-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="customer-look-pass-back" title={de ? 'Dein Look-Pass' : 'Your look pass'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.body, muted]}>{de ? 'Nur für dich: was du wolltest und was daraus wurde.' : 'Only for you: what you asked for and what you got.'}</Text>
        {pass.error ? <Notice message={pass.error} testID="customer-look-pass-error" style={styles.gap} /> : null}
        {pass.looks !== null && pass.looks.length === 0 ? (
          <EmptyState
            icon="scissors"
            testID="customer-look-pass-empty"
            title={de ? 'Noch keine Looks.' : 'No looks yet.'}
            body={de ? 'Bestätigst du nach einem Termin "Das ist mein Schnitt", landet er hier.' : 'When you confirm "this is my cut" after an appointment, it lands here.'}
          />
        ) : null}
        {(pass.looks ?? []).map((look) => {
          const images = pass.imagesFor(look);
          return (
            <GlassSurface key={look.look_id} style={styles.card} testID={`customer-look-pass-look-${look.look_id}`}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 16 }}>{styleList(pass.styles, look.styles, de)}</Text>
              <Text style={[styles.body, muted]}>{`${look.barber_name ?? 'Barber'} · ${formatShortDate(look.appointment_date)}`}</Text>
              <View style={styles.captions}>
                <Text style={[styles.caption, muted]}>{de ? 'Dein Wunsch' : 'You asked for'}</Text>
                <Text style={[styles.caption, muted]}>{de ? 'Ergebnis' : 'Result'}</Text>
              </View>
              <PortfolioGrid>
                {tile(images.reference, de ? 'Dein Wunsch' : 'You asked for', de ? 'Ohne Referenz gebucht' : 'Booked without a reference', `customer-look-pass-reference-${look.look_id}`)}
                {tile(images.result, de ? 'Ergebnis' : 'Result', de ? 'Nicht gezeigt, daher kein Foto gespeichert' : 'Not shown, so no photo kept', `customer-look-pass-result-${look.look_id}`)}
              </PortfolioGrid>
              {look.can_rebook ? (
                <Pressable
                  onPress={() => bookAgain(look)}
                  accessibilityRole="button"
                  accessibilityLabel={de ? `Diesen Look wieder bei ${look.barber_name ?? 'Barber'} buchen` : `Book this look again with ${look.barber_name ?? 'barber'}`}
                  testID={`customer-look-pass-again-${look.look_id}`}
                  style={({ pressed }) => [styles.again, { borderColor: colors.accent, opacity: pressed ? pressOpacity.soft : 1 }]}
                >
                  <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium, fontSize: 15 }}>{de ? 'Diesen Look wieder' : 'This look again'}</Text>
                </Pressable>
              ) : null}
            </GlassSurface>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['2xl'] },
  body: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  gap: { marginTop: space.md },
  card: { marginTop: space.md, padding: space.base },
  captions: { flexDirection: 'row', gap: 12, marginTop: space.md, marginBottom: space.xs },
  caption: { flex: 1, fontSize: 12 },
  placeholder: { borderWidth: HAIRLINE, alignItems: 'center', justifyContent: 'center', padding: space.sm },
  placeholderText: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  again: { minHeight: 44, borderWidth: HAIRLINE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
});
