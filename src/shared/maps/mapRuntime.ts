/**
 * Runtime detection for the native MapLibre module.
 *
 * @maplibre/maplibre-react-native resolves its TurboModules with
 * getEnforcing() at import time, which throws when the native side is absent
 * (Expo Go, Jest, a dev client built before MapLibre was added). Anything
 * that imports the package must therefore be require()d only after this
 * returns true; everywhere else the MapLibre GL web fallback renders instead.
 */
import { TurboModuleRegistry } from 'react-native';

export function isMapNativeAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('MLRNMapViewModule') != null;
  } catch {
    return false;
  }
}
