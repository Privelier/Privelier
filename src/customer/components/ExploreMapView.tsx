/**
 * Explore map pane (map-integration follow-up of Run B — design:
 * docs/design/explore-location-design-approval.md, condition C8).
 *
 * IMPORT CONTRACT: this module imports @rnmapbox/maps EAGERLY, and that
 * package THROWS at import time when its native side is absent — so this
 * file must only ever be require()d behind isMapNativeAvailable()
 * (src/customer/mapRuntime.ts). ExploreScreen does exactly that; never add
 * a static import of this file anywhere.
 *
 * Privacy: the coordinates rendered here are ONLY the offset display pair
 * from barber_directory (an ExploreMapPin cannot even carry anything else —
 * exact coordinates never reach the customer app, structurally, per
 * migration 0019's RLS). Pins show the barber's real from-price when one is
 * known, else the barber's name — never an invented number.
 *
 * Interaction: tap a pin -> the barber's card docks at the bottom (the
 * screen's one deliberate moment); tap the map background -> it undocks;
 * tap the card -> the barber profile. Camera starts fitted to the pins
 * (pure pinBounds; the empty case never reaches this component — the screen
 * renders its map-empty state instead of a pointless globe).
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { useTheme } from '../../theme/useTheme';
import type { BarberDirectoryRow, ServiceRow } from '../../types';
import { formatMoney } from '../format';
import { pinBounds, type ExploreMapPin } from '../exploreData';
import BarberCard from './BarberCard';

// Runtime API access uses the PUBLIC pk. token (same one the geocoding
// client uses). Module scope is safe: this module only loads when the
// native side exists, and setAccessToken is idempotent.
void Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? null);

export interface ExploreMapViewProps {
  pins: ExploreMapPin[];
  barbersById: Map<string, BarberDirectoryRow>;
  servicesByBarber: Map<string, ServiceRow[]>;
  onOpenProfile: (barberId: string) => void;
}

const CAMERA_PADDING = 48;

export default function ExploreMapView({
  pins,
  barbersById,
  servicesByBarber,
  onOpenProfile,
}: ExploreMapViewProps) {
  const { colors, fonts, isDark } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Camera target from the pure, tested pinBounds. Applied as DIRECT Camera
  // props, not defaultSettings: on-device (Android, v10.3) defaultSettings
  // silently failed to apply, leaving the camera at the world-view (0,0)
  // default with the pin far off screen (founder-reported 2026-07-15).
  // Direct props apply on mount AND whenever the pin set changes, so filter
  // chips re-frame the map to the barbers they match. The zero-pin case
  // never reaches this component (ExploreScreen renders its map-empty state
  // instead of a map), so there is no (0,0) fallback to have.
  const camera = useMemo(() => pinBounds(pins), [pins]);

  const selected = selectedId !== null ? (barbersById.get(selectedId) ?? null) : null;

  const deselect = useCallback(() => setSelectedId(null), []);

  return (
    <View style={styles.container} testID="customer-explore-map">
      <Mapbox.MapView
        style={styles.map}
        styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light}
        scaleBarEnabled={false}
        onPress={deselect}
      >
        {camera?.kind === 'bounds' ? (
          <Mapbox.Camera
            bounds={{
              ne: camera.ne,
              sw: camera.sw,
              paddingTop: CAMERA_PADDING,
              paddingBottom: CAMERA_PADDING,
              paddingLeft: CAMERA_PADDING,
              paddingRight: CAMERA_PADDING,
            }}
            animationDuration={0}
          />
        ) : camera?.kind === 'center' ? (
          <Mapbox.Camera
            centerCoordinate={camera.center}
            zoomLevel={13}
            animationDuration={0}
          />
        ) : null}
        {pins.map((pin) => {
          const barber = barbersById.get(pin.barberId);
          const active = pin.barberId === selectedId;
          const label =
            pin.fromPrice !== null ? formatMoney(pin.fromPrice) : (barber?.name ?? '·');
          return (
            <Mapbox.MarkerView
              key={pin.barberId}
              coordinate={[pin.longitude, pin.latitude]}
              allowOverlap
            >
              <Pressable
                onPress={() => setSelectedId(pin.barberId)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  barber
                    ? `${barber.name}${pin.fromPrice !== null ? `, from ${formatMoney(pin.fromPrice)}` : ''}`
                    : 'Barber pin'
                }
                testID={`customer-explore-pin-${pin.barberId}`}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.pin,
                  active
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.pinText,
                    { fontFamily: fonts.bodySemiBold },
                    { color: active ? colors.onAccent : colors.textPrimary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            </Mapbox.MarkerView>
          );
        })}
      </Mapbox.MapView>

      {selected ? (
        <View style={styles.docked} testID="customer-explore-docked-card">
          <BarberCard
            barber={selected}
            services={servicesByBarber.get(selected.id) ?? []}
            variant="wide"
            onPress={() => onOpenProfile(selected.id)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  pin: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 30,
    maxWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: { fontSize: 12 },
  docked: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
});
