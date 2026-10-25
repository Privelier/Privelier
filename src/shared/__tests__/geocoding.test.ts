/**
 * Tests for the Photon forward-geocoding client (src/shared/geocoding.ts).
 * `fetch` is mocked throughout — no network. Covers the closed error-code
 * mapping, the [lng, lat] GeoJSON order, label building from Photon's
 * structured properties, malformed-feature skipping and de-duplication.
 */
import { forwardGeocode, geocodeBestMatch, photonLabel } from '../geocoding';

function feature(coordinates: unknown, properties: Record<string, unknown>) {
  return { geometry: { coordinates }, properties };
}

function okResponse(features: unknown[]): Partial<Response> {
  return { ok: true, status: 200, json: async () => ({ features }) };
}

describe('photonLabel', () => {
  it('builds street, postcode city and country', () => {
    expect(photonLabel({ street: 'Hauptmarkt', housenumber: '18', postcode: '90403', city: 'Nürnberg', country: 'Deutschland' }))
      .toBe('Hauptmarkt 18, 90403 Nürnberg, Deutschland');
  });

  it('leads with a place name that differs from the street', () => {
    expect(photonLabel({ name: 'Neues Rathaus', street: 'Hauptmarkt', housenumber: '18', city: 'Nürnberg' }))
      .toBe('Neues Rathaus, Hauptmarkt 18, Nürnberg');
  });

  it('falls back to town/village and to the name alone', () => {
    expect(photonLabel({ name: 'Fürth', town: 'Fürth', country: 'Deutschland' })).toBe('Fürth, Deutschland');
    expect(photonLabel({ name: 'Somewhere' })).toBe('Somewhere');
    expect(photonLabel({})).toBeNull();
  });
});

describe('forwardGeocode', () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    warnSpy.mockRestore();
  });

  it('resolves ok with zero candidates for a blank query, without calling fetch', async () => {
    expect(await forwardGeocode('   ')).toEqual({ status: 'ok', candidates: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a rejected fetch to a retryable network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    expect(await forwardGeocode('Hauptmarkt')).toMatchObject({ status: 'error', code: 'network', retryable: true });
  });

  it('maps a non-2xx status to bad_response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    expect(await forwardGeocode('Hauptmarkt')).toMatchObject({ status: 'error', code: 'bad_response', retryable: false });
  });

  it('maps an unparseable body and a missing features array to bad_response', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } });
    expect(await forwardGeocode('x')).toMatchObject({ status: 'error', code: 'bad_response' });
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: 'no' }) });
    expect(await forwardGeocode('x')).toMatchObject({ status: 'error', code: 'bad_response' });
  });

  it('parses [lng, lat] order, skips malformed features and de-duplicates labels', async () => {
    fetchMock.mockResolvedValue(okResponse([
      feature([11.0772, 49.4547], { street: 'Hauptmarkt', housenumber: '18', city: 'Nürnberg' }),
      feature([11.0773, 49.4548], { street: 'Hauptmarkt', housenumber: '18', city: 'Nürnberg' }),
      feature('nope', { name: 'Broken' }),
      feature([999, 12], { name: 'Out of range' }),
      feature([11.07, 49.45], {}),
      feature([11.0, 49.4], { name: 'Plärrer', city: 'Nürnberg' }),
    ]));
    expect(await forwardGeocode('somewhere')).toEqual({
      status: 'ok',
      candidates: [
        { label: 'Hauptmarkt 18, Nürnberg', latitude: 49.4547, longitude: 11.0772 },
        { label: 'Plärrer, Nürnberg', latitude: 49.4, longitude: 11.0 },
      ],
    });
  });

  it('sends the trimmed query, limit, language and an optional location bias', async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await forwardGeocode('  Hauptmarkt 18, Nürnberg  ', { near: { latitude: 49.45212, longitude: 11.07674 } });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/photon\.komoot\.io\/api\/\?/);
    expect(url).toContain('q=Hauptmarkt%2018%2C%20N%C3%BCrnberg');
    expect(url).toContain('limit=5');
    expect(url).toMatch(/lang=(de|en)/);
    expect(url).toContain('lat=49.4521');
    expect(url).toContain('lon=11.0767');
  });

  it('geocodeBestMatch returns the first candidate or null', async () => {
    fetchMock.mockResolvedValue(okResponse([feature([11.0772, 49.4547], { street: 'Hauptmarkt', city: 'Nürnberg' })]));
    expect(await geocodeBestMatch('Hauptmarkt')).toEqual({ label: 'Hauptmarkt, Nürnberg', latitude: 49.4547, longitude: 11.0772 });
    expect(fetchMock.mock.calls[0][0]).toContain('limit=1');
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await geocodeBestMatch('Hauptmarkt')).toBeNull();
  });
});
