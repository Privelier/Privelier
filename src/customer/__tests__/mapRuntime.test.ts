import { hasMapboxPublicToken } from '../mapRuntime';

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
});
