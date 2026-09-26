import { useEffect } from 'react';
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
      style={[{ minHeight: 44 }, props.style]}
      onPress={(event) => {
        if (!props.accessibilityState?.selected) void haptics.selection();
        props.onPress?.(event);
      }}
    />
  );
}

export function BrassTabIcon({ name, color, focused }: { name: keyof typeof Feather.glyphMap; color: string; focused: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(focused ? 1 : 0, {
      duration: reduceMotion ? duration.fast : duration.base,
      easing: easing.standard,
      reduceMotion: ReduceMotion.Never,
    }));
  }, [focused, progress, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scaleX: reduceMotion ? 1 : progress.get() }],
  }));

  return (
    <View style={styles.iconGroup}>
      <Feather name={name} size={20} color={color} />
      <Animated.View
        testID={`tab-indicator-${name}`}
        style={[styles.indicator, { backgroundColor: colors.accent }, indicatorStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconGroup: { alignItems: 'center', justifyContent: 'center', width: 28, height: 28 },
  indicator: { position: 'absolute', bottom: 0, height: 2, width: 18, borderRadius: 1 },
});
