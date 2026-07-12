/**
 * CalendarDateStrip — reusable, brand-faithful horizontal date picker.
 *
 * An "ultra component": theme-aware, accessible, and test-stable. It renders a
 * month-context label (a single month, or a "July – August 2026" range when the
 * lookahead crosses a boundary) above a horizontal strip of day chips. The first
 * date is marked "Today". Dates the caller marks disabled are shown dimmed and
 * unpressable — never hidden — so the customer always sees the full window.
 *
 * The caller owns the data and the testID contract; this component only owns the
 * look and the interaction. Day chips emit `${testIDPrefix}-day-${index}` to keep
 * the existing Maestro/house-test selectors intact.
 */
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Local (not UTC) parse — mirrors deriveAvailableSlots' date rule. */
function parseLocal(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function monthRangeLabel(dates: string[]): string {
  if (dates.length === 0) return '';
  const first = parseLocal(dates[0]);
  const last = parseLocal(dates[dates.length - 1]);
  const firstMonth = MONTH_LABELS[first.getMonth()];
  const lastMonth = MONTH_LABELS[last.getMonth()];
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    return `${firstMonth} ${first.getFullYear()}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${firstMonth} – ${lastMonth} ${last.getFullYear()}`;
  }
  return `${firstMonth} ${first.getFullYear()} – ${lastMonth} ${last.getFullYear()}`;
}

export interface CalendarDateStripProps {
  /** Ordered lookahead dates as `YYYY-MM-DD`; index 0 is treated as today. */
  dates: string[];
  /** Dates with no bookable slots — rendered dimmed and unpressable. */
  disabledDates: ReadonlySet<string>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  /** Prefix for the per-day testID: `${testIDPrefix}-day-${index}`. */
  testIDPrefix: string;
}

function CalendarDateStrip({
  dates,
  disabledDates,
  selectedDate,
  onSelectDate,
  testIDPrefix,
}: CalendarDateStripProps) {
  const { colors, fonts } = useTheme();
  const monthLabel = useMemo(() => monthRangeLabel(dates), [dates]);

  return (
    <View>
      <Text style={[styles.month, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {monthLabel}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {dates.map((date, index) => {
          const disabled = disabledDates.has(date);
          const active = selectedDate === date;
          const parsed = parseLocal(date);
          const weekday = index === 0 ? 'Today' : WEEKDAY_LABELS[parsed.getDay()];
          const day = String(parsed.getDate());
          return (
            <Pressable
              key={date}
              disabled={disabled}
              onPress={() => onSelectDate(date)}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: active }}
              accessibilityLabel={`${weekday} ${day}`}
              testID={`${testIDPrefix}-day-${index}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                  opacity: disabled ? 0.3 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed && !active ? 0.97 : 1 }],
                },
              ]}
            >
              <Text
                style={[
                  styles.weekday,
                  { color: active ? colors.onAccent : colors.textSecondary, fontFamily: fonts.bodyMedium },
                ]}
              >
                {weekday}
              </Text>
              <Text
                style={[
                  styles.day,
                  { color: active ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodySemiBold },
                ]}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default memo(CalendarDateStrip);

const styles = StyleSheet.create({
  month: { fontSize: 15, marginBottom: 14 },
  strip: { gap: 10, paddingBottom: 4, paddingRight: 8 },
  chip: {
    width: 60,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 0.5,
    alignItems: 'center',
    gap: 6,
  },
  weekday: { fontSize: 11, letterSpacing: 0.2 },
  day: { fontSize: 19 },
});
