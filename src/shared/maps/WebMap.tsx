/**
 * Fallback map renderer for Expo Go (no native map module there): MapLibre
 * GL JS inside a WebView, fed the same MapScene as the native renderer. See
 * WebMap.web.tsx for the browser build.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference';
import type { MapEvent, MapScene } from './mapScene';
import { buildWebMapHtml } from './webMapHtml';

export interface WebMapHandle {
  recenter: () => void;
}

interface Props {
  mapStyle: StyleSpecification | string;
  scene: MapScene;
  onEvent?: (event: MapEvent) => void;
  testID?: string;
}

export const WebMap = forwardRef<WebMapHandle, Props>(function WebMap({ mapStyle, scene, onEvent, testID }, ref) {
  const webRef = useRef<WebView>(null);
  const reduceMotion = useReducedMotionPreference();
  // The page is built once per style; scenes stream in as messages so the
  // map never reloads while the barber moves.
  const html = useMemo(() => buildWebMapHtml(mapStyle, reduceMotion), [mapStyle, reduceMotion]);

  const post = useCallback((message: unknown) => {
    const json = JSON.stringify(JSON.stringify(message));
    webRef.current?.injectJavaScript(`window.__privelierMap && window.__privelierMap(${json}); true;`);
  }, []);

  useEffect(() => {
    post({ kind: 'scene', scene });
  }, [post, scene]);

  useImperativeHandle(ref, () => ({ recenter: () => post({ kind: 'recenter' }) }), [post]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as MapEvent;
      if (parsed.type === 'ready') post({ kind: 'scene', scene });
      onEvent?.(parsed);
    } catch {
      // Ignore anything that is not ours.
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: 'https://tiles.openfreemap.org/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={styles.web}
        containerStyle={styles.web}
        // Links (attribution) open nowhere inside the map surface.
        onShouldStartLoadWithRequest={(request) => request.url.startsWith('about:') || request.url.startsWith('https://tiles.openfreemap.org/')}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121214' },
  web: { flex: 1, backgroundColor: '#121214' },
});
