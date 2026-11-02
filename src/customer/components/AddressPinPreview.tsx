/**
 * "Your barber comes here" — a small, non-interactive map on the booking
 * review step showing where the typed address was placed (free Photon
 * geocode + OpenFreeMap tiles). Seeing the pin before sending catches a
 * wrong street or the wrong city early, and the same coordinates later
 * power live arrival tracking.
 *
 * If the address cannot be placed, the card says so calmly: the barber still
 * receives the address exactly as written, so booking is never blocked.
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { radius, space } from '../../theme/spacing';
import { getAppLanguage } from '../../shared/locale';
import { Skeleton } from '../../shared/components/Skeleton';
import { PrivelierMap } from '../../shared/maps/PrivelierMap';
import type { MapScene } from '../../shared/maps/mapScene';
import type { GeocodeCandidate } from '../../shared/geocoding';
import { typeScale } from '../../theme/typography';

export type AddressPinState =
  | { status: 'loading' }
  | { status: 'found'; candidate: GeocodeCandidate }
  | { status: 'none' };

export function AddressPinPreview({ state }: { state: AddressPinState }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const scene = useMemo<MapScene | null>(
    () =>
      state.status === 'found'
        ? { camera: 'fit', destination: [state.candidate.longitude, state.candidate.latitude] }
        : null,
    [state]
  );

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]} testID="customer-booking-address-pin">
      {state.status === 'loading' ? (
        <Skeleton style={styles.map} />
      ) : scene ? (
        // pointerEvents none: a preview, not a second map to fiddle with.
        <View style={styles.map} pointerEvents="none" accessible accessibilityLabel={de ? 'Kartenvorschau deiner Adresse' : 'Map preview of your address'}>
          <PrivelierMap scene={scene} testID="customer-booking-address-map" />
        </View>
      ) : null}
      <View style={styles.caption}>
        <Feather
          name={state.status === 'none' ? 'info' : 'map-pin'}
          size={16}
          color={state.status === 'none' ? colors.textSecondary : colors.accentText}
        />
        <View style={styles.captionText}>
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
            {state.status === 'none'
              ? de ? 'Adresse nicht auf der Karte gefunden' : 'Address not found on the map'
              : de ? 'Hierhin kommt dein Barber' : 'Your barber will come here'}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary, fontFamily: fonts.body }]} numberOfLines={2}>
            {state.status === 'found'
              ? state.candidate.label
              : state.status === 'none'
                ? de ? 'Kein Problem: Dein Barber erhält die Adresse genau so, wie du sie eingegeben hast.' : 'No problem: your barber gets the address exactly as you typed it.'
                : de ? 'Adresse wird gesucht …' : 'Finding your address…'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 0.5, borderRadius: radius.lg, marginTop: 20, overflow: 'hidden' },
  map: { height: 150 },
  caption: { flexDirection: 'row', gap: space.sm, padding: 14, alignItems: 'flex-start' },
  captionText: { flex: 1, gap: 2 },
  title: { fontSize: 14, lineHeight: 20 },
  body: { ...typeScale.secondary },
});
