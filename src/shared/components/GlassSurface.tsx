import { useEffect, useState, type PropsWithChildren, type RefObject } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { HAIRLINE, radius } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: 'card' | 'navigation';
  blurTarget?: RefObject<View | null>;
}>;

/** A quiet polished surface: a translucent body with a fine reflected top edge. */
export function GlassSurface({ children, style, testID, variant = 'card', blurTarget }: Props) {
  const { colors } = useTheme();
  const navigation = variant === 'navigation';
  const [reduceTransparency, setReduceTransparency] = useState(true);

  useEffect(() => {
    if (!navigation) return;
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => { if (active) setReduceTransparency(enabled); })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => { active = false; subscription.remove(); };
  }, [navigation]);

  const blur = navigation && !reduceTransparency && (Platform.OS !== 'android' || Boolean(blurTarget));

  return (
    <View
      testID={testID}
      style={[
        styles.surface,
        {
          backgroundColor: blur
            ? 'rgba(13,13,15,0.70)'
            : navigation ? colors.surface : 'rgba(20,20,22,0.84)',
          borderColor: 'rgba(191,160,107,0.30)',
        },
        style,
      ]}
    >
      {blur ? (
        <BlurView
          testID={testID ? `${testID}-blur` : undefined}
          pointerEvents="none"
          intensity={36}
          tint="dark"
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[styles.highlight, { backgroundColor: 'rgba(245,241,232,0.20)' }]}
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
