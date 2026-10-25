/**
 * Browser build of the fallback map: the same MapLibre GL page as the Expo
 * Go WebView, hosted in a sandboxed iframe and driven by postMessage.
 */
import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
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
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const reduceMotion = useReducedMotionPreference();
  const html = useMemo(() => buildWebMapHtml(mapStyle, reduceMotion), [mapStyle, reduceMotion]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const post = useCallback((message: unknown) => {
    frameRef.current?.contentWindow?.postMessage({ __privelierMapIn: true, payload: message }, '*');
  }, []);

  useEffect(() => {
    post({ kind: 'scene', scene });
  }, [post, scene]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { __privelierMap?: boolean; payload?: string };
      if (!data?.__privelierMap || typeof data.payload !== 'string') return;
      try {
        const parsed = JSON.parse(data.payload) as MapEvent;
        if (parsed.type === 'ready') post({ kind: 'scene', scene: sceneRef.current });
        onEventRef.current?.(parsed);
      } catch {
        // Not ours.
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [post]);

  useImperativeHandle(ref, () => ({ recenter: () => post({ kind: 'recenter' }) }), [post]);

  return (
    <View style={styles.container} testID={testID}>
      {createElement('iframe', {
        ref: frameRef,
        srcDoc: html,
        title: 'Map',
        sandbox: 'allow-scripts',
        style: { border: 0, width: '100%', height: '100%', background: '#121214' },
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121214' },
});
