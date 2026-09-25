import { Easing, ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

/** Calm motion primitives shared by both apps. Durations are milliseconds. */
export const duration = {
  instant: 0,
  fast: 120,
  base: 180,
  slow: 240,
} as const;

/** Worklet-safe curves for Reanimated timing transitions. */
export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  enter: Easing.bezier(0, 0, 0, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
} as const;

/** Restrained, clamped springs: responsive without overshoot or bounce. */
export const spring = {
  press: {
    damping: 28,
    stiffness: 500,
    mass: 0.7,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  },
  responsive: {
    damping: 32,
    stiffness: 360,
    mass: 0.9,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  },
  gentle: {
    damping: 34,
    stiffness: 240,
    mass: 1,
    overshootClamping: true,
    reduceMotion: ReduceMotion.System,
  },
} as const satisfies Record<string, WithSpringConfig>;

export const pressScale = 0.97;

/** Existing opacity values stay public for non-animated Pressables. */
export const pressOpacity = {
  soft: 0.85,
  firm: 0.7,
} as const;

/** Reduced Motion keeps feedback non-spatial and brief. */
export const reducedMotion = {
  pressOpacity: pressOpacity.soft,
  fadeDuration: duration.fast,
} as const;

export type Duration = keyof typeof duration;
