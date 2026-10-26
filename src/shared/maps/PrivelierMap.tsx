/**
 * The one map component screens use. Describe what to show as a MapScene;
 * this picks the renderer:
 *
 *  - native MapLibre when the module is in the build (smooth 60 fps, the
 *    production path), loaded lazily per the import contract in
 *    NativeSceneMap.tsx;
 *  - otherwise the MapLibre GL web page (Expo Go, web), same look.
 *
 * Both draw free OpenFreeMap tiles with the brand-tinted style. While the
 * style loads (first launch only — it is cached afterwards) a calm skeleton
 * holds the space.
 */
import { forwardRef, useImperativeHandle, useRef, type ComponentType, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '../components/Skeleton';
import { isMapNativeAvailable } from './mapRuntime';
import type { MapEvent, MapScene } from './mapScene';
import { useMapStyle } from './mapStyle';
import { WebMap, type WebMapHandle } from './WebMap';
import { devWarn } from '../devLog';

export interface PrivelierMapHandle {
  recenter: () => void;
}

interface Props {
  scene: MapScene;
  onEvent?: (event: MapEvent) => void;
  testID?: string;
}

type NativeComponent = ComponentType<Props & { mapStyle: unknown; ref?: Ref<PrivelierMapHandle> }>;
let nativeComponent: NativeComponent | null | undefined;

function loadNative(): NativeComponent | null {
  if (nativeComponent !== undefined) return nativeComponent;
  if (!isMapNativeAvailable()) {
    nativeComponent = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeComponent = (require('./NativeSceneMap') as { NativeSceneMap: NativeComponent }).NativeSceneMap;
  } catch (raw) {
    devWarn('[PrivelierMap] native map failed to load, using web fallback', raw);
    nativeComponent = null;
  }
  return nativeComponent;
}

export const PrivelierMap = forwardRef<PrivelierMapHandle, Props>(function PrivelierMap({ scene, onEvent, testID }, ref) {
  const mapStyle = useMapStyle();
  const inner = useRef<PrivelierMapHandle | WebMapHandle>(null);
  useImperativeHandle(ref, () => ({ recenter: () => inner.current?.recenter() }), []);

  if (!mapStyle) {
    return (
      <View style={styles.container} testID={testID ? `${testID}-loading` : undefined}>
        <Skeleton style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  const Native = loadNative();
  if (Native) {
    return <Native ref={inner} mapStyle={mapStyle} scene={scene} onEvent={onEvent} testID={testID} />;
  }
  return <WebMap ref={inner} mapStyle={mapStyle} scene={scene} onEvent={onEvent} testID={testID} />;
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121214', overflow: 'hidden' },
});
