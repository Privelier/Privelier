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
 *
 * UI (Ultra rebuild 2026-07-13): the date picker is the reusable
 * CalendarDateStrip ultra-component; time slots are grouped by part of day
 * (morning / afternoon / evening) to chunk choice (Hick's Law); and the
 * current selection is echoed above the Continue bar so the customer never
 * has to hold it in their head (recognition over recall). Behaviour, data
 * flow, and every testID are unchanged.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { radius, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { Notice } from '../../shared/components/Notice';
import type { AvailabilityRow } from '../../types';
import { listBarberAvailability, listBarberBusySlots } from '../availabilityData';
import { deriveAvailableSlots } from '../../shared/slots';
import CalendarDateStrip from '../components/CalendarDateStrip';
import { BookingStepIndicator } from '../components/BookingStepIndicator';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookingDateTime'>;

const LOOKAHEAD_DAYS = 14;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Ordered part-of-day buckets for grouping the time grid. */
const PERIODS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

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

/** Morning < 12:00 ≤ Afternoon < 17:00 ≤ Evening — by the slot's start hour. */
function periodOf(time: string): PeriodKey {
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** "Sat 19 Jul · 14:30" — reflected back above the Continue bar. */
function formatSelection(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return `${WEEKDAY_LABELS[parsed.getDay()]} ${d} ${SHORT_MONTHS[parsed.getMonth()]} · ${time.slice(0, 5)}`;
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

  const disabledDates = useMemo(
    () => new Set(dates.filter((date) => (slotsByDate.get(date) ?? []).length === 0)),
    [dates, slotsByDate]
  );

  const allEmpty = useMemo(
    () => !loading && !error && disabledDates.size === dates.length,
    [loading, error, disabledDates, dates]
  );

  const selectedSlots = useMemo(
    () => (selection.date ? (slotsByDate.get(selection.date) ?? []) : []),
    [selection.date, slotsByDate]
  );

  /** Selected date's slots split into ordered part-of-day groups (empty groups dropped). */
  const slotGroups = useMemo(() => {
    return PERIODS.map((period) => ({
      ...period,
      slots: selectedSlots.filter((time) => periodOf(time) === period.key),
    })).filter((group) => group.slots.length > 0);
  }, [selectedSlots]);

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
      <ScreenBackHeader
        onPress={() => navigation.goBack()}
        backTestID="customer-booking-datetime-back"
        right={<BookingStepIndicator current={1} />}
      />

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
          <Notice
            message={error}
            testID="customer-booking-datetime-error"
            variant="error"
            style={styles.noticeSpacing}
          />
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
            <CalendarDateStrip
              dates={dates}
              disabledDates={disabledDates}
              selectedDate={selection.date}
              onSelectDate={(date) => setSelection({ date, time: null })}
              testIDPrefix="customer-booking-datetime"
            />

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
                slotGroups.map((group) => (
                  <View key={group.key} style={styles.timeGroup}>
                    <Text style={[styles.periodLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                      {group.label}
                    </Text>
                    <View style={styles.slotGrid}>
                      {group.slots.map((time) => {
                        const active = selection.time === time;
                        return (
                          <Pressable
                            key={time}
                            onPress={() => setSelection((current) => ({ ...current, time }))}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={time.slice(0, 5)}
                            testID={`customer-booking-datetime-slot-${time}`}
                            style={({ pressed }) => [
                              styles.slotChip,
                              {
                                borderWidth: active ? 0 : 0.5,
                                borderColor: colors.border,
                                backgroundColor: active ? colors.accent : colors.surface,
                                opacity: pressed && !active ? pressOpacity.soft : 1,
                                transform: [{ scale: pressed && !active ? 0.97 : 1 }],
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
                  </View>
                ))
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
        {canContinue && selection.date && selection.time ? (
          <Text
            style={[styles.summary, { color: colors.textSecondary, fontFamily: fonts.body }]}
            testID="customer-booking-datetime-summary"
          >
            {formatSelection(selection.date, selection.time)}
          </Text>
        ) : null}
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!canContinue}
          testID="customer-booking-datetime-continue"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space.xl },
  heading: { fontSize: 24 },
  subheading: { fontSize: 13, marginTop: 6 },

  spinner: { marginTop: space['4xl'] },
  noticeSpacing: { marginTop: space.xl },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: space['3xl'] },
  hintText: { fontSize: 13, marginTop: space.base },

  sectionLabel: { fontSize: 12, letterSpacing: 0.2, marginTop: 28, marginBottom: 14 },
  timeLabel: { marginTop: space['2xl'] },

  timeGroup: { marginBottom: space.lg },
  periodLabel: { fontSize: 12, letterSpacing: 0.3, marginBottom: 10 },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: space.md, minWidth: 72, alignItems: 'center' },
  slotText: { fontSize: 14 },

  footer: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: space.lg, borderTopWidth: 0.5 },
  summary: { fontSize: 13, textAlign: 'center', marginBottom: space.md },
});
