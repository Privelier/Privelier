/**
 * One-tap shortcuts at the top of the barber dashboard — the four things a
 * barber changes most (services, hours, portfolio, base location). Glass
 * tiles that spring on press and enter in a short stagger.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { radius, space } from '../../theme/spacing';
import { getAppLanguage } from '../../shared/locale';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { PressableScale } from '../../shared/motion/PressableScale';
import { Reveal } from '../../shared/motion/Reveal';

export type QuickActionKey = 'services' | 'availability' | 'portfolio' | 'location';

const ICONS: Record<QuickActionKey, keyof typeof Feather.glyphMap> = {
  services: 'scissors',
  availability: 'clock',
  portfolio: 'image',
  location: 'map-pin',
};

export function QuickActions({ onOpen }: { onOpen: (key: QuickActionKey) => void }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const labels: Record<QuickActionKey, string> = de
    ? { services: 'Leistungen', availability: 'Zeiten', portfolio: 'Portfolio', location: 'Standort' }
    : { services: 'Services', availability: 'Hours', portfolio: 'Portfolio', location: 'Location' };

  return (
    <View style={styles.row} testID="barber-dashboard-quick-actions">
      {(Object.keys(ICONS) as QuickActionKey[]).map((key, index) => (
        <Reveal key={key} index={index} style={styles.cell}>
          <PressableScale
            haptic
            onPress={() => onOpen(key)}
            accessibilityRole="button"
            accessibilityLabel={labels[key]}
            testID={`barber-quick-${key}`}
          >
            <GlassSurface style={styles.tile}>
              <View style={[styles.iconDisc, { borderColor: colors.border }]}>
                <Feather name={ICONS[key]} size={17} color={colors.accentText} />
              </View>
              <Text style={[styles.label, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]} numberOfLines={1}>
                {labels[key]}
              </Text>
            </GlassSurface>
          </PressableScale>
        </Reveal>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  cell: { flex: 1 },
  tile: { alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.xs, borderRadius: radius.lg },
  iconDisc: { width: 38, height: 38, borderRadius: 19, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12 },
});
