/**
 * Explore map pane (design: docs/design/explore-location-design-approval.md,
 * condition C8) on free MapLibre + OpenFreeMap tiles — native in app
 * builds, the MapLibre GL web renderer in Expo Go and on web (PrivelierMap
 * picks; no API key or per-load fee anywhere).
 *
 * Privacy: the coordinates rendered here are ONLY the offset display pair
 * from barber_directory (an ExploreMapPin cannot even carry anything else —
 * exact coordinates never reach the customer app, structurally, per
 * migration 0019's RLS). Pins show the barber's real from-price when one is
 * known, else the barber's name — never an invented number.
 *
 * Interaction: tap a pin -> the barber's card docks at the bottom (the
 * screen's one deliberate moment); tap the map background -> it undocks;
 * tap the card -> the barber profile. The camera frames every pin once; the
 * empty case never reaches this component (ExploreScreen renders its
 * map-empty state instead of a pointless globe).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { duration } from '../../theme/motion';
import type { BarberDirectoryRow, ServiceRow } from '../../types';
import { formatMoney } from '../format';
import type { ExploreMapPin } from '../exploreData';
import { PrivelierMap } from '../../shared/maps/PrivelierMap';
import type { MapEvent, MapScene } from '../../shared/maps/mapScene';
import BarberCard from './BarberCard';

export interface ExploreMapViewProps {
  pins: ExploreMapPin[];
  barbersById: Map<string, BarberDirectoryRow>;
  servicesByBarber: Map<string, ServiceRow[]>;
  onOpenProfile: (barberId: string) => void;
}

export default function ExploreMapView({
  pins,
  barbersById,
  servicesByBarber,
  onOpenProfile,
}: ExploreMapViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scene = useMemo<MapScene>(() => ({
    camera: 'fit',
    pins: pins.map((pin) => {
      const barber = barbersById.get(pin.barberId);
      const price = pin.fromPrice !== null ? formatMoney(pin.fromPrice) : null;
      return {
        id: pin.barberId,
        lngLat: [pin.longitude, pin.latitude],
        label: price ?? barber?.name ?? '·',
        accessibilityLabel: barber ? `${barber.name}${price ? `, from ${price}` : ''}` : 'Barber pin',
        active: pin.barberId === selectedId,
      };
    }),
  }), [pins, barbersById, selectedId]);

  const onEvent = useCallback((event: MapEvent) => {
    if (event.type === 'pin') setSelectedId(event.id);
    else if (event.type === 'map') setSelectedId(null);
  }, []);

  const selected = selectedId !== null ? (barbersById.get(selectedId) ?? null) : null;

  return (
    <View style={styles.container} testID="customer-explore-map">
      <PrivelierMap scene={scene} onEvent={onEvent} testID="customer-explore-map-surface" />

      {selected ? (
        // Keyed by barber id so switching pins (not just first dock) remounts
        // the wrapper and replays the entrance — a fresh docking each time.
        <DockedCard key={selected.id} style={styles.docked} testID="customer-explore-docked-card">
          <BarberCard
            barber={selected}
            services={servicesByBarber.get(selected.id) ?? []}
            variant="wide"
            onPress={() => onOpenProfile(selected.id)}
          />
        </DockedCard>
      ) : null}
    </View>
  );
}

/**
 * A calm, one-shot entrance for the docked card (fade + a short rise) —
 * motion as a supporting signal, matching theme/motion.ts's "confirms a
 * state change, then gets out of the way" philosophy. No bounce/spring.
 */
function DockedCard({
  style,
  testID,
  children,
}: {
  style: StyleProp<ViewStyle>;
  testID: string;
  children: ReactNode;
}) {
  // useState's lazy initializer (not useRef) — see Skeleton.tsx for why.
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(8));

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active) return;
      if (reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: duration.base, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: duration.base, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });
    return () => { active = false; };
  }, [opacity, translateY]);

  return (
    <Animated.View testID={testID} style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  docked: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
});
