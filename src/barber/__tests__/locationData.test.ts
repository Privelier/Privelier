/**
 * Unit tests for the barber own-location data layer
 * (src/barber/locationData.ts, Explore/location Run A). Supabase is mocked
 * entirely (same approach as portfolioData.test.ts) — no network, no DB.
 *
 * What these pin hardest:
 *  - updateOwnLocation NEVER sends display coordinates (they are
 *    trigger-owned per migration 0019 — a regression that started sending
 *    them would silently look like it works, so the payload shape is
 *    asserted key-by-key);
 *  - the client-side mirrors of the DB CHECKs (paired coords, ranges,
 *    address length) reject before any network call;
 *  - trim/empty→NULL address normalization (clearing is a valid save).
 */
import { supabase } from '../../../lib/supabase';
import { MAX_ADDRESS_LENGTH, fetchOwnLocation, updateOwnLocation } from '../locationData';
import type { BarberLocationRow } from '../../types';

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function locationRow(overrides: Partial<BarberLocationRow> = {}): BarberLocationRow {
  return {
    user_id: 'barber-1',
    address: 'Teststraat 1, Amsterdam',
    latitude: 52.37,
    longitude: 4.9,
    display_latitude: 52.372,
    display_longitude: 4.897,
    location_updated_at: '2026-07-15T12:00:00Z',
    ...overrides,
  };
}

/** select('*').eq(...).maybeSingle() chain resolving to result. */
function selectChain(result: unknown) {
  const obj: { select: jest.Mock; eq: jest.Mock; maybeSingle: jest.Mock } = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

/** upsert(...).select().maybeSingle() chain resolving to result. */
function upsertChain(result: unknown) {
  const obj: { upsert: jest.Mock; select: jest.Mock; maybeSingle: jest.Mock } = {
    upsert: jest.fn(() => obj),
    select: jest.fn(() => obj),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

describe('fetchOwnLocation', () => {
  it('returns the row scoped to the given user id', async () => {
    const chain = selectChain({ data: locationRow(), error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchOwnLocation('barber-1');
    expect(mockFrom).toHaveBeenCalledWith('barber_location');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'barber-1');
    expect(result).toEqual({ status: 'ok', location: locationRow() });
  });

  it('returns location: null when no row exists', async () => {
    mockFrom.mockReturnValue(selectChain({ data: null, error: null }));
    expect(await fetchOwnLocation('barber-1')).toEqual({ status: 'ok', location: null });
  });

  it('maps a PostgREST error through the shared mapper', async () => {
    mockFrom.mockReturnValue(selectChain({ data: null, error: { code: '42501', message: 'denied' } }));
    expect(await fetchOwnLocation('barber-1')).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});

describe('updateOwnLocation', () => {
  it('upserts exactly the four app-owned columns — never display coordinates', async () => {
    const chain = upsertChain({ data: locationRow(), error: null });
    mockFrom.mockReturnValue(chain);

    const result = await updateOwnLocation('barber-1', {
      address: '  Teststraat 1, Amsterdam  ',
      latitude: 52.37,
      longitude: 4.9,
    });

    expect(result.status).toBe('ok');
    const payload = chain.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      'address',
      'latitude',
      'location_updated_at',
      'longitude',
      'user_id',
    ]);
    expect(payload.address).toBe('Teststraat 1, Amsterdam'); // trimmed
    expect(payload).not.toHaveProperty('display_latitude');
    expect(payload).not.toHaveProperty('display_longitude');
    expect(chain.upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id' });
  });

  it('stores a cleared location: empty address → NULL, null coords allowed', async () => {
    const cleared = locationRow({
      address: null,
      latitude: null,
      longitude: null,
      display_latitude: null,
      display_longitude: null,
    });
    const chain = upsertChain({ data: cleared, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await updateOwnLocation('barber-1', { address: '   ', latitude: null, longitude: null });
    expect(result.status).toBe('ok');
    const payload = chain.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.address).toBeNull();
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
  });

  it('rejects half-set coordinates before any network call', async () => {
    const result = await updateOwnLocation('barber-1', { address: 'x', latitude: 52.37, longitude: null });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects out-of-range and non-finite coordinates before any network call', async () => {
    expect(
      await updateOwnLocation('b', { address: 'x', latitude: 91, longitude: 0 })
    ).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(
      await updateOwnLocation('b', { address: 'x', latitude: 0, longitude: -181 })
    ).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(
      await updateOwnLocation('b', { address: 'x', latitude: Number.NaN, longitude: 0 })
    ).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects an over-length address before any network call', async () => {
    const result = await updateOwnLocation('barber-1', {
      address: 'a'.repeat(MAX_ADDRESS_LENGTH + 1),
      latitude: null,
      longitude: null,
    });
    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('maps a PostgREST error and treats a missing returned row as unknown', async () => {
    mockFrom.mockReturnValue(upsertChain({ data: null, error: { code: '42501', message: 'denied' } }));
    expect(
      await updateOwnLocation('barber-1', { address: 'x', latitude: null, longitude: null })
    ).toMatchObject({ status: 'error', code: 'forbidden' });

    mockFrom.mockReturnValue(upsertChain({ data: null, error: null }));
    expect(
      await updateOwnLocation('barber-1', { address: 'x', latitude: null, longitude: null })
    ).toMatchObject({ status: 'error', code: 'unknown' });
  });
});
