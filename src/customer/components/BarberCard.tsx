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
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { pressOpacity } from '../../theme/motion';
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
  const { colors, fonts } = useTheme();
  if (barber.profile_image) {
    return (
      <Image
        source={{ uri: barber.profile_image }}
        style={[styles.image, { aspectRatio, backgroundColor: colors.surface }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.image, styles.imageFallback, { aspectRatio, backgroundColor: colors.surface }]}>
      <Text style={[styles.imageInitial, { color: colors.textSecondary, fontFamily: fonts.headingMedium }]}>
        {barber.name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

function RatingLine({ rating, size }: { rating: number; size: number }) {
  const { colors, fonts } = useTheme();
  if (rating > 0) {
    return (
      <View style={styles.ratingRow} accessibilityLabel={`Rating ${rating.toFixed(1)} out of 5`}>
        <Ionicons name="star" size={size} color={colors.accent} />
        <Text style={[{ fontSize: size + 1, color: colors.textPrimary, fontFamily: fonts.body }]}>
          {rating.toFixed(1)}
        </Text>
      </View>
    );
  }
  return (
    <Text
      style={[{ fontSize: size + 1, color: colors.textSecondary, fontFamily: fonts.body }]}
      accessibilityLabel="No ratings yet"
    >
      New
    </Text>
  );
}

export default function BarberCard({ barber, services, variant = 'wide', featured = false, onPress }: Props) {
  const { colors, fonts } = useTheme();
  const from = startingPrice(services);
  const specialties = services
    .slice(0, 2)
    .map((s) => s.name)
    .join(' · ');

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${barber.name}'s profile`}
        testID={`customer-home-barber-${barber.id}`}
        style={({ pressed }) => [styles.compact, { opacity: pressed ? pressOpacity.soft : 1 }]}
      >
        <CardImage barber={barber} aspectRatio={4 / 5} />
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
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={11} color={colors.textSecondary} />
              <Text
                numberOfLines={1}
                style={[styles.compactLocation, { color: colors.textSecondary, fontFamily: fonts.body }]}
              >
                {barber.city ?? 'City not set'}
              </Text>
            </View>
          </View>
          <View style={styles.compactMetaRight}>
            <RatingLine rating={barber.rating} size={11} />
            {from !== null ? (
              <Text style={[styles.compactPrice, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                from{' '}
                <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium }}>
                  {formatMoney(from)}
                </Text>
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${barber.name}'s profile`}
      testID={`customer-home-barber-${barber.id}`}
      style={({ pressed }) => ({ opacity: pressed ? pressOpacity.soft : 1 })}
    >
      <CardImage barber={barber} aspectRatio={16 / 10} />
      <View style={styles.wideMetaRow}>
        <View style={styles.wideMetaLeft}>
          {featured ? (
            <Text style={[styles.editorsPick, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
              {'Editor’s pick'}
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
            {[barber.city, specialties].filter(Boolean).join(' · ') || 'City not set'}
          </Text>
        </View>
        <View style={styles.wideMetaRight}>
          <RatingLine rating={barber.rating} size={13} />
          {from !== null ? (
            <Text style={[styles.widePrice, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              from{' '}
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium }}>
                {formatMoney(from)}
              </Text>
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', borderRadius: 8 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageInitial: { fontSize: 44 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },

  compact: { width: 256 },
  compactMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  compactMetaLeft: { flexShrink: 1, minWidth: 0 },
  compactMetaRight: { alignItems: 'flex-end' },
  compactName: { fontSize: 17, flexShrink: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  compactLocation: { fontSize: 12 },
  compactPrice: { fontSize: 12, marginTop: 3 },

  wideMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  wideMetaLeft: { flexShrink: 1, minWidth: 0 },
  wideMetaRight: { alignItems: 'flex-end' },
  editorsPick: { fontSize: 10, letterSpacing: 2 },
  wideName: { fontSize: 21, marginTop: 4, flexShrink: 1 },
  wideMeta: { fontSize: 12, marginTop: 4 },
  widePrice: { fontSize: 12, marginTop: 4 },
});
