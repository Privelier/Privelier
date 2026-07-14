/**
 * Shared booking date+time composition and live-window predicates.
 *
 * A BOOKINGS row stores `date` and `time` in separate columns; composing them
 * into a single instant is needed by BOTH apps — the customer Bookings tab's
 * upcoming/past split and the barber Studio dashboard's next-appointment
 * glance — so the ONE composition lives here rather than being re-implemented
 * per app (which risked subtle timezone divergence). Parsing `${date}T${time}`
 * yields a device-LOCAL instant (no trailing `Z`), deliberately the same
 * wall-clock interpretation both apps have always used.
 */
import type { BookingRow } from '../types';

/**
 * Compose a booking's `date` + `time` columns into a single local Date.
 * Returns an Invalid Date (NaN time) if either column is malformed — every
 * caller guards with `Number.isNaN(d.getTime())`.
 */
export function bookingSlotStart(booking: Pick<BookingRow, 'date' | 'time'>): Date {
  return new Date(`${booking.date}T${booking.time}`);
}

/**
 * A booking is "upcoming" while it can still happen: its slot is at or after
 * `now` AND it is still alive in the state machine (pending or accepted).
 * Everything else (completed, rejected, cancelled, or simply expired without
 * action) is past. Shared by the customer Bookings tab's Upcoming/Past split.
 */
export function isUpcomingBooking(booking: BookingRow, now: Date): boolean {
  if (booking.status !== 'pending' && booking.status !== 'accepted') return false;
  const slot = bookingSlotStart(booking);
  if (Number.isNaN(slot.getTime())) return false;
  return slot.getTime() >= now.getTime();
}
