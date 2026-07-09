/**
 * Slot-derivation for the customer booking flow (build-order step 11-12).
 * Pure — no Supabase imports, no I/O — so it can be unit-tested with fixed
 * inputs. Algorithm is locked by design review (see
 * docs/design/step-11-12-booking-flow-design-approval.md, Decision 1); do
 * not redesign it here.
 */
import type { AvailabilityRow } from '../types';

/** One of a barber's existing pending/accepted bookings for a given date,
 * already scoped by the caller (see src/customer/availabilityData.ts). */
export interface BusySlot {
  startTime: string; // 'HH:MM:SS'
  durationMinutes: number;
}

/** Normalize a Postgres TIME string ('HH:MM:SS' or with fractional seconds)
 * to minutes since midnight. */
function toMinutes(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** Format minutes-since-midnight back to a zero-padded 'HH:MM:SS' string. */
function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}:00`;
}

export function deriveAvailableSlots(params: {
  windows: AvailabilityRow[];
  busy: BusySlot[];
  date: string;
  durationMinutes: number;
  now?: Date;
}): string[] {
  const { windows, busy, date, durationMinutes } = params;
  const now = params.now ?? new Date();

  // Step 1: local (not UTC) weekday resolution.
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();

  // Step 2: specific_date rows fully override day_of_week rows for that date.
  const specific = windows.filter((w) => w.specific_date === date);
  const applicable = specific.length > 0 ? specific : windows.filter((w) => w.day_of_week === weekday);

  // Step 3: candidate generation, back-to-back, no partial slots at the end.
  const candidateMinutes = new Set<number>();
  for (const window of applicable) {
    const windowStart = toMinutes(window.start_time);
    const windowEnd = toMinutes(window.end_time);
    let t = windowStart;
    while (t + durationMinutes <= windowEnd) {
      candidateMinutes.add(t);
      t += durationMinutes;
    }
  }

  // Step 4: conflict subtraction (half-open interval overlap, in minutes).
  const busyIntervals = busy.map((b) => {
    const start = toMinutes(b.startTime);
    return { start, end: start + b.durationMinutes };
  });
  let remaining = [...candidateMinutes].filter((c) => {
    const candidateStart = c;
    const candidateEnd = c + durationMinutes;
    return !busyIntervals.some(
      (b) => candidateStart < b.end && b.start < candidateEnd
    );
  });

  // Step 5: past-time filtering — today only.
  const nowLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  if (date === nowLocalDate) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    remaining = remaining.filter((c) => c > nowMinutes);
  }

  return remaining.sort((a, b) => a - b).map(toTimeString);
}
