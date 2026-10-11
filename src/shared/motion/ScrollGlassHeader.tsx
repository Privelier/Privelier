/**
 * Scroll-linked glass title bar.
 *
 * As a screen's own large heading scrolls away, a compact frosted bar with
 * the same title fades in under the status bar, so the user always knows
 * where they are. Everything is driven on the UI thread:
 * - `useScrollGlass` returns a Reanimated scroll handler; the offset lives in
 *   a shared value, so scrolling never causes a React render.
 * - The bar's opacity and 6px settle are interpolated in a worklet.
 *
 * Speed choices: no live blur. Real-time blur over moving content is the
 * single most expensive effect on Android, so the bar uses the brand's
 * translucent glass fill and hairline instead (the tab bars keep the only
 * real blur). The bar is non-interactive (pointerEvents="none"), so controls
 * underneath stay tappable at every scroll position.
 *
 * Reduce Motion: the bar still appears (it carries the title) but without
 * the vertical settle.
 */
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, space } from '../../theme/spacing';
import { useReducedMotionPreference } from './useReducedMotionPreference';

/** Scroll distance over which the bar fades in, after `start`. */
const FADE_DISTANCE = 32;

export function useScrollGlass() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  return { scrollY, onScroll };
}

type Props = {
  title: string;
  scrollY: SharedValue<number>;
  /** Offset at which the screen's own heading has scrolled out of view. */
  start?: number;
  testID?: string;
};

export function ScrollGlassHeader({ title, scrollY, start = 56, testID }: Props) {
  const { colors, fonts } = useTheme();
  const reduceMotion = useReducedMotionPreference();

  const animatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.value, [start, start + FADE_DISTANCE], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: [{ translateY: reduceMotion ? 0 : (1 - progress) * -6 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.bar,
        {
          backgroundColor: 'rgba(13,13,15,0.86)',
          borderBottomColor: 'rgba(191,160,107,0.30)',
        },
        animatedStyle,
      ]}
    >
      <SafeAreaView edges={['top']} style={styles.inner}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {title}
        </Text>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: space.md,
    paddingHorizontal: space.xl,
    borderBottomWidth: HAIRLINE,
  },
  inner: { alignItems: 'center', paddingTop: space.sm },
  title: { fontSize: 17, lineHeight: 22 },
});
