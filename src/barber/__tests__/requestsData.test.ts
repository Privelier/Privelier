/**
 * Unit/integration tests for the barber requests data layer
 * (src/barber/requestsData.ts, build-order step 13-14). The Supabase client
 * is mocked entirely — same approach as bookingCreateData.test.ts and the
 * other data-layer suites; no real network or database.
 *
 * What these pin down:
 * - The four status-transition mutations issue exactly
 *   `update({ status }).eq('id', ...)` — the client sends the transition and
 *   NOTHING else; authorization is entirely RLS + the actor-aware trigger
 *   (migration 0011), never re-implemented here.
 * - A trigger rejection (Postgres P0001 — wrong actor or illegal transition
 *   shape) maps to 'transition_rejected', and a no-visible-row update
 *   (PGRST116) maps to 'not_found', so the screen can roll back its
 *   optimistic card with specific copy.
 * - fetchOwnRequestsView treats the counterparts RPC (migration 0012) as
 *   best-effort: an RPC failure degrades to an empty map, never fails the
 *   view.
 */
import { supabase } from '../../../lib/supabase';
import {
  acceptBooking,
  cancelBookingAsBarber,
  completeBooking,
  fetchOwnRequestsView,
  rejectBooking,
} from '../requestsData';
import type { BookingRow } from '../../types';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * Chainable builder mirroring the helper in the other data-layer suites,
 * extended two ways for this module: `update`/`eq` for the transition path,
 * and a `then` so the builder itself is awaitable for the read paths that
 * end on `.order(...)` / `.in(...)` without `.single()`.
 */
interface ChainableBuilder {
  select: jest.Mock;
  order: jest.Mock;
  in: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
}

function chainable(result: unknown) {
  const obj: ChainableBuilder = {
    select: jest.fn(() => obj),
    order: jest.fn(() => obj),
    in: jest.fn(() => obj),
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    customer_id: 'c1',
    barber_id: 'brb1',
    service_id: 's1',
    date: '2026-07-13',
    time: '10:00:00',
    location: 'Home',
    price: 30,
    status: 'pending',
    created_at: '2026-07-09T00:00:00Z',
    ...overrides,
  };
}

describe('transition mutations', () => {
  const transitions = [
    { name: 'acceptBooking', fn: acceptBooking, status: 'accepted' },
    { name: 'rejectBooking', fn: rejectBooking, status: 'rejected' },
    { name: 'completeBooking', fn: completeBooking, status: 'completed' },
    { name: 'cancelBookingAsBarber', fn: cancelBookingAsBarber, status: 'cancelled' },
  ] as const;

  it.each(transitions)(
    '$name sends update({ status: $status }) scoped to the booking id and nothing else',
    async ({ fn, status }) => {
      const updated = booking({ status });
      const builder = chainable({ data: updated, error: null });
      mockFrom.mockReturnValueOnce(builder);

      const result = await fn('b1');

      expect(mockFrom).toHaveBeenCalledWith('bookings');
      // The payload is EXACTLY { status } — the client never sends price,
      // date, time, or participant ids on a transition.
      expect(builder.update).toHaveBeenCalledWith({ status });
      expect(builder.eq).toHaveBeenCalledWith('id', 'b1');
      expect(result).toEqual({ status: 'ok', booking: updated });
    }
  );

  it.each(transitions)(
    '$name maps a trigger rejection (P0001) to transition_rejected',
    async ({ fn }) => {
      const builder = chainable({
        data: null,
        error: { code: 'P0001', message: 'Only the barber may accept a booking' },
      });
      mockFrom.mockReturnValueOnce(builder);

      const result = await fn('b1');

      expect(result).toMatchObject({ status: 'error', code: 'transition_rejected' });
    }
  );

  it('maps a no-visible-row update (PGRST116) to not_found — the row vanished or was never the caller\'s', async () => {
    const builder = chainable({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await acceptBooking('gone');

    expect(result).toEqual({ status: 'not_found' });
  });

  it('maps an RLS denial (42501) to forbidden via the shared mapPostgrestError', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table bookings' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await rejectBooking('b1');

    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});

describe('fetchOwnRequestsView', () => {
  it('returns bookings plus service and counterpart maps on the happy path', async () => {
    const b1 = booking({ id: 'bk1', service_id: 's1' });
    const b2 = booking({ id: 'bk2', service_id: 's2' });
    const bookingsBuilder = chainable({ data: [b1, b2], error: null });
    const servicesBuilder = chainable({
      data: [
        { id: 's1', barber_id: 'brb1', name: 'Burst fade', price: 30, duration_minutes: 25 },
        { id: 's2', barber_id: 'brb1', name: 'Hair + beard', price: 45, duration_minutes: 60 },
      ],
      error: null,
    });
    mockFrom.mockReturnValueOnce(bookingsBuilder).mockReturnValueOnce(servicesBuilder);
    mockRpc.mockResolvedValueOnce({
      data: [
        { booking_id: 'bk1', id: 'c1', name: 'Tito', profile_image: null },
        { booking_id: 'bk2', id: 'c2', name: 'Omar', profile_image: 'https://x/p.jpg' },
      ],
      error: null,
    });

    const result = await fetchOwnRequestsView();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.bookings).toEqual([b1, b2]);
    expect(result.servicesById.get('s1')?.name).toBe('Burst fade');
    expect(result.servicesById.get('s2')?.name).toBe('Hair + beard');
    expect(result.counterpartsByBookingId.get('bk1')).toEqual({
      id: 'c1',
      name: 'Tito',
      profile_image: null,
    });
    expect(result.counterpartsByBookingId.get('bk2')?.name).toBe('Omar');
    // Counterparts resolved via the narrow RPC, keyed by booking id.
    expect(mockRpc).toHaveBeenCalledWith('get_booking_counterparts', {
      p_booking_ids: ['bk1', 'bk2'],
    });
    // Service ids are deduped before the enrichment read.
    expect(servicesBuilder.in).toHaveBeenCalledWith('id', ['s1', 's2']);
  });

  it('dedupes service ids shared across bookings', async () => {
    const b1 = booking({ id: 'bk1', service_id: 's1' });
    const b2 = booking({ id: 'bk2', service_id: 's1' });
    const bookingsBuilder = chainable({ data: [b1, b2], error: null });
    const servicesBuilder = chainable({ data: [], error: null });
    mockFrom.mockReturnValueOnce(bookingsBuilder).mockReturnValueOnce(servicesBuilder);
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    await fetchOwnRequestsView();

    expect(servicesBuilder.in).toHaveBeenCalledWith('id', ['s1']);
  });

  it('degrades to an empty counterpart map when the RPC fails — best-effort, never fails the view', async () => {
    const b1 = booking({ id: 'bk1' });
    const bookingsBuilder = chainable({ data: [b1], error: null });
    const servicesBuilder = chainable({ data: [], error: null });
    mockFrom.mockReturnValueOnce(bookingsBuilder).mockReturnValueOnce(servicesBuilder);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    const result = await fetchOwnRequestsView();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.bookings).toEqual([b1]);
    expect(result.counterpartsByBookingId.size).toBe(0);
  });

  it('fails the whole view when the bookings read itself fails', async () => {
    const bookingsBuilder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table bookings' },
    });
    mockFrom.mockReturnValueOnce(bookingsBuilder);

    const result = await fetchOwnRequestsView();

    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
    // No enrichment reads after a failed baseline.
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('skips both enrichment reads entirely when there are no bookings', async () => {
    const bookingsBuilder = chainable({ data: [], error: null });
    mockFrom.mockReturnValueOnce(bookingsBuilder);

    const result = await fetchOwnRequestsView();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.bookings).toEqual([]);
    expect(result.servicesById.size).toBe(0);
    expect(result.counterpartsByBookingId.size).toBe(0);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
