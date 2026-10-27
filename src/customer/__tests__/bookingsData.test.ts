/**
 * Tests for the pure Upcoming/Past split rule of the bookings data layer,
 * plus the customer cancel mutation (build-order step 13-14). The Supabase
 * client is mocked out (same approach as discoveryData.test.ts); the
 * bookings read is pinned for its paging contract only.
 */
import { supabase } from '../../../lib/supabase';
import type { BookingRow } from '../../types';
import { cancelBookingAsCustomer, fetchOwnBookingsView, isUpcomingBooking } from '../bookingsData';

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
    duration_minutes: 45,
    status: 'pending',
    created_at: '2026-07-01T00:00:00Z',
    idempotency_key: null,
    location_latitude: null,
    location_longitude: null,
    slot: null,
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

/** Awaitable read builder for the paged bookings view and its lookups. */
function readable(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const name of ['select', 'or', 'order', 'limit', 'in']) obj[name] = jest.fn(() => obj);
  obj.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return obj as Record<'select' | 'or' | 'order' | 'limit' | 'in', jest.Mock>;
}

describe('fetchOwnBookingsView', () => {
  it('reads one page newest first with a probe row and reports older pages', async () => {
    const rows = Array.from({ length: 301 }, (_, i) => booking({ id: `b${String(i).padStart(3, '0')}` }));
    const bookingsBuilder = readable({ data: rows, error: null });
    mockFrom
      .mockReturnValueOnce(bookingsBuilder)
      .mockReturnValueOnce(readable({ data: [], error: null }))
      .mockReturnValueOnce(readable({ data: [], error: null }));

    const result = await fetchOwnBookingsView();

    if (result.status !== 'ok') throw new Error('expected ok');
    expect(bookingsBuilder.limit).toHaveBeenCalledWith(301);
    expect(bookingsBuilder.order).toHaveBeenCalledWith('id', { ascending: false });
    expect(bookingsBuilder.or).not.toHaveBeenCalled();
    expect(result.bookings).toHaveLength(300);
    expect(result.hasOlder).toBe(true);
    expect(result.olderCursor).toEqual({ date: '2026-07-09', time: '10:00:00', id: 'b299' });
  });

  it('continues after a cursor, and refuses a malformed one without a read', async () => {
    const bookingsBuilder = readable({ data: [], error: null });
    mockFrom.mockReturnValueOnce(bookingsBuilder);

    const result = await fetchOwnBookingsView({ date: '2026-07-09', time: '10:00:00', id: 'b299' });
    expect(result).toMatchObject({ status: 'ok', bookings: [], hasOlder: false, olderCursor: null });
    expect(bookingsBuilder.or).toHaveBeenCalledWith(
      'date.lt.2026-07-09,and(date.eq.2026-07-09,time.lt.10:00:00),and(date.eq.2026-07-09,time.eq.10:00:00,id.lt.b299)'
    );

    mockFrom.mockClear();
    const refused = await fetchOwnBookingsView({ date: '2026-07-09', time: '10:00', id: 'b),id.gt.(0' });
    expect(refused).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
