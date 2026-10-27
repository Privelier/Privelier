/**
 * Keyset paging for the booking lists. Both apps read newest first by
 * (date, time, id); a page holds BOOKINGS_PAGE_SIZE rows and "show older"
 * continues strictly after the last row, so no booking is skipped or
 * repeated even when several share a slot.
 */
import type { BookingRow } from '../types';

/** Every list read is bounded (hardening Phase 4). */
export const BOOKINGS_PAGE_SIZE = 300;

export interface BookingCursor {
  date: string;
  time: string;
  id: string;
}

export interface BookingPage {
  bookings: BookingRow[];
  hasOlder: boolean;
  olderCursor: BookingCursor | null;
}

const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_TIME = /^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Cursors come from rows; validate before interpolating into PostgREST's filter grammar. */
export function isBookingCursor(value: unknown): value is BookingCursor {
  if (!value || typeof value !== 'object') return false;
  const { date, time, id } = value as Partial<BookingCursor>;
  return (
    typeof date === 'string' && SAFE_DATE.test(date) &&
    typeof time === 'string' && SAFE_TIME.test(time) &&
    typeof id === 'string' && SAFE_ID.test(id)
  );
}

/** `.or()` filter for rows strictly older than the cursor in (date, time, id) order. */
export function olderThanFilter({ date, time, id }: BookingCursor): string {
  return `date.lt.${date},and(date.eq.${date},time.lt.${time}),and(date.eq.${date},time.eq.${time},id.lt.${id})`;
}

/** Turn a limit+1 read into a page: the extra row only signals that more exist. */
export function buildBookingPage(rows: BookingRow[]): BookingPage {
  const hasOlder = rows.length > BOOKINGS_PAGE_SIZE;
  const bookings = hasOlder ? rows.slice(0, BOOKINGS_PAGE_SIZE) : rows;
  const last = bookings[bookings.length - 1];
  return {
    bookings,
    hasOlder,
    olderCursor: hasOlder && last ? { date: last.date, time: last.time, id: last.id } : null,
  };
}
