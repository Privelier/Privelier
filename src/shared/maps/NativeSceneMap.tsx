/**
 * Native MapLibre renderer for a MapScene (development and store builds).
 *
 * IMPORT CONTRACT: @maplibre/maplibre-react-native resolves its TurboModules
 * eagerly and throws when the native side is missing (Expo Go, Jest). This
 * file must only ever be require()d behind isMapNativeAvailable() — which
 * PrivelierMap does. Never import it statically.
 *
 * Camera: frames everything once; in 'follow' mode it keeps the barber and
 * the destination in view as the barber moves, but backs off for 15 s
 * whenever the user pans or zooms by hand so it never fights their finger.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { useTheme } from '../../theme/useTheme';
import { numericText } from '../../theme/typography';
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference';
import { boundsOf, headingDelta, lerpLngLat, type LngLat } from '../tracking/geo';
import { Avatar } from '../components/Avatar';
import { MAP_COLORS, safePinImageUrl, type MapEvent, type MapScene } from './mapScene';

interface NativeSceneMapHandle {
  recenter: () => void;
}

interface Props {
  mapStyle: StyleSpecification | string;
  scene: MapScene;
  onEvent?: (event: MapEvent) => void;
  testID?: string;
}

const PADDING = { top: 72, bottom: 260, left: 48, right: 48 };
const USER_PAN_PAUSE_MS = 15_000;
const GLIDE_MS = 900;
const PIN_AVATAR = 34;

function sceneBounds(scene: MapScene) {
  const points: LngLat[] = [];
  scene.pins?.forEach((pin) => points.push(pin.lngLat));
  if (scene.vehicle) points.push(scene.vehicle.lngLat);
  if (scene.destination) points.push(scene.destination);
  (scene.routeAhead ?? scene.route ?? []).forEach((p) => points.push(p));
  return { points, bounds: boundsOf(points) };
}

const lineFeature = (coordinates: LngLat[] | null | undefined): GeoJSON.Feature => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: coordinates && coordinates.length > 1 ? coordinates : [] },
});

/** @public Loaded with require() by PrivelierMap, only when the native module exists. */
export const NativeSceneMap = forwardRef<NativeSceneMapHandle, Props>(function NativeSceneMap(
  { mapStyle, scene, onEvent, testID },
  ref
) {
  const { colors, fonts } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  const cameraRef = useRef<CameraRef>(null);
  const userPannedAt = useRef(0);
  const fitted = useRef(false);

  const frame = useCallback((animate: boolean) => {
    const { points, bounds } = sceneBounds(scene);
    if (!bounds || points.length === 0) return;
    if (points.length === 1) {
      cameraRef.current?.jumpTo({ center: points[0], zoom: 14 });
      return;
    }
    cameraRef.current?.fitBounds(bounds, {
      padding: PADDING,
      duration: animate && !reduceMotion ? 700 : 0,
      easing: 'ease',
    });
  }, [scene, reduceMotion]);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      userPannedAt.current = 0;
      frame(true);
    },
  }), [frame]);

  // Initial framing, then follow policy on every scene change.
  useEffect(() => {
    if (!fitted.current) {
      const { points } = sceneBounds(scene);
      if (points.length === 0) return;
      // Give the native camera a frame to mount before the first fit.
      const id = setTimeout(() => frame(false), 0);
      fitted.current = true;
      return () => clearTimeout(id);
    }
    if (scene.camera === 'follow' && Date.now() - userPannedAt.current > USER_PAN_PAUSE_MS) {
      frame(true);
    }
  }, [scene, frame]);

  const vehicle = useGlidingPosition(scene.vehicle?.lngLat ?? null, reduceMotion);

  const routeData = useMemo(() => lineFeature(scene.route), [scene.route]);
  const aheadData = useMemo(() => lineFeature(scene.routeAhead), [scene.routeAhead]);

  return (
    <View style={styles.container} testID={testID}>
      <Map
        style={styles.map}
        mapStyle={mapStyle}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        compass={false}
        scaleBar={false}
        touchRotate={false}
        touchPitch={false}
        tintColor={colors.accent}
        onPress={() => onEvent?.({ type: 'map' })}
        onRegionWillChange={(event) => {
          if (event.nativeEvent.userInteraction) userPannedAt.current = Date.now();
        }}
        onDidFinishLoadingMap={() => onEvent?.({ type: 'ready' })}
        onDidFailLoadingMap={() => onEvent?.({ type: 'error' })}
      >
        <Camera ref={cameraRef} initialViewState={{ center: [10.45, 51.16], zoom: 4 }} />

        <GeoJSONSource id="privelier-route" data={routeData}>
          <Layer
            type="line"
            id="privelier-route-base"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': MAP_COLORS.routeBase, 'line-width': 7 }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="privelier-ahead" data={aheadData}>
          <Layer
            type="line"
            id="privelier-ahead-glow"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': MAP_COLORS.brass, 'line-width': 12, 'line-opacity': 0.18, 'line-blur': 4 }}
          />
          <Layer
            type="line"
            id="privelier-ahead-line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': MAP_COLORS.brass, 'line-width': 4.5 }}
          />
        </GeoJSONSource>

        {scene.destination ? (
          <Marker id="privelier-destination" lngLat={scene.destination} anchor="center">
            <View
              style={[styles.destination, { backgroundColor: colors.surface, borderColor: colors.accent }]}
              accessible
              accessibilityLabel="Appointment address"
            >
              <Feather name="home" size={16} color={colors.accent} />
            </View>
          </Marker>
        ) : null}

        {(scene.pins ?? []).map((pin) => (
          <Marker key={pin.id} id={`pin-${pin.id}`} lngLat={pin.lngLat} anchor="center">
            <Pressable
              onPress={() => onEvent?.({ type: 'pin', id: pin.id })}
              accessibilityRole="button"
              accessibilityState={{ selected: !!pin.active }}
              accessibilityLabel={pin.accessibilityLabel}
              testID={`map-pin-${pin.id}`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.pin,
                pin.active
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Avatar
                id={pin.id}
                name={pin.title}
                imageUrl={safePinImageUrl(pin.imageUrl)}
                size={PIN_AVATAR}
                monogramFontSize={11}
                accessible={false}
              />
              <View style={styles.pinTextBlock}>
                <Text
                  numberOfLines={1}
                  style={[styles.pinTitle, { fontFamily: fonts.bodySemiBold, color: pin.active ? colors.onAccent : colors.textPrimary }]}
                >
                  {pin.title}
                </Text>
                {pin.subtitle ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.pinSubtitle, numericText, { fontFamily: fonts.bodyMedium, color: pin.active ? colors.onAccent : colors.accentText }]}
                  >
                    {pin.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </Marker>
        ))}

        {vehicle && scene.vehicle ? (
          <Marker id="privelier-vehicle" lngLat={vehicle} anchor="center">
            <VehicleMarker heading={scene.vehicle.heading} stale={!!scene.vehicle.stale} reduceMotion={reduceMotion} />
          </Marker>
        ) : null}
      </Map>
    </View>
  );
});

/**
 * Eases the marker from where it is shown now to each new fix (no
 * teleporting). State only changes inside animation frames; between glides
 * the target itself is returned.
 */
function useGlidingPosition(target: LngLat | null, reduceMotion: boolean): LngLat | null {
  const [glide, setGlide] = useState<LngLat | null>(null);
  const shown = useRef<LngLat | null>(null);
  useEffect(() => {
    const from = shown.current;
    shown.current = target;
    if (!target || !from || reduceMotion) return;
    const start = Date.now();
    let raf = requestAnimationFrame(function step() {
      const k = Math.min(1, (Date.now() - start) / GLIDE_MS);
      const next = lerpLngLat(from, target, 1 - (1 - k) ** 3);
      shown.current = next;
      if (k < 1) {
        setGlide(next);
        raf = requestAnimationFrame(step);
      } else {
        shown.current = target;
        setGlide(null);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [target, reduceMotion]);
  return glide ?? target;
}

function VehicleMarker({ heading, stale, reduceMotion }: { heading: number | null; stale: boolean; reduceMotion: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));
  const [rotation] = useState(() => new Animated.Value(heading ?? 0));
  const lastHeading = useRef(heading ?? 0);

  useEffect(() => {
    if (reduceMotion || stale) {
      pulse.setValue(0.4);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion, stale]);

  useEffect(() => {
    if (heading == null) return;
    // Rotate the short way round (350° → 10° turns 20°, not 340°).
    const target = lastHeading.current + headingDelta(lastHeading.current, heading);
    lastHeading.current = target;
    if (reduceMotion) rotation.setValue(target);
    else Animated.timing(rotation, { toValue: target, duration: 400, useNativeDriver: true }).start();
  }, [heading, reduceMotion, rotation]);

  const tone = stale ? MAP_COLORS.stale : MAP_COLORS.brass;
  return (
    <View style={styles.vehicle} accessible accessibilityLabel={stale ? 'Barber, last known position' : 'Barber, live position'}>
      {!stale ? (
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: MAP_COLORS.brassSoft,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.25] }) }],
            },
          ]}
        />
      ) : null}
      {heading != null && !stale ? (
        <Animated.View
          style={[
            styles.arrowWrap,
            { transform: [{ rotate: rotation.interpolate({ inputRange: [-3600, 3600], outputRange: ['-3600deg', '3600deg'] }) }] },
          ]}
        >
          <View style={[styles.arrow, { borderBottomColor: tone }]} />
        </Animated.View>
      ) : null}
      <View style={[styles.dot, { backgroundColor: tone, shadowColor: tone }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121214' },
  map: { flex: 1 },
  pin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 0.5,
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    minHeight: 44,
    maxWidth: 180,
  },
  pinTextBlock: { flexShrink: 1, minWidth: 0 },
  pinTitle: { fontSize: 12, lineHeight: 15 },
  pinSubtitle: { fontSize: 11, lineHeight: 14 },
  destination: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicle: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 50, height: 50, borderRadius: 25 },
  arrowWrap: { position: 'absolute', width: 50, height: 50, alignItems: 'center' },
  arrow: {
    marginTop: 3,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#121214' },
});
