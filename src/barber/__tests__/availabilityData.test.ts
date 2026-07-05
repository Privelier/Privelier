/**
 * Unit/integration tests for the barber availability data layer
 * (src/barber/availabilityData.ts). The Supabase client (`lib/supabase.ts`)
 * is mocked entirely, matching the mocking approach in
 * src/auth/__tests__/authService.test.ts — these tests never touch a real
 * network or database. Authorization itself is enforced by RLS server-side;
 * these tests only verify that RLS/CHECK/not-found responses are mapped to
 * the correct typed result, and that request payloads are shaped correctly
 * (including the day-of-week vs. specific-date mutual exclusivity).
 */
import { supabase } from '../../../lib/supabase';
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listOwnAvailability,
  updateAvailabilityWindow,
} from '../availabilityData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// Mirrors the `chainable` helper in servicesData.test.ts / authService.test.ts.
function chainable(result: unknown) {
  const obj: {
    select: jest.Mock;
    eq: jest.Mock;
    order: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    single: jest.Mock;
    maybeSingle: jest.Mock;
    then: (resolve: (value: unknown) => void) => void;
  } = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    order: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    update: jest.fn(() => obj),
    delete: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return obj;
}

// ---------------------------------------------------------------------------
// listOwnAvailability
// ---------------------------------------------------------------------------

describe('listOwnAvailability', () => {
  it('returns ok with the windows array on success, ordered by day/date/start_time', async () => {
    const rows = [
      { id: 'a-1', barber_id: 'b-1', day_of_week: 1, specific_date: null, start_time: '09:00:00', end_time: '17:00:00' },
    ];
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnAvailability('b-1');

    expect(result).toEqual({ status: 'ok', windows: rows });
    expect(mockFrom).toHaveBeenCalledWith('availability');
    expect(builder.eq).toHaveBeenCalledWith('barber_id', 'b-1');
    expect(builder.order).toHaveBeenCalledWith('day_of_week', { ascending: true, nullsFirst: false });
    expect(builder.order).toHaveBeenCalledWith('specific_date', { ascending: true, nullsFirst: false });
    expect(builder.order).toHaveBeenCalledWith('start_time', { ascending: true });
  });

  it('defaults to an empty array when data is null', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnAvailability('b-1');
    expect(result).toEqual({ status: 'ok', windows: [] });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table availability' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnAvailability('b-1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});

// ---------------------------------------------------------------------------
// createAvailabilityWindow
// ---------------------------------------------------------------------------

describe('createAvailabilityWindow', () => {
  it('inserts a day-of-week window with specific_date left null', async () => {
    const created = {
      id: 'a-2',
      barber_id: 'b-1',
      day_of_week: 2,
      specific_date: null,
      start_time: '09:00',
      end_time: '17:00',
    };
    const builder = chainable({ data: created, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await createAvailabilityWindow({
      barberId: 'b-1',
      dayOfWeek: 2,
      startTime: '09:00',
      endTime: '17:00',
    });

    expect(result).toEqual({ status: 'ok', window: created });
    expect(builder.insert).toHaveBeenCalledWith({
      barber_id: 'b-1',
      day_of_week: 2,
      specific_date: null,
      start_time: '09:00',
      end_time: '17:00',
    });
  });

  it('inserts a specific-date window with day_of_week left null', async () => {
    const created = {
      id: 'a-3',
      barber_id: 'b-1',
      day_of_week: null,
      specific_date: '2026-08-01',
      start_time: '10:00',
      end_time: '12:00',
    };
    const builder = chainable({ data: created, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await createAvailabilityWindow({
      barberId: 'b-1',
      specificDate: '2026-08-01',
      startTime: '10:00',
      endTime: '12:00',
    });

    expect(result).toEqual({ status: 'ok', window: created });
    expect(builder.insert).toHaveBeenCalledWith({
      barber_id: 'b-1',
      day_of_week: null,
      specific_date: '2026-08-01',
      start_time: '10:00',
      end_time: '12:00',
    });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table availability' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await createAvailabilityWindow({
      barberId: 'not-mine',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
    });
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('maps a CHECK violation (23514) to invalid_input (e.g. both day and date, or start >= end)', async () => {
    const builder = chainable({
      data: null,
      error: {
        code: '23514',
        message: 'violates check constraint "chk_availability_day_or_date"',
      },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await createAvailabilityWindow({
      barberId: 'b-1',
      dayOfWeek: 1,
      specificDate: '2026-08-01',
      startTime: '09:00',
      endTime: '08:00',
    });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
  });
});

// ---------------------------------------------------------------------------
// updateAvailabilityWindow
// ---------------------------------------------------------------------------

describe('updateAvailabilityWindow', () => {
  it('only writes the fields present in the patch', async () => {
    const updated = { id: 'a-1', barber_id: 'b-1', day_of_week: 1, specific_date: null, start_time: '10:00', end_time: '18:00' };
    const builder = chainable({ data: updated, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await updateAvailabilityWindow('a-1', { startTime: '10:00', endTime: '18:00' });

    expect(result).toEqual({ status: 'ok', window: updated });
    expect(builder.update).toHaveBeenCalledWith({ start_time: '10:00', end_time: '18:00' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'a-1');
  });

  it('supports switching from day-of-week to specific-date via explicit nulls', async () => {
    const updated = { id: 'a-1', day_of_week: null, specific_date: '2026-09-01' };
    const builder = chainable({ data: updated, error: null });
    mockFrom.mockReturnValueOnce(builder);

    await updateAvailabilityWindow('a-1', { dayOfWeek: null, specificDate: '2026-09-01' });

    expect(builder.update).toHaveBeenCalledWith({ day_of_week: null, specific_date: '2026-09-01' });
  });

  it('returns not_found when no row matches (zero rows returned, no error)', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await updateAvailabilityWindow('missing-id', { startTime: '09:00' });
    expect(result).toEqual({ status: 'not_found' });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table availability' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await updateAvailabilityWindow('a-1', { startTime: '09:00' });
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('maps a CHECK violation (23514) to invalid_input (e.g. start >= end after the patch)', async () => {
    const builder = chainable({
      data: null,
      error: { code: '23514', message: 'violates check constraint "chk_availability_time_order"' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await updateAvailabilityWindow('a-1', { startTime: '18:00', endTime: '09:00' });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
  });
});

// ---------------------------------------------------------------------------
// deleteAvailabilityWindow
// ---------------------------------------------------------------------------

describe('deleteAvailabilityWindow', () => {
  it('returns ok on success', async () => {
    const builder = chainable({ data: { id: 'a-1' }, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await deleteAvailabilityWindow('a-1');
    expect(result).toEqual({ status: 'ok' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'a-1');
  });

  it('returns not_found when no row matches', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await deleteAvailabilityWindow('missing-id');
    expect(result).toEqual({ status: 'not_found' });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table availability' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await deleteAvailabilityWindow('a-1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});
