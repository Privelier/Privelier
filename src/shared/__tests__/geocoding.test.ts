/**
 * Tests for the Mapbox forward-geocoding client (src/shared/geocoding.ts).
 * `fetch` is mocked throughout — no network. Covers the closed error-code
 * mapping, the [lng, lat] GeoJSON order, label preference, malformed-feature
 * skipping, and that the token never reaches a log line.
 */
import { forwardGeocode, geocodeErrorCopy } from '../geocoding';

const TOKEN = 'pk.test-token-value';

function feature(overrides: {
  coordinates?: unknown;
  full_address?: unknown;
  place_formatted?: unknown;
  name?: unknown;
}) {
  return {
    geometry: { coordinates: overrides.coordinates ?? [4.9041, 52.3676] },
    properties: {
      full_address: overrides.full_address,
      place_formatted: overrides.place_formatted,
      name: overrides.name,
    },
  };
}

function okResponse(features: unknown[]): Partial<Response> {
  return {
    ok: true,
    status: 200,
    json: async () => ({ features }),
  };
}

describe('forwardGeocode', () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN = TOKEN;
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    warnSpy.mockRestore();
  });

  it('resolves ok with zero candidates for a blank query, without calling fetch', async () => {
    const result = await forwardGeocode('   ');
    expect(result).toEqual({ status: 'ok', candidates: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails with missing_token when the env var is absent, without calling fetch', async () => {
    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    const result = await forwardGeocode('Dam Square');
    expect(result).toMatchObject({
      status: 'error',
      code: 'missing_token',
      message: geocodeErrorCopy.missing_token,
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a rejected fetch to a retryable network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const result = await forwardGeocode('Dam Square');
    expect(result).toMatchObject({ status: 'error', code: 'network', retryable: true });
  });

  it('maps a non-2xx status to bad_response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const result = await forwardGeocode('Dam Square');
    expect(result).toMatchObject({ status: 'error', code: 'bad_response', retryable: false });
  });

  it('maps an unparseable body and a missing features array to bad_response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    });
    expect(await forwardGeocode('x')).toMatchObject({ status: 'error', code: 'bad_response' });

    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: 'no' }) });
    expect(await forwardGeocode('x')).toMatchObject({ status: 'error', code: 'bad_response' });
  });

  it('parses candidates with GeoJSON [lng, lat] order and the label preference chain', async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        feature({ coordinates: [4.9041, 52.3676], full_address: 'Dam 1, Amsterdam' }),
        feature({ coordinates: [-0.1276, 51.5072], place_formatted: 'London, England' }),
        feature({ coordinates: [2.3522, 48.8566], name: 'Paris' }),
      ])
    );
    const result = await forwardGeocode('somewhere');
    expect(result).toEqual({
      status: 'ok',
      candidates: [
        { label: 'Dam 1, Amsterdam', latitude: 52.3676, longitude: 4.9041 },
        { label: 'London, England', latitude: 51.5072, longitude: -0.1276 },
        { label: 'Paris', latitude: 48.8566, longitude: 2.3522 },
      ],
    });
  });

  it('skips malformed features instead of failing the whole result', async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        feature({ coordinates: 'not-an-array', full_address: 'A' }),
        feature({ coordinates: [999, 12], full_address: 'out of range lng' }),
        feature({ coordinates: [4.9, 52.3] }), // no label at all
        feature({ coordinates: [4.9041, 52.3676], full_address: 'The good one' }),
      ])
    );
    const result = await forwardGeocode('somewhere');
    expect(result).toEqual({
      status: 'ok',
      candidates: [{ label: 'The good one', latitude: 52.3676, longitude: 4.9041 }],
    });
  });

  it('sends the trimmed, URL-encoded query and never logs the token', async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await forwardGeocode('  Dam Square 1, Amsterdam  ');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('q=Dam%20Square%201%2C%20Amsterdam');
    expect(url).toContain('limit=5');

    // Force an error path so a log line is emitted, then prove no log call
    // ever carried the token (the URL is never logged, only the query).
    fetchMock.mockRejectedValue(new Error('boom'));
    await forwardGeocode('Dam Square');
    const loggedText = warnSpy.mock.calls.map((args) => args.map(String).join(' ')).join(' ');
    expect(loggedText).not.toContain(TOKEN);
  });
});
