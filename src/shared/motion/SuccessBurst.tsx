/**
 * The success moment: a brass ring draws itself, the check strokes in, the
 * mark settles with a soft spring, and eight small sparks radiate once and
 * fade. ~900 ms, then still — celebratory without being loud, and only used
 * where the user just did something that matters (booking sent, review
 * posted, request accepted).
 *
 * Everything runs on the UI thread (Reanimated animated props on SVG).
 * Reduced motion: the finished mark appears without any movement.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../theme/useTheme';
import { spring } from '../../theme/motion';
import { useReducedMotionPreference } from './useReducedMotionPreference';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 88;
const R = 38;
const RING = 2 * Math.PI * R;
const CHECK = 'M28 45 L39.5 56.5 L61 34';
const CHECK_LENGTH = 47;
const SPARKS = 8;

export function SuccessBurst({ size = SIZE, testID }: { size?: number; testID?: string }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const ring = useSharedValue(reduceMotion ? 1 : 0);
  const check = useSharedValue(reduceMotion ? 1 : 0);
  const settle = useSharedValue(reduceMotion ? 1 : 0.86);
  const burst = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const timing = (ms: number) => ({ duration: ms, easing: Easing.bezier(0.2, 0, 0, 1), reduceMotion: ReduceMotion.System });
    ring.set(withTiming(1, timing(420)));
    check.set(withDelay(260, withTiming(1, timing(320))));
    settle.set(withDelay(200, withSpring(1, spring.gentle)));
    burst.set(withDelay(380, withTiming(1, timing(620))));
  }, [reduceMotion, ring, check, settle, burst]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING * (1 - ring.get()) }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - check.get()) }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: settle.get() }] }));

  return (
    <View style={{ width: size * 1.7, height: size * 1.7, alignItems: 'center', justifyContent: 'center' }} testID={testID} accessible={false}>
      {Array.from({ length: SPARKS }, (_, i) => (
        <Spark key={i} index={i} progress={burst} radius={size * 0.78} color={i % 2 ? colors.accent : colors.textPrimary} />
      ))}
      <Animated.View style={markStyle}>
        <Svg width={size} height={size} viewBox="0 0 88 88">
          <Circle cx={44} cy={44} r={R} stroke={colors.border} strokeWidth={1.5} fill="none" />
          <AnimatedCircle
            cx={44}
            cy={44}
            r={R}
            stroke={colors.accent}
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={RING}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            animatedProps={ringProps}
          />
          <AnimatedPath
            d={CHECK}
            stroke={colors.accent}
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Spark({ index, progress, radius, color }: { index: number; progress: SharedValue<number>; radius: number; color: string }) {
  const angle = (index / SPARKS) * 2 * Math.PI - Math.PI / 2;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const travel = 0.55 + 0.45 * p;
    return {
      opacity: p <= 0 || p >= 1 ? 0 : p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7,
      transform: [
        { translateX: Math.cos(angle) * radius * travel },
        { translateY: Math.sin(angle) * radius * travel },
        { scale: 1 - 0.5 * p },
      ],
    };
  });
  return <Animated.View style={[styles.spark, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  spark: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
});
