/**
 * Booking flow — screen 1 of 3: pick a date, then a time.
 *
 * On every focus (mount, and any time this screen regains focus after the
 * customer navigates back from Location/Confirm — see the focus-effect note
 * below), fetches the barber's full availability window set once, then
 * — per the design doc's Decision 4 cost note
 * (docs/design/step-11-12-booking-flow-design-approval.md) — fetches busy
 * slots for each of the 14-day lookahead and runs deriveAvailableSlots for
 * every one of them up front. This is an intentional, pre-approved
 * up-to-14-RPC-call tradeoff at MVP scale, not something to batch/optimize
 * away here. Every date in the lookahead is always shown; a date whose
 * computed candidate list is empty is visually disabled, never hidden.
 *
 * useFocusEffect (not a mount-only effect) is deliberate: it is what makes
 * "sent back to BookingDateTimeScreen" after a booking conflict on the
 * Confirm screen (see BookingConfirmScreen's onPickAnotherTime) actually
 * useful — the busy-slot fetch that produced the now-stale candidate list is
 * re-run rather than silently replayed. The existing selection is preserved
 * across a refetch only if it is still valid against the fresh data, so a
 * slot someone else just took quietly disappears instead of staying
 * selectable. A per-date busy-slot fetch failure degrades that one date to
 * "no slots" rather than failing the whole screen (a transient blip on one
 * of 14 calls should not block booking via the other 13 dates); only a
 * failure of the single listBarberAvailability call surfaces as the
 * page-level error notice.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import type { AvailabilityRow } from '../../types';
import { listBarberAvailability, listBarberBusySlots } from '../availabilityData';
import { deriveAvailableSlots } from '../../shared/slots';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookingDateTime'>;

const LOOKAHEAD_DAYS = 14;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface Selection {
  date: string | null;
  time: string | null;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local (not UTC) 14-day lookahead, today inclusive — see module header. */
function buildLookaheadDates(now: Date = new Date()): string[] {
  const dates: string[] = [];
  for (let i = 0; i < LOOKAHEAD_DAYS; i += 1) {
    dates.push(toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)));
  }
  return dates;
}

/** Local (not UTC) weekday label — same parsing rule as deriveAvailableSlots. */
function dayLabel(date: string): { weekday: string; day: string } {
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return { weekday: WEEKDAY_LABELS[parsed.getDay()], day: String(parsed.getDate()) };
}

export default function BookingDateTimeScreen({ route, navigation }: Props) {
  const { barberId, barberName, service } = route.params;
  const { colors, fonts } = useTheme();

  const [dates] = useState<string[]>(() => buildLookaheadDates());
  const [slotsByDate, setSlotsByDate] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ date: null, time: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const availabilityResult = await listBarberAvailability(barberId);
    if (availabilityResult.status !== 'ok') {
      setLoading(false);
      setError(availabilityResult.message);
      return;
    }
    const windows: AvailabilityRow[] = availabilityResult.windows;

    const entries = await Promise.all(
      dates.map(async (date) => {
        const busyResult = await listBarberBusySlots(barberId, date);
        const busy = busyResult.status === 'ok' ? busyResult.busy : [];
        const slots = deriveAvailableSlots({
          windows,
          busy,
          date,
          durationMinutes: service.duration_minutes,
        });
        return [date, slots] as const;
      })
    );

    const map = new Map(entries);
    setSlotsByDate(map);
    setSelection((current) => {
      if (!current.date) return current;
      const freshSlots = map.get(current.date) ?? [];
      if (freshSlots.length === 0) return { date: null, time: null };
      if (current.time && !freshSlots.includes(current.time)) return { date: current.date, time: null };
      return current;
    });
    setLoading(false);
  }, [barberId, dates, service.duration_minutes]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const allEmpty = useMemo(
    () => !loading && !error && dates.every((date) => (slotsByDate.get(date) ?? []).length === 0),
    [loading, error, dates, slotsByDate]
  );

  const selectedSlots = selection.date ? (slotsByDate.get(selection.date) ?? []) : [];
  const canContinue = !!selection.date && !!selection.time;

  const onContinue = useCallback(() => {
    if (!selection.date || !selection.time) return;
    navigation.navigate('BookingLocation', {
      barberId,
      barberName,
      service,
      date: selection.date,
      time: selection.time,
    });
  }, [navigation, barberId, barberName, service, selection]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-booking-datetime-screen"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          testID="customer-booking-datetime-back"
          style={[styles.backButton, { backgroundColor: colors.surface }]}
        >
          <Feather name="arrow-left" size={16} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.stepIndicator}>
          <View style={styles.stepDots}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[styles.stepDot, { backgroundColor: n <= 1 ? colors.accent : colors.border }]}
              />
            ))}
          </View>
          <Text style={[styles.step, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            Step 1 of 3
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Choose a date and time
        </Text>
        <Text style={[styles.subheading, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {`${service.name} with ${barberName}`}
        </Text>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="customer-booking-datetime-loading"
          />
        ) : error ? (
          <View
            testID="customer-booking-datetime-error"
            accessibilityRole="alert"
            style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
              {error}
            </Text>
          </View>
        ) : allEmpty ? (
          <Text
            style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
            testID="customer-booking-datetime-empty"
          >
            No upcoming availability. Check back soon.
          </Text>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
              Date
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayStrip}
            >
              {dates.map((date, index) => {
                const slots = slotsByDate.get(date) ?? [];
                const disabled = slots.length === 0;
                const active = selection.date === date;
                const { weekday, day } = dayLabel(date);
                return (
                  <Pressable
                    key={date}
                    disabled={disabled}
                    onPress={() => setSelection({ date, time: null })}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected: active }}
                    accessibilityLabel={`${weekday} ${day}`}
                    testID={`customer-booking-datetime-day-${index}`}
                    style={[
                      styles.dayChip,
                      {
                        borderColor: active ? colors.accent : 'transparent',
                        borderWidth: active ? 1 : 0,
                        backgroundColor: active ? colors.accent : 'transparent',
                        opacity: disabled ? 0.35 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayWeekday,
                        { color: active ? colors.onAccent : colors.textSecondary, fontFamily: fonts.body },
                      ]}
                    >
                      {weekday}
                    </Text>
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: active ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodySemiBold },
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.sectionLabel, styles.timeLabel, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
              Time
            </Text>
            {selection.date ? (
              selectedSlots.length === 0 ? (
                <Text
                  style={[styles.hintText, { color: colors.textSecondary, fontFamily: fonts.body }]}
                  testID="customer-booking-datetime-no-times"
                >
                  No times left on this date.
                </Text>
              ) : (
                <View style={styles.slotGrid}>
                  {selectedSlots.map((time) => {
                    const active = selection.time === time;
                    return (
                      <Pressable
                        key={time}
                        onPress={() => setSelection((current) => ({ ...current, time }))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        testID={`customer-booking-datetime-slot-${time}`}
                        style={[
                          styles.slotChip,
                          {
                            borderWidth: active ? 0 : 0.5,
                            borderColor: colors.border,
                            backgroundColor: active ? colors.accent : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotText,
                            { color: active ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodyMedium },
                          ]}
                        >
                          {time.slice(0, 5)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )
            ) : (
              <Text style={[styles.hintText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Pick a date to see available times.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={onContinue}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !canContinue }}
          testID="customer-booking-datetime-continue"
          style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: canContinue ? 1 : 0.5 }]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDots: { flexDirection: 'row', gap: 4 },
  stepDot: { width: 12, height: 3, borderRadius: 2 },
  step: { fontSize: 12, letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  heading: { fontSize: 24 },
  subheading: { fontSize: 13, marginTop: 6 },

  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginTop: 24 },
  noticeText: { fontSize: 14, lineHeight: 20 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 40 },
  hintText: { fontSize: 13, marginTop: 16 },

  sectionLabel: { fontSize: 12, letterSpacing: 0.2, marginTop: 28, marginBottom: 12 },
  timeLabel: { marginTop: 28 },

  dayStrip: { gap: 18, paddingBottom: 4 },
  dayChip: {
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 22,
    alignItems: 'center',
    gap: 4,
  },
  dayWeekday: { fontSize: 11, letterSpacing: 0.3 },
  dayNumber: { fontSize: 17 },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slotChip: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11 },
  slotText: { fontSize: 14 },

  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, borderTopWidth: 0.5 },
  primaryButton: { borderRadius: 10, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 16 },
});
