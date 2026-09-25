import { useCallback } from 'react';
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { easing, pressScale, reducedMotion, spring } from '../../theme/motion';
import { useReducedMotionPreference } from './useReducedMotionPreference';

export function usePressFeedback({ disabled = false }: { disabled?: boolean } = {}) {
  const prefersReducedMotion = useReducedMotionPreference();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (disabled) return;

    if (prefersReducedMotion) {
      scale.set(1);
      opacity.set(
        withTiming(reducedMotion.pressOpacity, {
          duration: reducedMotion.fadeDuration,
          easing: easing.standard,
          reduceMotion: ReduceMotion.Never,
        })
      );
      return;
    }

    opacity.set(1);
    scale.set(withSpring(pressScale, spring.press));
  }, [disabled, opacity, prefersReducedMotion, scale]);

  const onPressOut = useCallback(() => {
    if (prefersReducedMotion) {
      scale.set(1);
      opacity.set(
        withTiming(1, {
          duration: reducedMotion.fadeDuration,
          easing: easing.standard,
          reduceMotion: ReduceMotion.Never,
        })
      );
      return;
    }

    opacity.set(1);
    scale.set(withSpring(1, spring.press));
  }, [opacity, prefersReducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
}
