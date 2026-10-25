/**
 * Reveal — the shared section-entrance motion for both apps.
 *
 * Speed rules (non-negotiable):
 * - Runs as a Reanimated layout animation, so it is driven entirely on the UI
 *   thread; a busy JS thread cannot make it stutter, and it never delays a
 *   render or a tap (children are interactive from the first frame).
 * - Plays once, on mount. Re-renders and data refreshes never replay it.
 * - Stagger is capped (reveal.maxStaggerSteps), so the last section of a long
 *   screen starts within ~225 ms.
 * - Reduce Motion: the system setting skips the animation entirely.
 *
 * Use it for screen sections and the first few rows of a list, not for every
 * recycled list row.
 */
import type { PropsWithChildren } from 'react';
import { Platform, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { easing, reveal } from '../../theme/motion';

type Props = PropsWithChildren<{
  /** Position in the screen's reveal order; 0 starts immediately. */
  index?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function revealEntering(index = 0) {
  const step = Math.min(Math.max(index, 0), reveal.maxStaggerSteps);
  const base = FadeInDown.duration(reveal.duration)
    .delay(step * reveal.stagger)
    .easing(easing.enter)
    .reduceMotion(ReduceMotion.System);
  // Web: custom initial values turn the preset into a custom keyframe, and
  // Reanimated's web layout-animation code then pins the element with
  // position:absolute after it finishes (rows collapse onto each other).
  // The preset alone is safe there; native keeps the subtler 12px rise.
  return Platform.OS === 'web'
    ? base
    : base.withInitialValues({ opacity: 0, transform: [{ translateY: reveal.offset }] });
}

export function Reveal({ index = 0, style, testID, children }: Props) {
  return (
    <Animated.View entering={revealEntering(index)} style={style} testID={testID}>
      {children}
    </Animated.View>
  );
}

/**
 * List-row variant: the first screenful staggers in; rows mounted later
 * (scrolling, recycling) appear instantly, so long lists stay cheap.
 */
export function RevealItem({ index, style, testID, children }: Props & { index: number }) {
  if (index >= 8) return <View style={style} testID={testID}>{children}</View>;
  return <Reveal index={index} style={style} testID={testID}>{children}</Reveal>;
}
