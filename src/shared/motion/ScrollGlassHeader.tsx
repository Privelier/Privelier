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
 * Speed choices: live blur only on iOS (GlassSurface "floating"); Android
 * uses the translucent glass fill, because real-time blur over scrolling
 * content is its most expensive effect. The bar is non-interactive (pointerEvents="none"), so controls
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
import { GlassSurface } from '../components/GlassSurface';

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
      style={[styles.bar, animatedStyle]}
    >
      <GlassSurface variant="floating" style={styles.glass}>
        <SafeAreaView edges={['top']} style={styles.inner}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {title}
          </Text>
        </SafeAreaView>
      </GlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  glass: { borderRadius: 0, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: HAIRLINE },
  inner: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md, paddingHorizontal: space.xl },
  title: { fontSize: 17, lineHeight: 22 },
});
