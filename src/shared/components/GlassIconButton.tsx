/**
 * A round glass control for icon-only actions (back, close, more, jump to
 * latest). The visible disc is 36–44pt; hitSlop keeps the touch target at
 * least 44pt. Always needs an accessibility label, since it has no text.
 */
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { pressOpacity } from '../../theme/motion';
import { useTheme } from '../../theme/useTheme';
import { useGlassStyle, type GlassTone } from './GlassSurface';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  size?: 36 | 44;
  tone?: GlassTone;
  disabled?: boolean;
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GlassIconButton({ icon, onPress, accessibilityLabel, testID, size = 36, tone = 'neutral', disabled = false, floating = false, style }: Props) {
  const { colors } = useTheme();
  const glassStyle = useGlassStyle(tone, floating);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={(44 - size) / 2 + 4}
      testID={testID}
      style={({ pressed }) => [
        styles.disc,
        { width: size, height: size, borderRadius: size / 2 },
        glassStyle,
        disabled ? { opacity: 0.5 } : pressed ? { opacity: pressOpacity.soft } : null,
        style,
      ]}
    >
      <Feather name={icon} size={size === 44 ? 18 : 16} color={tone === 'brass' ? colors.accentText : colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
