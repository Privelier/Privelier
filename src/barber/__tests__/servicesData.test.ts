/**
 * Unit/integration tests for the barber services data layer
 * (src/barber/servicesData.ts). The Supabase client (`lib/supabase.ts`) is
 * mocked entirely, matching the mocking approach in
 * src/auth/__tests__/authService.test.ts — these tests never touch a real
 * network or database. Authorization itself is enforced by RLS server-side;
 * these tests only verify that RLS/CHECK/not-found responses are mapped to
 * the correct typed result, and that request payloads are shaped correctly.
 */
import { supabase } from '../../../lib/supabase';
import { createService, deleteService, listOwnServices, updateService } from '../servicesData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Test helper: a minimal fake PostgREST query-builder chain (mirrors the
// `chainable` helper in authService.test.ts).
// ---------------------------------------------------------------------------
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
// listOwnServices
// ---------------------------------------------------------------------------

describe('listOwnServices', () => {
  it('returns ok with the services array on success', async () => {
    const rows = [{ id: 's-1', barber_id: 'b-1', name: 'Fade', price: 25, duration_minutes: 30 }];
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnServices('b-1');

    expect(result).toEqual({ status: 'ok', services: rows });
    expect(mockFrom).toHaveBeenCalledWith('services');
    expect(builder.eq).toHaveBeenCalledWith('barber_id', 'b-1');
    expect(builder.order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('defaults to an empty array when data is null', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnServices('b-1');
    expect(result).toEqual({ status: 'ok', services: [] });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table services' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnServices('b-1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});

// ---------------------------------------------------------------------------
// createService
// ---------------------------------------------------------------------------

describe('createService', () => {
  it('inserts the mapped snake_case payload and returns ok with the created row', async () => {
    const created = { id: 's-2', barber_id: 'b-1', name: 'Beard trim', price: 15, duration_minutes: 20 };
    const builder = chainable({ data: created, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await createService({
      barberId: 'b-1',
      name: 'Beard trim',
      price: 15,
      durationMinutes: 20,
    });

    expect(result).toEqual({ status: 'ok', service: created });
    expect(builder.insert).toHaveBeenCalledWith({
      barber_id: 'b-1',
      name: 'Beard trim',
      price: 15,
      duration_minutes: 20,
    });
  });

  it('maps an RLS denial (42501) to forbidden (e.g. barberId is not the caller)', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table services' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await createService({
      barberId: 'not-mine',
      name: 'Fade',
      price: 25,
      durationMinutes: 30,
    });
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('maps a CHECK violation (23514) to invalid_input (e.g. out-of-range price)', async () => {
    const builder = chainable({
      data: null,
      error: { code: '23514', message: 'violates check constraint "services_price_check"' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await createService({ barberId: 'b-1', name: 'Fade', price: -5, durationMinutes: 30 });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
  });
});

// ---------------------------------------------------------------------------
// updateService
// ---------------------------------------------------------------------------

describe('updateService', () => {
  it('only writes the fields present in the patch', async () => {
    const updated = { id: 's-1', barber_id: 'b-1', name: 'Fade', price: 30, duration_minutes: 30 };
    const builder = chainable({ data: updated, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await updateService('s-1', { price: 30 });

    expect(result).toEqual({ status: 'ok', service: updated });
    expect(builder.update).toHaveBeenCalledWith({ price: 30 });
    expect(builder.eq).toHaveBeenCalledWith('id', 's-1');
  });

  it('maps camelCase durationMinutes to duration_minutes in the update payload', async () => {
    const builder = chainable({ data: { id: 's-1' }, error: null });
    mockFrom.mockReturnValueOnce(builder);

    await updateService('s-1', { name: 'New name', durationMinutes: 45 });

    expect(builder.update).toHaveBeenCalledWith({ name: 'New name', duration_minutes: 45 });
  });

  it('returns not_found when no row matches (zero rows returned, no error)', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await updateService('missing-id', { price: 10 });
    expect(result).toEqual({ status: 'not_found' });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table services' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await updateService('s-1', { price: 10 });
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('maps a CHECK violation (23514) to invalid_input', async () => {
    const builder = chainable({
      data: null,
      error: { code: '23514', message: 'violates check constraint "services_duration_minutes_check"' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await updateService('s-1', { durationMinutes: 0 });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
  });
});

// ---------------------------------------------------------------------------
// deleteService
// ---------------------------------------------------------------------------

describe('deleteService', () => {
  it('returns ok on success', async () => {
    const builder = chainable({ data: { id: 's-1' }, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await deleteService('s-1');
    expect(result).toEqual({ status: 'ok' });
    expect(builder.eq).toHaveBeenCalledWith('id', 's-1');
  });

  it('returns not_found when no row matches', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await deleteService('missing-id');
    expect(result).toEqual({ status: 'not_found' });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table services' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await deleteService('s-1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});
