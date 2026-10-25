/**
 * Skeleton — a flat, calm loading placeholder block. A single surface-coloured rectangle with a
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
import { useEffect } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../theme/spacing';
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference';

const PULSE_MS = 900;

// ONE pulse shared by every skeleton on screen: a loading list of twenty
// blocks runs a single native-driven loop instead of twenty, and the blocks
// breathe in unison (calmer than twenty drifting phases). Reference-counted
// so the loop only runs while at least one skeleton is mounted.
const sharedPulse = new Animated.Value(0.5);
let sharedLoop: Animated.CompositeAnimation | null = null;
let mounted = 0;

function retainPulse() {
  mounted += 1;
  if (sharedLoop) return;
  sharedLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(sharedPulse, { toValue: 1, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(sharedPulse, { toValue: 0.5, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])
  );
  sharedLoop.start();
}

function releasePulse() {
  mounted = Math.max(0, mounted - 1);
  if (mounted === 0 && sharedLoop) {
    sharedLoop.stop();
    sharedLoop = null;
  }
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    if (reduceMotion) return;
    retainPulse();
    return releasePulse;
  }, [reduceMotion]);

  const pulse = reduceMotion ? 1 : sharedPulse;
  return (
    <Animated.View
      accessible={false}
      style={[styles.block, { backgroundColor: colors.surface, borderRadius: radius.sm, opacity: pulse }, style]}
    />
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
});
