/**
 * The client's look wishes (Looks S5, flag-gated). Opened after "Send as a
 * wish", from the look search and from a look_offer notification or push.
 * Each wish shows its day and window and where it stands; open wishes list
 * the barbers' offers (proof, service, normal price, their note) with "Book
 * at HH:MM" straight into the address step, where accept_offer links the
 * new request. Offers can be reported, open wishes taken back.
 *
 * Maestro contract: customer-look-wishes-screen / -back / -empty /
 * -wish-{id} / -cancel-{id} / -offer-{offerId} / -book-{offerId} /
 * -report-{offerId} / -error.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../../shared/components/EmptyState';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { Notice } from '../../shared/components/Notice';
import { ReportSheet } from '../../shared/components/ReportSheet';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { getAppLanguage } from '../../shared/locale';
import { styleList } from '../../looks/lookPresentation';
import { matchProofLine, wishStatusLine, wishWindowLine } from '../../looks/searchPresentation';
import { pressOpacity } from '../../theme/motion';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { LookOfferCard } from '../components/looks/LookOfferCard';
import { useLookWishes } from '../hooks/useLookWishes';
import { openLookBooking } from '../lookBooking';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'LookWishes'>;

export default function LookWishesScreen({ navigation }: Props) {
  const de = getAppLanguage() === 'de';
  const { colors, fonts } = useTheme();
  const wishes = useLookWishes();
  const [reporting, setReporting] = useState<string | null>(null);
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };
  const link = (pressed: boolean) => [styles.link, { opacity: pressed ? pressOpacity.soft : 1 }];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-look-wishes-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="customer-look-wishes-back" title={de ? 'Deine Look-Wünsche' : 'Your look wishes'} />
      <ScrollView contentContainerStyle={styles.content}>
        {wishes.error ? <Notice message={wishes.error} testID="customer-look-wishes-error" style={styles.gap} /> : null}
        {wishes.wishes !== null && wishes.wishes.length === 0 ? (
          <EmptyState
            icon="scissors"
            testID="customer-look-wishes-empty"
            title={de ? 'Noch keine Wünsche.' : 'No wishes yet.'}
            body={de
              ? 'Findet die Look-Suche niemanden, der frei ist, schickst du deinen Look als Wunsch. Barber mit Beweis in diesem Stil schlagen dir eine Zeit vor.'
              : 'When look search finds nobody free, send your look as a wish. Barbers with proof in that style suggest a time.'}
          />
        ) : null}
        {(wishes.wishes ?? []).map((wish) => {
          const styleName = styleList(wishes.styles, [wish.style], de);
          const offers = wish.status === 'open' ? wishes.offersFor(wish.id) : [];
          return (
            <GlassSurface key={wish.id} style={styles.wish} testID={`customer-look-wishes-wish-${wish.id}`}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 16 }}>{styleName}</Text>
              <Text style={[styles.body, muted]}>{wishWindowLine(wish, de)}</Text>
              <Text style={[styles.body, muted]}>{wishStatusLine(wish, de)}</Text>
              {wish.status === 'open' && offers.length === 0 ? (
                <Text style={[styles.body, muted, styles.gap]}>{de ? 'Noch keine Angebote. Wir sagen dir Bescheid.' : 'No offers yet. We will let you know.'}</Text>
              ) : null}
              {offers.map((offer) => (
                <LookOfferCard
                  key={offer.offer_id}
                  name={offer.barber_name}
                  proofLine={matchProofLine(offer, styleName, de)}
                  serviceName={offer.service_name}
                  price={offer.service_price}
                  time={offer.proposed_time}
                  note={offer.note}
                  de={de}
                  testID={`customer-look-wishes-offer-${offer.offer_id}`}
                  bookTestID={`customer-look-wishes-book-${offer.offer_id}`}
                  onBook={() => void wishes.serviceFor(offer).then((service) => openLookBooking(navigation, {
                    barberId: offer.barber_id,
                    barberName: offer.barber_name,
                    barberImage: offer.barber_image,
                    service,
                    date: wish.day,
                    time: offer.proposed_time,
                    lookReference: { lookId: null, style: wish.style, photoPath: wish.photo_path, offerId: offer.offer_id },
                  }))}
                >
                  <Pressable
                    onPress={() => setReporting(offer.offer_id)}
                    accessibilityRole="button"
                    accessibilityLabel={de ? 'Angebot melden' : 'Report offer'}
                    testID={`customer-look-wishes-report-${offer.offer_id}`}
                    style={({ pressed }) => link(pressed)}
                  >
                    <Text style={[styles.linkText, muted]}>{de ? 'Melden' : 'Report'}</Text>
                  </Pressable>
                </LookOfferCard>
              ))}
              {wish.status === 'open' ? (
                <Pressable
                  onPress={() => void wishes.cancel(wish.id)}
                  disabled={wishes.busyId === wish.id}
                  accessibilityRole="button"
                  accessibilityLabel={de ? 'Wunsch zurücknehmen' : 'Withdraw wish'}
                  testID={`customer-look-wishes-cancel-${wish.id}`}
                  style={({ pressed }) => link(pressed)}
                >
                  <Text style={[styles.linkText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Wunsch zurücknehmen' : 'Withdraw wish'}</Text>
                </Pressable>
              ) : null}
            </GlassSurface>
          );
        })}
      </ScrollView>
      {reporting ? (
        <ReportSheet open target={{ type: 'offer', offerId: reporting }} onClose={() => setReporting(null)} testIDPrefix="customer-look-wishes" />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['2xl'] },
  wish: { marginTop: space.md, padding: space.base },
  body: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  gap: { marginTop: space.md },
  link: { minHeight: 44, justifyContent: 'center', marginTop: space.xs },
  linkText: { fontSize: 14 },
});
