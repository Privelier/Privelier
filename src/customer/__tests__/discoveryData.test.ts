/**
 * Unit/integration tests for the customer discovery data layer
 * (src/customer/discoveryData.ts). The Supabase client (`lib/supabase.ts`) is
 * mocked entirely, matching the mocking approach in
 * src/barber/__tests__/servicesData.test.ts — these tests never touch a real
 * network or database. Authorization itself is enforced by RLS/the
 * `barber_directory` view's own WHERE clause server-side; these tests only
 * verify that RLS/not-found responses are mapped to the correct typed
 * result, and that request payloads (including the city-normalization
 * behavior of `listBarbersByCity`) are shaped correctly.
 */
import { supabase } from '../../../lib/supabase';
import { getBarberProfile, listBarbersByCity, listServicesForBarber } from '../discoveryData';

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
// `chainable` helper in servicesData.test.ts, extended with `ilike`/`limit`
// for the discovery list query).
// ---------------------------------------------------------------------------
function chainable(result: unknown) {
  const obj: {
    select: jest.Mock;
    eq: jest.Mock;
    ilike: jest.Mock;
    order: jest.Mock;
    limit: jest.Mock;
    maybeSingle: jest.Mock;
    then: (resolve: (value: unknown) => void) => void;
  } = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    ilike: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return obj;
}

// ---------------------------------------------------------------------------
// listBarbersByCity
// ---------------------------------------------------------------------------

describe('listBarbersByCity', () => {
  it('returns ok with the barbers array on success, querying barber_directory ordered by name and capped at 100', async () => {
    const rows = [
      { id: 'b-1', name: 'Ada', city: 'Paris', country: 'France', profile_image: null, bio: null, rating: 0 },
    ];
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listBarbersByCity('Paris');

    expect(result).toEqual({ status: 'ok', barbers: rows });
    expect(mockFrom).toHaveBeenCalledWith('barber_directory');
    expect(builder.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(100);
  });

  it('defaults to an empty array when data is null', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listBarbersByCity('Paris');
    expect(result).toEqual({ status: 'ok', barbers: [] });
  });

  it('maps an RLS denial (42501) to forbidden (e.g. an unauthenticated/anon caller)', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table barber_directory' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listBarbersByCity('Paris');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  describe('city normalization', () => {
    it('trims leading/trailing whitespace from the input before querying', async () => {
      const builder = chainable({ data: [], error: null });
      mockFrom.mockReturnValueOnce(builder);

      await listBarbersByCity('  Paris  ');

      expect(builder.ilike).toHaveBeenCalledWith('city', 'Paris');
    });

    it('does not trim internal whitespace', async () => {
      const builder = chainable({ data: [], error: null });
      mockFrom.mockReturnValueOnce(builder);

      await listBarbersByCity('  New  York  ');

      expect(builder.ilike).toHaveBeenCalledWith('city', 'New  York');
    });

    it('escapes a literal "%" so it is not treated as an ILIKE wildcard', async () => {
      const builder = chainable({ data: [], error: null });
      mockFrom.mockReturnValueOnce(builder);

      await listBarbersByCity('50% off');

      expect(builder.ilike).toHaveBeenCalledWith('city', '50\\% off');
    });

    it('escapes a literal "_" so it is not treated as an ILIKE single-char wildcard', async () => {
      const builder = chainable({ data: [], error: null });
      mockFrom.mockReturnValueOnce(builder);

      await listBarbersByCity('san_francisco');

      expect(builder.ilike).toHaveBeenCalledWith('city', 'san\\_francisco');
    });

    it('escapes a literal backslash before escaping "%"/"_" so the escaping itself cannot be subverted', async () => {
      const builder = chainable({ data: [], error: null });
      mockFrom.mockReturnValueOnce(builder);

      await listBarbersByCity(String.raw`50%_off\special`);

      expect(builder.ilike).toHaveBeenCalledWith('city', '50\\%\\_off\\\\special');
    });

    it('combines trimming and escaping for a city input with both whitespace and metacharacters', async () => {
      const builder = chainable({ data: [], error: null });
      mockFrom.mockReturnValueOnce(builder);

      await listBarbersByCity('  100%_off  ');

      expect(builder.ilike).toHaveBeenCalledWith('city', '100\\%\\_off');
    });
  });
});

// ---------------------------------------------------------------------------
// getBarberProfile
// ---------------------------------------------------------------------------

describe('getBarberProfile', () => {
  it('returns ok with the barber on success', async () => {
    const barber = { id: 'b-1', name: 'Ada', city: 'Paris', country: 'France', profile_image: null, bio: null, rating: 4.5 };
    const builder = chainable({ data: barber, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await getBarberProfile('b-1');

    expect(result).toEqual({ status: 'ok', barber });
    expect(mockFrom).toHaveBeenCalledWith('barber_directory');
    expect(builder.eq).toHaveBeenCalledWith('id', 'b-1');
  });

  it('returns not_found when no row matches (wrong id, not approved, or no longer exists)', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await getBarberProfile('missing-id');
    expect(result).toEqual({ status: 'not_found' });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table barber_directory' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await getBarberProfile('b-1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});

// ---------------------------------------------------------------------------
// listServicesForBarber
// ---------------------------------------------------------------------------

describe('listServicesForBarber', () => {
  it('returns ok with the services array on success', async () => {
    const rows = [{ id: 's-1', barber_id: 'b-1', name: 'Fade', price: 25, duration_minutes: 30 }];
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listServicesForBarber('b-1');

    expect(result).toEqual({ status: 'ok', services: rows });
    expect(mockFrom).toHaveBeenCalledWith('services');
    expect(builder.eq).toHaveBeenCalledWith('barber_id', 'b-1');
    expect(builder.order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('defaults to an empty array when data is null', async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listServicesForBarber('b-1');
    expect(result).toEqual({ status: 'ok', services: [] });
  });

  it('maps an RLS denial (42501) to forbidden (e.g. the barber is not approved and not the caller)', async () => {
    const builder = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table services' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listServicesForBarber('b-1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});
