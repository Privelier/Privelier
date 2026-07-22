/**
 * Skeleton — a flat, calm loading placeholder block (Step-18 Ultra design
 * pass, increment-4 mop-up). A single surface-coloured rectangle with a
 * continuous, gentle opacity pulse — no gradient sweep (the brand forbids
 * gradients), no shadow. Screens compose it into content-shaped skeletons so
 * a loading state previews its layout instead of a bare spinner.
 *
 * The pulse duration is intentionally NOT one of the discrete `duration`
 * tokens in theme/motion.ts — those cover one-shot transitions (press,
 * notice in/out); this is a continuous ambient loop, a different motion
 * class, so it stays a local constant rather than stretching the token set
 * for its one use case.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../theme/spacing';

const PULSE_MS = 900;

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  // useState's lazy initializer (not useRef) so the Animated.Value is created
  // once without reading a ref's `.current` during render — react-hooks/refs
  // flags that pattern; Animated.Value is mutated by the animation engine
  // itself (outside React's render cycle), so holding it as state is safe and
  // never triggers a re-render via setState (the setter is never called).
  const [pulse] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.5,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[styles.block, { backgroundColor: colors.surface, borderRadius: radius.sm, opacity: pulse }, style]}
    />
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
});
