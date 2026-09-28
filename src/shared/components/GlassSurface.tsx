import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius } from '../../theme/spacing';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: 'card' | 'navigation';
}>;

/** A quiet polished surface: a translucent body with a fine reflected top edge. */
export function GlassSurface({ children, style, testID, variant = 'card' }: Props) {
  const { colors, isDark } = useTheme();
  const navigation = variant === 'navigation';

  return (
    <View
      testID={testID}
      style={[
        styles.surface,
        {
          backgroundColor: isDark
            ? navigation ? 'rgba(13,13,15,0.94)' : 'rgba(20,20,22,0.84)'
            : navigation ? 'rgba(248,244,236,0.94)' : 'rgba(255,255,255,0.84)',
          borderColor: isDark ? 'rgba(191,160,107,0.30)' : colors.border,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.highlight, { backgroundColor: isDark ? 'rgba(245,241,232,0.20)' : 'rgba(255,255,255,0.96)' }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: HAIRLINE,
    borderRadius: radius.xl,
  },
  highlight: {
    position: 'absolute',
    top: 1,
    left: 20,
    right: 20,
    height: HAIRLINE,
  },
});
