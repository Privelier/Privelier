/**
 * Pressable with the house press feel: a quick spring to 0.97 on touch-down
 * and back on release (usePressFeedback, UI-thread via Reanimated), plus an
 * optional selection haptic. Drop-in for `Pressable` wherever a whole card
 * or tile is the touch target — it reads as physical and responsive where a
 * plain opacity dip reads as a web link.
 *
 * Reduced motion: usePressFeedback swaps the scale for a gentle opacity fade.
 */
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { haptics } from '../haptics';
import { usePressFeedback } from './usePressFeedback';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Fire a light selection haptic on press. */
  haptic?: boolean;
};

export function PressableScale({ style, children, haptic = false, onPressIn, onPressOut, onPress, disabled, ...rest }: Props) {
  const feedback = usePressFeedback({ disabled: !!disabled });
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        feedback.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        feedback.onPressOut();
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) void haptics.selection();
        onPress?.(event);
      }}
    >
      <Animated.View style={[style, feedback.animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
