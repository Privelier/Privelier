import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius } from '../../theme/spacing';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/** A quiet polished surface: a translucent body with a fine reflected top edge. */
export function GlassSurface({ children, style, testID }: Props) {
  const { colors, isDark } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.surface,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.86)',
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.highlight, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.96)' }]}
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
    borderRadius: radius.lg,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HAIRLINE,
  },
});
