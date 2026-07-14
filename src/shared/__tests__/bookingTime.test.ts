/**
 * Tests for the shared booking date+time composition. `isUpcomingBooking` is
 * also exercised through the customer Bookings suite (which imports it via
 * re-export); here we cover the composition helper directly plus the boundary
 * and invalid-input cases at the shared level.
 */
import type { BookingRow } from '../../types';
import { bookingSlotStart, isUpcomingBooking } from '../bookingTime';

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    customer_id: 'c1',
    barber_id: 'brb1',
    service_id: 's1',
    date: '2026-07-15',
    time: '10:00:00',
    location: 'Home',
    price: 40,
    status: 'accepted',
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('bookingSlotStart', () => {
  it('composes date + time as a single local instant', () => {
    const d = bookingSlotStart({ date: '2026-07-15', time: '10:30:00' });
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July (0-indexed)
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(10);
    expect(d.getMinutes()).toBe(30);
  });

  it('returns an Invalid Date (NaN) for a malformed column rather than throwing', () => {
    expect(Number.isNaN(bookingSlotStart({ date: 'not-a-date', time: '10:00:00' }).getTime())).toBe(
      true
    );
  });
});

describe('isUpcomingBooking', () => {
  const NOW = new Date('2026-07-14T12:00:00');

  it('a slot exactly at now counts as upcoming', () => {
    expect(isUpcomingBooking(booking({ date: '2026-07-14', time: '12:00:00' }), NOW)).toBe(true);
  });

  it('a terminal-status booking is past even with a future slot', () => {
    expect(isUpcomingBooking(booking({ status: 'completed' }), NOW)).toBe(false);
  });
});
