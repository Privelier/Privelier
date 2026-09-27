import { buildStaticMapUrl, hasMapboxPublicToken } from '../mapRuntime';

describe('Mapbox runtime configuration', () => {
  const originalToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    else process.env.EXPO_PUBLIC_MAPBOX_TOKEN = originalToken;
  });

  it('reports whether a public runtime token is available without reading a secret', () => {
    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    expect(hasMapboxPublicToken()).toBe(false);
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN = 'pk.test-public-token';
    expect(hasMapboxPublicToken()).toBe(true);
  });

  it('builds an attributed Mapbox static preview from display coordinates', () => {
    const url = buildStaticMapUrl(
      [
        { barberId: 'one', latitude: 52.52001, longitude: 13.40401, fromPrice: 30 },
        { barberId: 'two', latitude: 52.52101, longitude: 13.40501, fromPrice: null },
      ],
      true,
      'pk.public-test'
    );

    expect(url).toContain('/styles/v1/mapbox/dark-v11/static/geojson(');
    expect(url).toContain('/auto/640x800@2x?padding=40&logo=true&attribution=true');
    const encodedOverlay = url?.split('/static/geojson(')[1].split(')/auto/')[0];
    const overlay = JSON.parse(decodeURIComponent(encodedOverlay ?? ''));
    expect(overlay.geometry.coordinates).toEqual([[13.40401, 52.52001], [13.40501, 52.52101]]);
    expect(overlay.properties['marker-color']).toBe('#BFA06B');
    expect(url).not.toContain('barberId');
  });

  it('does not request a static map without real pins and a public token', () => {
    expect(buildStaticMapUrl([], true, 'pk.public-test')).toBeNull();
    expect(buildStaticMapUrl([{ barberId: 'one', latitude: 52.52, longitude: 13.4, fromPrice: null }], false, '')).toBeNull();
  });
});
