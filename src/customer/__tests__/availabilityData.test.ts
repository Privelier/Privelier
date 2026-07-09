/**
 * Unit/integration tests for the customer-facing availability/busy-slot data
 * layer (src/customer/availabilityData.ts, build-order step 11-12). The
 * Supabase client (`lib/supabase.ts`) is mocked entirely, matching the
 * mocking approach in src/barber/__tests__/availabilityData.test.ts and
 * src/customer/__tests__/discoveryData.test.ts — these tests never touch a
 * real network or database. listBarberBusySlots goes through
 * `supabase.rpc(...)`, not `.from(...)`, so that call is mocked separately
 * from the `chainable` `.from()` helper used for listBarberAvailability.
 */
import { supabase } from '../../../lib/supabase';
import { listBarberAvailability, listBarberBusySlots } from '../availabilityData';

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

// Mirrors the `chainable` helper in the barber-side availabilityData test
// and discoveryData.test.ts.
function chainable(result: unknown) {
  const obj: {
    select: jest.Mock;
    eq: jest.Mock;
    then: (resolve: (value: unknown) => void) => void;
  } = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return obj;
}

// ---------------------------------------------------------------------------
// listBarberAvailability
// ---------------------------------------------------------------------------

describe('listBarberAvailability', () => {
  it('returns ok with the windows array on success, querying all windows for the given barber unfiltered by date', async () => {
    const rows = [
      { id: 'a-1', barber_id: 'b-1', day_of_week: 1, specific_date: null, start_time: '09:00:00', end_time: '17:00:00' },
      { id: 'a-2', barber_id: 'b-1', day_of_week: null, specific_date: '2026-08-01', start_time: '10:00:00', end_time: '12:00:00' },
    ];
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listBarberAvailability('b-1');

    expect(result).toEqual({ status: 'ok', windows: rows });
    expect(mockFrom).toHaveBeenCalledWith('availability');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.eq).toHaveBeenCalledWith('barber_id', 'b-1');
  });

  it('defaults to an empty array when data is null', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listBarberAvailability('b-1');
    expect(result).toEqual({ status: 'ok', windows: [] });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table availability' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listBarberAvailability('b-1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('maps a generic/unrecognised error to unknown', async () => {
    const builder = chainable({ data: null, error: { message: 'boom' } });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listBarberAvailability('b-1');
    expect(result).toMatchObject({ status: 'error', code: 'unknown' });
  });
});

// ---------------------------------------------------------------------------
// listBarberBusySlots
// ---------------------------------------------------------------------------

describe('listBarberBusySlots', () => {
  it('calls the get_barber_busy_slots RPC with the barber id and date, and maps rows to BusySlot shape', async () => {
    const rpcRows = [
      { start_time: '09:00:00', duration_minutes: 30 },
      { start_time: '11:00:00', duration_minutes: 45 },
    ];
    mockRpc.mockResolvedValueOnce({ data: rpcRows, error: null });

    const result = await listBarberBusySlots('b-1', '2026-07-13');

    expect(mockRpc).toHaveBeenCalledWith('get_barber_busy_slots', {
      p_barber_id: 'b-1',
      p_date: '2026-07-13',
    });
    expect(result).toEqual({
      status: 'ok',
      busy: [
        { startTime: '09:00:00', durationMinutes: 30 },
        { startTime: '11:00:00', durationMinutes: 45 },
      ],
    });
  });

  it('defaults to an empty busy array when data is null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await listBarberBusySlots('b-1', '2026-07-13');
    expect(result).toEqual({ status: 'ok', busy: [] });
  });

  it('defaults to an empty busy array when data is an empty array (no pending/accepted bookings that day)', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const result = await listBarberBusySlots('b-1', '2026-07-13');
    expect(result).toEqual({ status: 'ok', busy: [] });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'permission denied for function get_barber_busy_slots' },
    });

    const result = await listBarberBusySlots('b-1', '2026-07-13');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('maps a generic RPC error to unknown', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const result = await listBarberBusySlots('b-1', '2026-07-13');
    expect(result).toMatchObject({ status: 'error', code: 'unknown' });
  });
});
