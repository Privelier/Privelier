/**
 * Read side of barber_stats (migration 0050), computed nightly by
 * tools/automation/compute_barber_stats.py. The app never computes these —
 * it only reads one aggregate row per barber and turns it into copy.
 *
 * Every read is best effort: a missing row, a failed read, or too little
 * data simply hides the component (the Python job already withholds stats
 * below its sample thresholds), so nothing here can block a screen.
 */
import { supabase } from '../../lib/supabase';
import { devWarn } from './devLog';

export type PopularGrid = number[][]; // [weekday 0=Mon][hour 0..23], 0..1

export interface BarberStatsRow {
  barber_id: string;
  median_response_minutes: number | null;
  response_samples: number;
  popular_hours: PopularGrid | null;
  popular_samples: number;
  completed_count: number;
  repeat_client_rate: number | null;
  computed_at: string;
}

export async function fetchBarberStats(barberIds: string[]): Promise<Map<string, BarberStatsRow>> {
  const out = new Map<string, BarberStatsRow>();
  if (barberIds.length === 0) return out;
  try {
    const { data, error } = await supabase.from('barber_stats').select('*').in('barber_id', barberIds);
    if (error) {
      devWarn('[barberStats]', error);
      return out;
    }
    for (const row of (data ?? []) as BarberStatsRow[]) out.set(row.barber_id, row);
  } catch (raw) {
    // Decorative data must never reject the screen load it rides along with.
    devWarn('[barberStats]', raw);
  }
  return out;
}

/** "Usually replies in ~15 min" / "within 2 h" / null when unknown. */
export function responseCopy(minutes: number | null | undefined, de: boolean): string | null {
  if (minutes == null) return null;
  if (minutes <= 60) {
    // Exact under 15 min ("~12" is truer than "~10"); calmer 5-min steps above.
    const rounded = minutes < 15 ? Math.max(1, minutes) : Math.round(minutes / 5) * 5;
    return de ? `Antwortet meist in ~${rounded} Min.` : `Usually replies in ~${rounded} min`;
  }
  if (minutes <= 24 * 60) {
    const hours = Math.ceil(minutes / 60);
    return de ? `Antwortet meist innerhalb von ${hours} Std.` : `Usually replies within ${hours} h`;
  }
  return de ? 'Antwortet meist innerhalb eines Tages' : 'Usually replies within a day';
}

/** Fast responders (<= 30 min) earn the brass treatment. */
export function isFastResponder(minutes: number | null | undefined): boolean {
  return minutes != null && minutes <= 30;
}

/** JS getDay() (0 = Sunday) → grid row (0 = Monday). */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** The busiest contiguous window of a day: start..end hours where demand >= 70% of that day's peak. */
export function busiestWindow(grid: PopularGrid): { day: number; start: number; end: number } | null {
  let best: { day: number; start: number; end: number } | null = null;
  let bestPeak = 0;
  for (let day = 0; day < grid.length; day++) {
    const hours = grid[day];
    const peak = Math.max(...hours);
    if (peak <= bestPeak) continue;
    const peakHour = hours.indexOf(peak);
    let start = peakHour;
    let end = peakHour;
    while (start > 0 && hours[start - 1] >= 0.7 * peak) start -= 1;
    while (end < 23 && hours[end + 1] >= 0.7 * peak) end += 1;
    best = { day, start, end: end + 1 };
    bestPeak = peak;
  }
  return best;
}

/** Live hint for the current hour, used under the chart. */
export function busyNow(grid: PopularGrid, now: Date): 'quiet' | 'moderate' | 'busy' {
  const value = grid[weekdayIndex(now)]?.[now.getHours()] ?? 0;
  return value >= 0.66 ? 'busy' : value >= 0.33 ? 'moderate' : 'quiet';
}

export const WEEKDAYS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
} as const;
