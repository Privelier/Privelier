/**
 * Look search (S4) presentation rules: the bookable days to pick from, the
 * time windows offered, and how a match reads. The server re-validates the
 * window (same day, at most twelve hours, not in the past).
 */
import type { LookMatch } from './types';

export interface SearchWindow {
  key: 'morning' | 'midday' | 'afternoon' | 'evening';
  from: string;
  to: string;
  label_en: string;
  label_de: string;
}

export const SEARCH_WINDOWS: readonly SearchWindow[] = [
  { key: 'morning', from: '09:00:00', to: '12:00:00', label_en: 'Morning, 9 to 12', label_de: 'Morgens, 9 bis 12' },
  { key: 'midday', from: '12:00:00', to: '15:00:00', label_en: 'Midday, 12 to 3', label_de: 'Mittags, 12 bis 15' },
  { key: 'afternoon', from: '15:00:00', to: '18:00:00', label_en: 'Afternoon, 3 to 6', label_de: 'Nachmittags, 15 bis 18' },
  { key: 'evening', from: '18:00:00', to: '21:00:00', label_en: 'Evening, 6 to 9', label_de: 'Abends, 18 bis 21' },
];

const pad = (value: number) => String(value).padStart(2, '0');

/** The next `count` local calendar days as YYYY-MM-DD, today first. */
export function searchDays(count: number, now: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, offset) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  });
}

/** 'HH:MM:SS' to 'HH:MM'. */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}

/** The one-line proof summary on a match card. */
export function matchProofLine(match: LookMatch, styleLabel: string, de: boolean): string {
  if (match.hit_rate !== null) {
    const value = Math.round(match.hit_rate * 100);
    return de
      ? `${styleLabel}: ${value} % genau getroffen, ${match.feedback_count} Bewertungen`
      : `${styleLabel}: ${value}% exact, ${match.feedback_count} ratings`;
  }
  return de
    ? `${match.proof_count} bestätigte ${styleLabel}-Looks`
    : `${match.proof_count} confirmed ${styleLabel} looks`;
}
