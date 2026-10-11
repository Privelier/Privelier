/**
 * A selectable glass chip for filters. Unselected chips are neutral glass;
 * the selected chip turns brass glass with a check, so selection never rests
 * on colour alone. Taps give a light selection haptic.
 */
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { pressOpacity } from '../../theme/motion';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { haptics } from '../haptics';
import { useGlassStyle } from './GlassSurface';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
  size?: 'regular' | 'compact';
};

export function GlassChip({ label, selected, onPress, accessibilityLabel, testID, size = 'regular' }: Props) {
  const { colors, fonts } = useTheme();
  const neutral = useGlassStyle('neutral');
  const brass = useGlassStyle('brass');
  return (
    <Pressable
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      testID={testID}
      hitSlop={size === 'compact' ? 6 : 0}
      style={({ pressed }) => [
        styles.chip,
        size === 'compact' ? styles.compact : null,
        selected ? brass : neutral,
        pressed ? { opacity: pressOpacity.soft } : null,
      ]}
    >
      {selected ? <Feather name="check" size={size === 'compact' ? 12 : 14} color={colors.accentText} /> : null}
      <Text
        numberOfLines={1}
        style={[
          size === 'compact' ? styles.compactText : styles.text,
          { fontFamily: selected ? fonts.bodyMedium : fonts.body, color: selected ? colors.textPrimary : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 22,
    paddingHorizontal: space.base,
    overflow: 'hidden',
  },
  compact: { minHeight: 34, borderRadius: 17, paddingHorizontal: space.md },
  text: { fontSize: 14 },
  compactText: { fontSize: 12 },
});
