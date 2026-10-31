/**
 * Booking creation goes through the create_booking RPC (migration 0054).
 * The Supabase client is mocked; the server-side guarantees (price stamp,
 * overlap exclusion, idempotency) are proven by
 * supabase/tests/authorization_matrix.test.sql. These tests pin the
 * client contract: the payload, and how each server refusal is surfaced.
 */
import { supabase } from '../../../lib/supabase';
import { insertBooking } from '../bookingCreateData';

jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockRpc = supabase.rpc as jest.Mock;

const INPUT = {
  serviceId: 's-1',
  date: '2026-07-13',
  time: '09:00:00',
  location: '123 Example Street',
  idempotencyKey: 'key-1',
};

function rejectWith(code: string, message = '') {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code, message } });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('insertBooking', () => {
  it('sends the service, slot, trimmed location and idempotency key, and never a price or customer id', async () => {
    const created = { id: 'booking-1', status: 'pending', price: 25 };
    mockRpc.mockResolvedValueOnce({ data: created, error: null });

    const result = await insertBooking({ ...INPUT, location: '  123 Example Street  ' });

    expect(result).toEqual({ status: 'ok', booking: created });
    expect(mockRpc).toHaveBeenCalledWith('create_booking', {
      p_service_id: 's-1',
      p_date: '2026-07-13',
      p_time: '09:00:00',
      p_location: '123 Example Street',
      p_idempotency_key: 'key-1',
      p_latitude: undefined,
      p_longitude: undefined,
    });
  });

  it('passes geocoded coordinates when the address was placed', async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: 'booking-1' }, error: null });

    await insertBooking({ ...INPUT, coordinates: { latitude: 49.45, longitude: 11.08 } });

    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_latitude: 49.45, p_longitude: 11.08 });
  });

  it('refuses a blank location without calling the server', async () => {
    const result = await insertBooking({ ...INPUT, location: '   ' });

    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([
    ['23P01', '', 'conflict'],
    ['P0001', 'Booking overlaps an existing active booking', 'conflict'],
    ['P0001', 'Booking date and time must be in the future', 'slot_unavailable'],
    ['P0001', "Booking time is outside the barber's active availability", 'slot_unavailable'],
    ['PA003', 'The barber is not working on this date', 'slot_unavailable'],
    ['P0002', 'service not found', 'slot_unavailable'],
  ])('maps %s "%s" to %s', async (code, message, status) => {
    rejectWith(code, message);

    expect(await insertBooking(INPUT)).toEqual({ status });
  });

  it.each([
    ['PA004', 'too_many_pending'],
    ['PA429', 'rate_limited'],
    ['42501', 'forbidden'],
  ])('maps %s to the %s failure with calm copy', async (code, expected) => {
    rejectWith(code);

    const result = await insertBooking(INPUT);

    expect(result).toMatchObject({ status: 'error', code: expected });
    expect(result).toHaveProperty('message', expect.any(String));
  });

  it('does not show cancellation copy for an unrecognized P0001', async () => {
    rejectWith('P0001', 'some other refusal');

    expect(await insertBooking(INPUT)).toMatchObject({ status: 'error', code: 'unknown' });
  });

  it('never surfaces raw server text', async () => {
    rejectWith('XX000', 'internal: relation "bookings" secret detail');

    const result = await insertBooking(INPUT);

    expect(result).toMatchObject({ status: 'error', code: 'unknown' });
    expect(JSON.stringify(result)).not.toContain('secret detail');
  });
});
