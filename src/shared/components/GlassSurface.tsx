import { useEffect, useState, type PropsWithChildren, type RefObject } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { HAIRLINE, radius } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * - card: content surfaces, including list rows. Translucent glass over the
   *   ambient backdrop, never a live blur (scrolling many blurs is the most
   *   expensive effect on Android).
   * - navigation: tab bars and chat headers/composers (live blur where the
   *   platform supports it).
   * - floating: few, pinned overlays — toast, offline pill, glass title bar,
   *   booking dock. Live blur on iOS; translucent glass elsewhere.
   */
  variant?: 'card' | 'navigation' | 'floating';
  blurTarget?: RefObject<View | null>;
}>;

/** Glass tokens: a translucent body, a light hairline edge and a top reflection. */
export const glass = {
  cardFill: 'rgba(28,28,32,0.52)',
  blurFill: 'rgba(16,16,18,0.55)',
  edge: 'rgba(245,241,232,0.14)',
  brassEdge: 'rgba(191,160,107,0.34)',
  reflection: 'rgba(245,241,232,0.32)',
} as const;

/** A frosted surface: translucent body, light edge, fine reflected top line. */
export function GlassSurface({ children, style, testID, variant = 'card', blurTarget }: Props) {
  const { colors } = useTheme();
  const blurCapable = variant === 'navigation' || variant === 'floating';
  const [reduceTransparency, setReduceTransparency] = useState(true);

  useEffect(() => {
    if (!blurCapable) return;
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => { if (active) setReduceTransparency(enabled); })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => { active = false; subscription.remove(); };
  }, [blurCapable]);

  const blur =
    blurCapable &&
    !reduceTransparency &&
    (Platform.OS === 'ios' || (variant === 'navigation' && Boolean(blurTarget)));

  // Reduce Transparency: solid, legible surfaces with the same edge.
  const fill = blur
    ? glass.blurFill
    : blurCapable && reduceTransparency
      ? colors.surface
      : glass.cardFill;

  return (
    <View
      testID={testID}
      style={[
        styles.surface,
        { backgroundColor: fill, borderColor: variant === 'card' ? glass.edge : glass.brassEdge },
        style,
      ]}
    >
      {blur ? (
        <BlurView
          testID={testID ? `${testID}-blur` : undefined}
          pointerEvents="none"
          intensity={variant === 'floating' ? 48 : 36}
          tint="dark"
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View pointerEvents="none" style={[styles.highlight, { backgroundColor: glass.reflection }]} />
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
    top: 0,
    left: 18,
    right: 18,
    height: HAIRLINE,
  },
});
