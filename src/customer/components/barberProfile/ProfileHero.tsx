/**
 * The profile's full-bleed hero (photo under the status bar with a parallax
 * drift, or a monogram), the name block, then the about section: response
 * badge, bio with service-name chips, and popular times.
 */
import { Text, View, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar } from '../../../shared/components/Avatar';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { PopularTimesChart } from '../../../shared/components/stats/PopularTimesChart';
import { ResponseBadge } from '../../../shared/components/stats/ResponseBadge';
import type { BarberStatsRow } from '../../../shared/barberStats';
import { Reveal } from '../../../shared/motion';
import { numericText } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { BarberDirectoryRow } from '../../../types';
import { HERO_SCRIM, HERO_TEXT, HERO_TEXT_DIM, profileStyles as styles } from './profileStyles';

export function ProfileHero({
  barber,
  topInset,
  parallax,
  german,
}: {
  barber: BarberDirectoryRow;
  topInset: number;
  parallax: AnimatedStyle<ViewStyle>;
  german: boolean;
}) {
  const { colors, fonts } = useTheme();
  const hasPhoto = Boolean(barber.profile_image);
  const meta = { fontFamily: fonts.body, color: hasPhoto ? HERO_TEXT_DIM : colors.textSecondary };
  return (
    <View style={[styles.hero, { backgroundColor: colors.surface }]}>
      {barber.profile_image ? (
        <Animated.View style={[styles.heroImage, parallax]} testID="barber-profile-hero-parallax">
          <Image
            source={{ uri: barber.profile_image }}
            style={styles.heroImageFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={{ duration: 220, effect: 'cross-dissolve' }}
            priority="high"
          />
        </Animated.View>
      ) : (
        <View style={[styles.heroFallback, { paddingTop: topInset + 64 }]}>
          <View style={[styles.monogramFrame, { borderColor: colors.border }]}>
            <Avatar id={barber.id} name={barber.name} size={88} testID="barber-profile-monogram" />
          </View>
        </View>
      )}
      <View style={[styles.heroTitleBlock, { backgroundColor: hasPhoto ? HERO_SCRIM : colors.surface }]}>
        <View style={styles.nameRow}>
          <Text style={[styles.heroName, { fontFamily: fonts.headingMedium, color: hasPhoto ? HERO_TEXT : colors.textPrimary }]}>
            {barber.name}
          </Text>
          <MaterialCommunityIcons name="check-decagram" size={18} color={colors.accent} />
        </View>
        <View style={styles.heroMetaRow}>
          <Feather name="map-pin" size={11} color={meta.color} />
          <Text style={[styles.heroMeta, meta]}>
            {[barber.city, barber.country].filter(Boolean).join(', ') || (german ? 'Ort noch nicht angegeben' : 'Location not set')}
          </Text>
          <Text style={[styles.heroMeta, meta]}>·</Text>
          {barber.rating > 0 ? (
            <View style={styles.heroRating} testID="barber-profile-rating" accessibilityLabel={`Rating ${barber.rating.toFixed(1)} out of 5`}>
              <Ionicons name="star" size={11} color={colors.accent} />
              <Text style={[styles.heroMeta, numericText, { color: meta.color }]}>{barber.rating.toFixed(1)}</Text>
            </View>
          ) : (
            <Text style={[styles.heroMeta, meta]} testID="barber-profile-rating" accessibilityLabel={german ? 'Noch keine Bewertungen' : 'No ratings yet'}>
              {german ? 'Noch keine Bewertungen' : 'No ratings yet'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export function ProfileAbout({
  barber,
  chips,
  stats,
  german,
}: {
  barber: BarberDirectoryRow;
  /** This barber's service names. */
  chips: readonly string[];
  stats: BarberStatsRow | null;
  german: boolean;
}) {
  const { colors, fonts } = useTheme();
  return (
    <>
      {stats?.median_response_minutes != null ? (
        <View style={styles.badgeRow}>
          <ResponseBadge minutes={stats.median_response_minutes} testID="barber-profile-response" />
        </View>
      ) : null}

      <View style={styles.bioBlock}>
        <Text style={[styles.bio, { color: colors.textPrimary, fontFamily: fonts.body }]}>
          {barber.bio?.trim() || (german ? 'Dieser Barber hat noch keine Beschreibung hinzugefügt.' : 'This barber has not added a bio yet.')}
        </Text>
        {chips.length > 0 ? (
          <View style={styles.chipsRow}>
            {chips.map((chip) => (
              <View key={chip} style={[styles.chip, { borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.textSecondary, fontFamily: fonts.body }]}>{chip}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {stats?.popular_hours ? (
        <Reveal index={1} style={styles.popularWrap}>
          <GlassSurface style={styles.popularCard} testID="barber-profile-popular-times">
            <Text style={[styles.popularTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
              {german ? 'Beliebte Zeiten' : 'Popular times'}
            </Text>
            <PopularTimesChart grid={stats.popular_hours} testID="barber-profile-popular-chart" />
          </GlassSurface>
        </Reveal>
      ) : null}
    </>
  );
}
