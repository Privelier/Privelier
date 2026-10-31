/**
 * "Popular times" — when this barber is usually booked, from the nightly
 * Python stats (barber_stats.popular_hours, smoothed and shrunk toward the
 * market so sparse data never shows a false spike).
 *
 * A day picker (today preselected) over hour bars that spring up in a quick
 * left-to-right stagger whenever the day changes; the current hour is brass
 * on today's chart, and one plain sentence translates it ("Usually quiet
 * right now — a good time to book"). Bars are relative demand, never counts.
 *
 * Accessibility: each day is a selectable button; the chart itself is one
 * element whose label states the busiest window in words.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../../theme/useTheme';
import { spring } from '../../../theme/motion';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { getAppLanguage } from '../../locale';
import { haptics } from '../../haptics';
import { useReducedMotionPreference } from '../../motion/useReducedMotionPreference';
import { busyNow, weekdayIndex, WEEKDAYS, type PopularGrid } from '../../barberStats';

const CHART_H = 72;

/** Hours worth drawing: where any day has meaningful demand, padded, within 6–23. */
export function visibleHours(grid: PopularGrid): [number, number] {
  let first = 23;
  let last = 0;
  for (const day of grid) {
    day.forEach((v, h) => {
      if (v >= 0.08) {
        first = Math.min(first, h);
        last = Math.max(last, h);
      }
    });
  }
  if (first > last) return [9, 20];
  return [Math.max(6, first - 1), Math.min(23, last + 1)];
}

/** '2 pm' / '14 Uhr' for sentences. */
export const clockLabel = (h: number, de: boolean) => (de ? `${h} Uhr` : `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`);
const hourLabel = (h: number, de: boolean) => (de ? `${h}` : h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`);

export function PopularTimesChart({ grid, now = new Date(), testID }: { grid: PopularGrid; now?: Date; testID?: string }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const today = weekdayIndex(now);
  const [day, setDay] = useState(today);
  const [from, to] = useMemo(() => visibleHours(grid), [grid]);
  const hours = useMemo(() => Array.from({ length: to - from + 1 }, (_, i) => from + i), [from, to]);
  const values = grid[day] ?? [];
  const isToday = day === today;
  const names = de ? WEEKDAYS.de : WEEKDAYS.en;

  const peakHour = values.indexOf(Math.max(...values));
  const hint = isToday
    ? {
        quiet: de ? 'Gerade meist ruhig — ein guter Moment zum Buchen.' : 'Usually quiet right now — a good time to book.',
        moderate: de ? 'Gerade meist etwas gefragt.' : 'Usually a little busy right now.',
        busy: de ? 'Gerade meist sehr gefragt — buche früh.' : 'Usually busy right now — book early.',
      }[busyNow(grid, now)]
    : de
      ? `Am gefragtesten gegen ${clockLabel(peakHour, true)}.`
      : `Busiest around ${clockLabel(peakHour, false)}.`;

  return (
    <View testID={testID}>
      <View style={styles.days} accessibilityRole="tablist">
        {names.map((name, index) => {
          const selected = index === day;
          return (
            <Pressable
              key={name}
              onPress={() => {
                if (index === day) return;
                void haptics.selection();
                setDay(index);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={name}
              // 32pt tall + 6pt above and below = a 44pt target.
              hitSlop={6}
              testID={testID ? `${testID}-day-${index}` : undefined}
              style={[styles.day, { borderColor: selected ? colors.accent : 'transparent' }]}
            >
              <Text style={[styles.dayText, { color: selected ? colors.accentText : colors.textSecondary, fontFamily: selected ? fonts.bodySemiBold : fonts.body }]}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.chart} accessible accessibilityLabel={hint}>
        {hours.map((h, i) => (
          <Bar
            key={`${day}-${h}`}
            value={values[h] ?? 0}
            index={i}
            highlight={isToday && h === now.getHours()}
          />
        ))}
      </View>
      <View style={[styles.axis, { borderTopColor: colors.border }]}>
        {hours.map((h) => (
          <Text key={h} style={[styles.axisText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {(h - from) % 3 === 0 ? hourLabel(h, de) : ''}
          </Text>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]}>{hint}</Text>
    </View>
  );
}

function Bar({ value, index, highlight }: { value: number; index: number; highlight: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const target = Math.max(3, value * CHART_H);
  const height = useSharedValue(reduceMotion ? target : 3);
  useEffect(() => {
    height.set(reduceMotion ? target : withDelay(index * 18, withSpring(target, spring.responsive)));
  }, [height, target, index, reduceMotion]);
  const style = useAnimatedStyle(() => ({ height: height.get() }));
  return (
    <View style={styles.barSlot}>
      <Animated.View
        style={[
          styles.bar,
          { backgroundColor: highlight ? colors.accent : value >= 0.66 ? 'rgba(245,241,232,0.42)' : 'rgba(245,241,232,0.2)' },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md },
  day: { minWidth: 36, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1.5 },
  dayText: { fontSize: 13 },
  chart: { height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barSlot: { flex: 1, height: CHART_H, justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs },
  axis: { flexDirection: 'row', gap: 3, borderTopWidth: HAIRLINE, paddingTop: 4 },
  axisText: { flex: 1, fontSize: 10, textAlign: 'left' },
  hint: { fontSize: 13, lineHeight: 19, marginTop: space.sm },
});
