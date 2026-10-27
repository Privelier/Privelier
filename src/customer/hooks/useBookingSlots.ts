/**
 * The bookable slots for one barber and service over a 14-day lookahead.
 *
 * On every focus (mount, and whenever the customer comes back from Location
 * or Confirm) it reads the barber's availability windows once, then busy
 * intervals for the whole lookahead in ONE get_barber_busy_slots_range read
 * (migration 0041), keeping the per-date RPC only as a fallback. Dates with
 * no candidate slot before bookings are subtracted skip the busy read
 * entirely (identical result, fewer round-trips).
 *
 * useFocusEffect (not a mount-only effect) is deliberate: after a booking
 * conflict on Confirm the customer is sent back here, and the stale
 * candidate list must be re-fetched rather than replayed. A selection
 * survives a refetch only if it is still valid. A per-date busy-read failure
 * greys out that one date ("unverified") instead of failing the screen;
 * only a failure to read the availability windows is a page-level error.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { deriveAvailableSlots, type BusySlot } from '../../shared/slots';
import { listBarberAvailability, listBarberBusySlots, listBarberBusySlotsRange, listBarberDaysOff } from '../availabilityData';

const LOOKAHEAD_DAYS = 14;

/** Ordered part-of-day buckets for grouping the time grid. */
const PERIODS = ['morning', 'afternoon', 'evening'] as const;
export type PeriodKey = (typeof PERIODS)[number];

interface Selection {
  date: string | null;
  time: string | null;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local (not UTC) 14-day lookahead, today inclusive. */
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

/** The earliest verified open slot in the lookahead, or null. */
function firstOpenSlot(
  dates: string[],
  slotsByDate: ReadonlyMap<string, string[]>,
  unverifiedDates: ReadonlySet<string>
): { date: string; time: string } | null {
  for (const date of dates) {
    if (unverifiedDates.has(date)) continue;
    const first = (slotsByDate.get(date) ?? [])[0];
    if (first) return { date, time: first };
  }
  return null;
}

export function useBookingSlots(barberId: string, durationMinutes: number) {
  const [dates] = useState<string[]>(() => buildLookaheadDates());
  const [slotsByDate, setSlotsByDate] = useState<Map<string, string[]>>(new Map());
  const [unverifiedDates, setUnverifiedDates] = useState<Set<string>>(new Set());
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
    const windows = availabilityResult.windows;

    // One range read for the whole lookahead (migration 0041). If it fails
    // (e.g. a backend without 0041), fall back to the per-date reads so a
    // single failure still only greys out the dates it affects.
    const [rangeResult, daysOff] = await Promise.all([
      listBarberBusySlotsRange(barberId, dates[0], dates[dates.length - 1]),
      listBarberDaysOff(barberId, dates[0], dates[dates.length - 1]),
    ]);
    const busyByDate = rangeResult.status === 'ok' ? rangeResult.byDate : null;

    const entries = await Promise.all(
      dates.map(async (date) => {
        // A barber's day off offers nothing, whatever the weekly hours say; a
        // date with no candidate before bookings cannot gain one from the busy
        // list, so it skips its network round-trip.
        if (daysOff?.has(date)) return [date, [] as string[]] as const;
        const candidates = deriveAvailableSlots({ windows, busy: [], date, durationMinutes });
        if (candidates.length === 0) return [date, [] as string[]] as const;
        let busy: BusySlot[];
        if (busyByDate) {
          busy = busyByDate.get(date) ?? [];
        } else {
          const busyResult = await listBarberBusySlots(barberId, date);
          if (busyResult.status !== 'ok') return [date, null] as const;
          busy = busyResult.busy;
        }
        return [date, deriveAvailableSlots({ windows, busy, date, durationMinutes })] as const;
      })
    );

    const failedDates = new Set(entries.filter(([, slots]) => slots === null).map(([date]) => date));
    const map = new Map(entries.map(([date, slots]) => [date, slots ?? []]));
    setUnverifiedDates(failedDates);
    setSlotsByDate(map);
    setSelection((current) => {
      if (!current.date) return current;
      const freshSlots = map.get(current.date) ?? [];
      if (freshSlots.length === 0) return { date: null, time: null };
      if (current.time && !freshSlots.includes(current.time)) return { date: current.date, time: null };
      return current;
    });
    setLoading(false);
  }, [barberId, dates, durationMinutes]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Real slot counts drive the strip's density dots and the shortcut to the
  // earliest open time; nothing is shown until availability has loaded.
  const slotCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const date of dates) {
      if (!unverifiedDates.has(date)) map.set(date, (slotsByDate.get(date) ?? []).length);
    }
    return map;
  }, [dates, slotsByDate, unverifiedDates]);

  const nextAvailable = useMemo(
    () => (loading ? null : firstOpenSlot(dates, slotsByDate, unverifiedDates)),
    [loading, dates, slotsByDate, unverifiedDates]
  );

  const disabledDates = useMemo(
    () => new Set(dates.filter((date) => unverifiedDates.has(date) || (slotsByDate.get(date) ?? []).length === 0)),
    [dates, slotsByDate, unverifiedDates]
  );

  const selectedSlots = useMemo(
    () => (selection.date ? (slotsByDate.get(selection.date) ?? []) : []),
    [selection.date, slotsByDate]
  );

  /** Selected date's slots split into ordered part-of-day groups (empty groups dropped). */
  const slotGroups = useMemo(
    () => PERIODS.map((key) => ({ key, slots: selectedSlots.filter((time) => periodOf(time) === key) })).filter((group) => group.slots.length > 0),
    [selectedSlots]
  );

  return {
    dates,
    hasData: slotsByDate.size > 0,
    unverifiedDates,
    loading,
    error,
    load,
    selection,
    setSelection,
    slotCounts,
    nextAvailable,
    disabledDates,
    allEmpty: !loading && !error && disabledDates.size === dates.length,
    selectedSlots,
    slotGroups,
    canContinue: !!selection.date && !!selection.time && !loading && !error && !unverifiedDates.has(selection.date),
  };
}
