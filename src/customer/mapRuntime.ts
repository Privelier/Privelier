/**
 * Runtime feature detection for the @rnmapbox/maps NATIVE module (Explore
 * map integration). The JS package throws at import time inside Expo when
 * the native side is absent (verified in its RNMBXModule.ts source), so the
 * map component may only ever be require()d after this returns true.
 *
 * False on: the pre-Mapbox dev client (until the new EAS build is installed)
 * and in jest. True on: any build produced after @rnmapbox/maps was added
 * with the download-token plugin (app.config.js).
 */
import { NativeModules } from 'react-native';
import type { ExploreMapPin } from './exploreData';

export function isMapNativeAvailable(): boolean {
  return NativeModules.RNMBXModule != null;
}

export function hasMapboxPublicToken(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);
}

/** Mapbox static fallback for Expo Go, which cannot load the native SDK. */
export function buildStaticMapUrl(
  pins: ExploreMapPin[],
  isDark: boolean,
  token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN
): string | null {
  if (!token || pins.length === 0) return null;

  const overlay = encodeURIComponent(JSON.stringify({
    type: 'Feature',
    properties: { 'marker-size': 'small', 'marker-color': '#BFA06B' },
    geometry: {
      type: 'MultiPoint',
      coordinates: pins.map(({ longitude, latitude }) => [
        Number(longitude.toFixed(5)),
        Number(latitude.toFixed(5)),
      ]),
    },
  }));
  const style = isDark ? 'dark-v11' : 'light-v11';
  const url = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/geojson(${overlay})/auto/640x800@2x?padding=40&logo=true&attribution=true&access_token=${encodeURIComponent(token)}`;

  return url.length <= 8192 ? url : null;
}
