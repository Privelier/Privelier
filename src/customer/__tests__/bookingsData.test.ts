/**
 * Tests for the pure Upcoming/Past split rule of the bookings data layer,
 * plus the customer cancel mutation (build-order step 13-14). The Supabase
 * client is mocked out (same approach as discoveryData.test.ts) —
 * fetchOwnBookingsView stays a thin RLS-scoped select whose behavior is
 * exercised on-device.
 */
import { supabase } from '../../../lib/supabase';
import type { BookingRow } from '../../types';
import { cancelBookingAsCustomer, isUpcomingBooking } from '../bookingsData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

/** Chainable builder for the update path, mirroring the other suites. */
function chainable(result: unknown) {
  const obj: Record<string, jest.Mock> = {
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    select: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

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

describe('cancelBookingAsCustomer', () => {
  it('sends update({ status: "cancelled" }) scoped to the booking id and nothing else — authorization is RLS + the actor-aware trigger, never client-side', async () => {
    const cancelled = booking({ status: 'cancelled' });
    const builder = chainable({ data: cancelled, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await cancelBookingAsCustomer('b1');

    expect(mockFrom).toHaveBeenCalledWith('bookings');
    expect(builder.update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'b1');
    expect(result).toEqual({ status: 'ok', booking: cancelled });
  });

  it('maps a trigger rejection (P0001 — e.g. the booking already completed) to transition_rejected', async () => {
    const builder = chainable({
      data: null,
      error: { code: 'P0001', message: 'Invalid booking status transition: completed -> cancelled' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await cancelBookingAsCustomer('b1');

    expect(result).toMatchObject({ status: 'error', code: 'transition_rejected' });
  });

  it('maps a no-visible-row update (PGRST116) to not_found', async () => {
    const builder = chainable({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await cancelBookingAsCustomer('gone');

    expect(result).toEqual({ status: 'not_found' });
  });
});
