/**
 * "Book again" on Discover: a quiet rail of the barbers this customer has
 * already had a completed appointment with. One tap reopens their profile,
 * where services and real availability live, so the rail never shows a slot
 * or price that could be stale. Barbers no longer in the approved directory
 * are filtered out upstream (selectRebookBarbers).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { typeScale } from '../../theme/typography';
import { pressOpacity } from '../../theme/motion';
import { space } from '../../theme/spacing';
import { Avatar } from '../../shared/components/Avatar';
import { useGlassStyle } from '../../shared/components/GlassSurface';
import { haptics } from '../../shared/haptics';
import { getAppLanguage } from '../../shared/locale';
import type { BarberDirectoryRow } from '../../types';
import { firstName } from '../format';

type Props = {
  barbers: readonly BarberDirectoryRow[];
  onOpen: (barberId: string) => void;
};

const AVATAR = 60;

export function RebookRail({ barbers, onOpen }: Props) {
  const { colors, fonts } = useTheme();
  const ring = useGlassStyle('brass');
  const de = getAppLanguage() === 'de';
  if (barbers.length === 0) return null;

  return (
    <View testID="customer-home-rebook">
      <Text
        accessibilityRole="header"
        style={[typeScale.title3, styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
      >
        {de ? 'Erneut buchen' : 'Book again'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel={de ? 'Barber, bei denen du schon warst' : 'Barbers you have booked before'}
      >
        {barbers.map((barber) => (
          <Pressable
            key={barber.id}
            onPress={() => {
              void haptics.selection();
              onOpen(barber.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={de ? `${barber.name} erneut buchen` : `Book ${barber.name} again`}
            accessibilityHint={de ? 'Öffnet das Barber-Profil' : 'Opens the barber profile'}
            testID={`customer-home-rebook-${barber.id}`}
            style={({ pressed }) => [styles.item, { opacity: pressed ? pressOpacity.soft : 1 }]}
          >
            <View style={[styles.ring, ring]}>
              <Avatar id={barber.id} name={barber.name} imageUrl={barber.profile_image} size={AVATAR} accessible={false} />
            </View>
            <Text
              numberOfLines={1}
              style={[typeScale.secondary, styles.name, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}
            >
              {firstName(barber.name)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: space.xl },
  row: { gap: space.base, paddingHorizontal: space.xl, paddingTop: space.md },
  item: { width: AVATAR + space.sm, alignItems: 'center' },
  ring: {
    width: AVATAR + space.sm,
    height: AVATAR + space.sm,
    borderRadius: (AVATAR + space.sm) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: { marginTop: space.sm, maxWidth: AVATAR + space.base, textAlign: 'center' },
});
