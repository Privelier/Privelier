/**
 * A glass segmented control: a neutral glass track with a brass glass thumb
 * that glides to the selected segment on the UI thread. Each segment is a
 * real tab for screen readers (role, selected state); Reduce Motion moves
 * the thumb with a short step instead of a glide.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, easing } from '../../theme/motion';
import { useTheme } from '../../theme/useTheme';
import { haptics } from '../haptics';
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference';
import { useGlassStyle } from './GlassSurface';

type Segment<K extends string> = { key: K; label: string; testID?: string };

type Props<K extends string> = {
  segments: readonly Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const INSET = 3;

export function GlassSegmentedControl<K extends string>({ segments, value, onChange, style, testID }: Props<K>) {
  const { colors, fonts } = useTheme();
  const track = useGlassStyle('neutral');
  const thumb = useGlassStyle('brass');
  const reduceMotion = useReducedMotionPreference();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((segment) => segment.key === value));
  const segmentWidth = width > 0 ? (width - INSET * 2) / segments.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth === 0) return;
    x.set(withTiming(index * segmentWidth, {
      duration: reduceMotion ? duration.fast : duration.slow,
      easing: easing.standard,
      reduceMotion: ReduceMotion.Never,
    }));
  }, [index, segmentWidth, reduceMotion, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, track, style]}
    >
      {segmentWidth > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.thumb, thumb, { width: segmentWidth }, thumbStyle]} />
      ) : null}
      {segments.map((segment) => {
        const selected = segment.key === value;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            testID={segment.testID}
            onPress={() => {
              if (selected) return;
              void haptics.selection();
              onChange(segment.key);
            }}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, { fontFamily: fonts.bodyMedium, color: selected ? colors.textPrimary : colors.textSecondary }]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 22, padding: INSET, overflow: 'hidden' },
  thumb: { position: 'absolute', top: INSET, bottom: INSET, left: INSET, borderRadius: 19 },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  label: { fontSize: 14 },
});
