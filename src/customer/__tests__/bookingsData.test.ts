/**
 * Tests for the pure Upcoming/Past split rule of the bookings data layer.
 * The Supabase client is mocked out (same approach as discoveryData.test.ts)
 * because only the pure helper is under test here — fetchOwnBookingsView is
 * a thin RLS-scoped select whose behavior is exercised on-device.
 */
import type { BookingRow } from '../../types';
import { isUpcomingBooking } from '../bookingsData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const NOW = new Date('2026-07-08T12:00:00');

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    customer_id: 'c1',
    barber_id: 'brb1',
    service_id: 's1',
    date: '2026-07-09',
    time: '10:00:00',
    location: 'Home',
    price: 40,
    status: 'pending',
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('isUpcomingBooking', () => {
  it('future pending and accepted bookings are upcoming', () => {
    expect(isUpcomingBooking(booking({ status: 'pending' }), NOW)).toBe(true);
    expect(isUpcomingBooking(booking({ status: 'accepted' }), NOW)).toBe(true);
  });

  it.each(['rejected', 'completed', 'cancelled'] as const)(
    'a %s booking is past even with a future slot',
    (status) => {
      expect(isUpcomingBooking(booking({ status }), NOW)).toBe(false);
    }
  );

  it('an expired pending/accepted booking is past', () => {
    const expired = booking({ date: '2026-07-08', time: '11:59:00' });
    expect(isUpcomingBooking(expired, NOW)).toBe(false);
    expect(isUpcomingBooking({ ...expired, status: 'accepted' }, NOW)).toBe(false);
  });

  it('a slot exactly at now counts as upcoming', () => {
    expect(isUpcomingBooking(booking({ date: '2026-07-08', time: '12:00:00' }), NOW)).toBe(true);
  });

  it('an unparseable date is past, not a crash', () => {
    expect(isUpcomingBooking(booking({ date: 'not-a-date' }), NOW)).toBe(false);
  });
});
