import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, easing } from '../../theme/motion';
import { useTheme } from '../../theme/useTheme';
import { haptics } from '../haptics';
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference';

export function HapticTabButton(props: BottomTabBarButtonProps) {
  const { ref: _navigationRef, ...buttonProps } = props;
  return (
    <Pressable
      {...buttonProps}
      // No side padding: five tabs share ~74pt each, and the label needs all of it.
      style={[{ minHeight: 44 }, props.style, { paddingHorizontal: 0 }]}
      onPress={(event) => {
        if (!props.accessibilityState?.selected) void haptics.selection();
        props.onPress?.(event);
      }}
    />
  );
}

export function BrassTabIcon({ name, color }: { name: keyof typeof Feather.glyphMap; color: string; focused?: boolean }) {
  return (
    <View style={styles.iconGroup}>
      <Feather name={name} size={22} color={color} />
    </View>
  );
}

const INDICATOR_WIDTH = 24;

/** Left offset that centres the indicator over tab `index` of `count`. */
export function indicatorOffset(index: number, count: number, width: number): number {
  return (index + 0.5) * (width / count) - INDICATOR_WIDTH / 2;
}

/**
 * One brass indicator that travels along the top edge of the glass tab bar to
 * the selected tab. The position is a Reanimated shared value animated with
 * withTiming on the UI thread, so it stays smooth while the destination
 * screen mounts. Reduce Motion moves it with a quick fade-length step.
 */
export function SlidingTabIndicator({ index, count }: { index: number; count: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(-1);

  useEffect(() => {
    if (width === 0 || count === 0) return;
    const target = indicatorOffset(index, count, width);
    if (x.get() < 0) {
      x.set(target); // first layout: place without animating
      return;
    }
    x.set(withTiming(target, {
      duration: reduceMotion ? duration.fast : duration.slow,
      easing: easing.standard,
      reduceMotion: ReduceMotion.Never,
    }));
  }, [index, count, width, reduceMotion, x]);

  const style = useAnimatedStyle(() => ({
    opacity: x.get() < 0 ? 0 : 1,
    transform: [{ translateX: Math.max(x.get(), 0) }],
  }));

  return (
    <View
      pointerEvents="none"
      testID="tab-indicator-track"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View testID="tab-indicator" style={[styles.indicator, { backgroundColor: colors.accent }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconGroup: { alignItems: 'center', justifyContent: 'center', width: 28, height: 28 },
  indicator: { position: 'absolute', top: 0, left: 0, height: 2, width: INDICATOR_WIDTH, borderRadius: 1 },
});
