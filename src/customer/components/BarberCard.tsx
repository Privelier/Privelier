/**
 * Barber cards for the customer Discover screen, rebuilt from the Privelier
 * web prototype (BarberCard.tsx there): a "wide" editorial featured card and
 * a "compact" card for the horizontal "Nearby masters" rail.
 *
 * Bound strictly to real data: `barber_directory` rows plus that barber's
 * services (for the "from €X" line and the specialty line). Prototype fields
 * we have no data for yet (distance km, "available today") are deliberately
 * absent rather than faked.
 *
 * The verified badge renders for every card: presence in `barber_directory`
 * *is* founder approval (the view is pre-filtered to
 * verification_status = 'approved'), so every visible row is verified by
 * construction.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { numericText } from '../../theme/typography';
import { pressOpacity } from '../../theme/motion';
import { radius } from '../../theme/spacing';
import { Avatar } from '../../shared/components/Avatar';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { getAppLanguage } from '../../shared/locale';
import type { BarberDirectoryRow, ServiceRow } from '../../types';
import { formatMoney } from '../format';

type Props = {
  barber: BarberDirectoryRow;
  services: ServiceRow[];
  variant?: 'wide' | 'compact';
  /**
   * Only a genuinely-featured wide card shows the "Editor's pick" mark. Discover
   * passes it on its lead card alone; Explore (a plain list) never does — so the
   * label means something and brass stays rationed.
   */
  featured?: boolean;
  onPress: () => void;
};

function startingPrice(services: ServiceRow[]): number | null {
  if (services.length === 0) return null;
  return Math.min(...services.map((s) => s.price));
}

function CardImage({ barber, aspectRatio }: { barber: BarberDirectoryRow; aspectRatio: number }) {
  return (
    <Avatar
      id={barber.id}
      name={barber.name}
      imageUrl={barber.profile_image}
      shape="rounded"
      monogramFontSize={44}
      accessible={false}
      testID={`customer-barber-avatar-${barber.id}`}
      style={[styles.image, { aspectRatio }]}
    />
  );
}

function RatingLine({ rating, size, language }: { rating: number; size: number; language: 'de' | 'en' }) {
  const { colors, fonts } = useTheme();
  if (rating > 0) {
    return (
      <View style={styles.ratingRow} accessibilityLabel={`Rating ${rating.toFixed(1)} out of 5`}>
        <Ionicons name="star" size={size} color={colors.accent} />
        <Text style={[numericText, { fontSize: size + 1, color: colors.textPrimary }]}>
          {rating.toFixed(1)}
        </Text>
      </View>
    );
  }
  return (
    <Text
      style={[{ fontSize: size + 1, color: colors.textSecondary, fontFamily: fonts.body }]}
      accessibilityLabel={language === 'de' ? 'Noch keine Bewertungen' : 'No reviews yet'}
    >
      {language === 'de' ? 'Noch keine Bewertungen' : 'No reviews yet'}
    </Text>
  );
}

export default function BarberCard({ barber, services, variant = 'wide', featured = false, onPress }: Props) {
  const { colors, fonts } = useTheme();
  const language = getAppLanguage();
  const from = startingPrice(services);
  const specialties = services
    .slice(0, 2)
    .map((s) => s.name)
    .join(' · ');
  const cardLabel = [
    barber.name,
    barber.city,
    barber.rating > 0
      ? language === 'de' ? `Bewertung ${barber.rating.toFixed(1)} von 5` : `rated ${barber.rating.toFixed(1)} out of 5`
      : language === 'de' ? 'Noch keine Bewertungen' : 'No reviews yet',
    from !== null ? language === 'de' ? `Leistungen ab ${formatMoney(from)}` : `services from ${formatMoney(from)}` : null,
    language === 'de' ? 'Verifizierter Barber' : 'Verified barber',
  ].filter(Boolean).join(', ');

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={cardLabel}
        accessibilityHint="Opens the barber profile"
        testID={`customer-home-barber-${barber.id}`}
      style={({ pressed }) => [styles.compactPressable, { opacity: pressed ? pressOpacity.soft : 1 }]}
      >
        <GlassSurface style={styles.compact}>
          <CardImage barber={barber} aspectRatio={1} />
          <View style={styles.compactMetaRow}>
            <View style={styles.compactMetaLeft}>
              <View style={styles.nameRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.compactName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
                >
                  {barber.name}
                </Text>
                <MaterialCommunityIcons name="check-decagram" size={14} color={colors.accent} />
              </View>
              {barber.city ? <View style={styles.locationRow}>
                <Feather name="map-pin" size={11} color={colors.textSecondary} />
                <Text
                  numberOfLines={1}
                  style={[styles.compactLocation, { color: colors.textSecondary, fontFamily: fonts.body }]}
                >
                  {barber.city}
                </Text>
              </View> : null}
            </View>
            <View style={styles.compactMetaRight}>
              <RatingLine rating={barber.rating} size={13} language={language} />
              {from !== null ? (
                <Text style={[styles.compactPrice, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {language === 'de' ? 'ab' : 'from'}{' '}
                  <Text style={[numericText, { color: colors.textPrimary }]}>
                    {formatMoney(from)}
                  </Text>
                </Text>
              ) : null}
            </View>
          </View>
        </GlassSurface>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cardLabel}
      accessibilityHint="Opens the barber profile"
      testID={`customer-home-barber-${barber.id}`}
      style={({ pressed }) => [styles.widePressable, { opacity: pressed ? pressOpacity.soft : 1 }]}
    >
      <GlassSurface style={styles.wide}>
        <CardImage barber={barber} aspectRatio={16 / 10} />
        <View style={styles.wideMetaRow}>
          <View style={styles.wideMetaLeft}>
            {featured ? (
              <Text style={[styles.editorsPick, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                {language === 'de' ? 'Privelier Auswahl' : 'Featured barber'}
              </Text>
            ) : null}
            <View style={styles.nameRow}>
              <Text
                numberOfLines={1}
                style={[styles.wideName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
              >
                {barber.name}
              </Text>
              <MaterialCommunityIcons name="check-decagram" size={16} color={colors.accent} />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.wideMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}
            >
              {[barber.city, specialties].filter(Boolean).join(' · ') || (language === 'de' ? 'Noch keine Leistungen' : 'No services listed')}
            </Text>
          </View>
          <View style={styles.wideMetaRight}>
            <RatingLine rating={barber.rating} size={13} language={language} />
            {from !== null ? (
              <Text style={[styles.widePrice, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {language === 'de' ? 'ab' : 'from'}{' '}
                <Text style={[numericText, { color: colors.textPrimary }]}>
                  {formatMoney(from)}
                </Text>
              </Text>
            ) : null}
          </View>
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', borderRadius: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },

  compactPressable: { alignSelf: 'flex-start' },
  compact: { width: 256 },
  compactMetaRow: { flexDirection: 'column', justifyContent: 'space-between', gap: 8, marginTop: 12, paddingHorizontal: 12, paddingBottom: 14 },
  compactMetaLeft: { flexShrink: 1, minWidth: 0 },
  compactMetaRight: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  compactName: { fontSize: 17, flexShrink: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  compactLocation: { fontSize: 14 },
  compactPrice: { fontSize: 14, marginTop: 3 },

  widePressable: { width: '100%' },
  wide: { width: '100%', borderRadius: radius.xl },
  wideMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 12, paddingHorizontal: 16, paddingBottom: 16 },
  wideMetaLeft: { flexShrink: 1, minWidth: 0 },
  wideMetaRight: { alignItems: 'flex-end' },
  editorsPick: { fontSize: 12 },
  wideName: { fontSize: 21, marginTop: 4, flexShrink: 1 },
  wideMeta: { fontSize: 14, marginTop: 4 },
  widePrice: { fontSize: 14, marginTop: 4 },
});
