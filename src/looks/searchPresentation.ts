/**
 * Look search (S4) and wish (S5) presentation rules: the bookable days to
 * pick from, the time windows offered, how a match or offer reads and where
 * a wish stands. The server re-validates the window (same day, at most
 * twelve hours, not in the past).
 */
import { formatBookingWhen, formatMessageTime } from '../shared/format';
import type { LookMatch, LookWish } from './types';

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

/** The one-line proof summary on a match or offer card. */
export function matchProofLine(match: Pick<LookMatch, 'hit_rate' | 'feedback_count' | 'proof_count'>, styleLabel: string, de: boolean): string {
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

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clockOf = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;

/**
 * The starts a barber can offer in a wish's window: every `step` minutes
 * from the window start, so the service still ends inside the window (the
 * server checks the same rule and the barber's free time).
 */
export function offerStarts(windowFrom: string, windowTo: string, durationMinutes: number, step = 15): string[] {
  const starts: string[] = [];
  for (let at = minutesOf(windowFrom); at + durationMinutes <= minutesOf(windowTo); at += step) starts.push(clockOf(at));
  return starts;
}

/** "Fri 30 Oct · 18:00 to 21:00": a wish's day and window. */
export function wishWindowLine(wish: Pick<LookWish, 'day' | 'window_from' | 'window_to'>, de: boolean): string {
  return `${formatBookingWhen(wish.day, wish.window_from)} ${de ? 'bis' : 'to'} ${shortTime(wish.window_to)}`;
}

/** Where a wish stands. Offers already made stay bookable after expiry. */
export function wishStatusLine(wish: Pick<LookWish, 'status' | 'expires_at'>, de: boolean, now: Date = new Date()): string {
  if (wish.status === 'booked') return de ? 'Gebucht. Der Termin steht unter Termine.' : 'Booked. Find it under Bookings.';
  if (wish.status === 'cancelled') return de ? 'Zurückgenommen' : 'Withdrawn';
  if (new Date(wish.expires_at) <= now) return de ? 'Keine neuen Angebote mehr' : 'No new offers';
  const until = formatMessageTime(wish.expires_at, now);
  return de ? `Offen für Angebote bis ${until}` : `Open for offers until ${until}`;
}
