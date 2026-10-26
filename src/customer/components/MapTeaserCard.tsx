/**
 * Discover → Explore bridge: the faces of the barbers who are actually on
 * the map (display coordinates set), stacked, with one tap to the map. The
 * count is the real mappable count — barbers without a location are not on
 * the map, so they are not counted here either.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { typeScale, numericText } from '../../theme/typography';
import { space } from '../../theme/spacing';
import { Avatar } from '../../shared/components/Avatar';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { PressableScale } from '../../shared/motion/PressableScale';
import { getAppLanguage } from '../../shared/locale';
import type { BarberDirectoryRow } from '../../types';

const FACE = 36;
const MAX_FACES = 4;

type Props = {
  barbers: readonly BarberDirectoryRow[];
  cityName: string | null;
  onOpenMap: () => void;
};

export function MapTeaserCard({ barbers, cityName, onOpenMap }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  if (barbers.length === 0) return null;

  const faces = barbers.slice(0, MAX_FACES);
  const extra = barbers.length - faces.length;
  const city = cityName ?? (de ? 'deiner Nähe' : 'your area');
  const title = de
    ? `${barbers.length} Barber auf der Karte`
    : `${barbers.length} ${barbers.length === 1 ? 'barber' : 'barbers'} on the map`;

  return (
    <PressableScale
      onPress={onOpenMap}
      haptic
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${city}`}
      accessibilityHint={de ? 'Öffnet die Karte' : 'Opens the map'}
      testID="customer-home-map-teaser"
    >
      <GlassSurface style={styles.card}>
        <View style={styles.faces} importantForAccessibility="no-hide-descendants">
          {faces.map((barber, index) => (
            <Avatar
              key={barber.id}
              id={barber.id}
              name={barber.name}
              imageUrl={barber.profile_image}
              size={FACE}
              accessible={false}
              style={[styles.face, index > 0 && styles.overlap, { borderColor: colors.background }]}
            />
          ))}
          {extra > 0 ? (
            <View style={[styles.face, styles.overlap, styles.more, { backgroundColor: colors.surface, borderColor: colors.background }]}>
              <Text style={[styles.moreText, numericText, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
                +{extra}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[typeScale.body, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[typeScale.caption, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? `Sieh, wer in ${city} unterwegs ist` : `See who works around ${city}`}
          </Text>
        </View>
        <View style={[styles.mapIcon, { borderColor: colors.accent }]}>
          <Feather name="map" size={16} color={colors.accentText} />
        </View>
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.base,
    borderRadius: 18,
    minHeight: 72,
  },
  faces: { flexDirection: 'row', alignItems: 'center' },
  face: { width: FACE, height: FACE, borderRadius: FACE / 2, borderWidth: 2 },
  overlap: { marginLeft: -12 },
  more: { alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 11 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  mapIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
