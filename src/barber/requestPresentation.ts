/**
 * How the Requests tab groups and orders bookings, and when "On my way" is
 * offered. Pure functions so the rules are testable without rendering.
 */
import { getAppLanguage } from '../shared/locale';
import type { BookingRow } from '../types';

export type RequestSection = { key: 'needs-action' | 'today' | 'upcoming' | 'history'; title: string; data: BookingRow[] };

/** Requests read soonest first: sort by (date, time) ascending. */
export function sortAsc(rows: BookingRow[]): BookingRow[] {
  return [...rows].sort((a, b) => {
    const ka = `${a.date}T${a.time}`;
    const kb = `${b.date}T${b.time}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isHistory(row: Pick<BookingRow, 'status'>): boolean {
  return row.status === 'rejected' || row.status === 'completed' || row.status === 'cancelled';
}

export function buildRequestSections(bookings: BookingRow[], today: string, language = getAppLanguage()): RequestSection[] {
  const de = language === 'de';
  const sorted = sortAsc(bookings);
  const needsAction = sorted.filter((row) => row.status === 'pending');
  const accepted = sorted.filter((row) => row.status === 'accepted');
  const history = sorted.filter(isHistory).reverse();
  const todaysBookings = accepted.filter((row) => row.date === today);
  const upcoming = accepted.filter((row) => row.date !== today);
  const result: RequestSection[] = [];
  if (needsAction.length) result.push({ key: 'needs-action', title: de ? 'Aktion nötig' : 'Needs action', data: needsAction });
  if (todaysBookings.length) result.push({ key: 'today', title: de ? 'Heute' : 'Today', data: todaysBookings });
  if (upcoming.length) result.push({ key: 'upcoming', title: de ? 'Demnächst' : 'Upcoming', data: upcoming });
  if (history.length) result.push({ key: 'history', title: de ? 'Verlauf' : 'History', data: history });
  return result;
}

/**
 * "On my way" is offered from 12 h before the slot until its scheduled end:
 * early enough for a long drive, never for a booking days away (the server
 * independently refuses trips more than a day from the appointment).
 */
export function isTripWindow(booking: Pick<BookingRow, 'date' | 'time' | 'duration_minutes'>, now = Date.now()): boolean {
  const start = Date.parse(`${booking.date}T${booking.time}`);
  if (Number.isNaN(start)) return false;
  return now >= start - 12 * 60 * 60 * 1000 && now <= start + booking.duration_minutes * 60 * 1000;
}
