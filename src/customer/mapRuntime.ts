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

export function isMapNativeAvailable(): boolean {
  return NativeModules.RNMBXModule != null;
}
