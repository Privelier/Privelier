/**
 * Barber "On my way" screen — the live side of arrival tracking.
 *
 * Full-bleed map (brass route ahead, the barber's gliding marker, the
 * customer's door) under a floating sheet: the explanation and start action
 * before the trip, the ETA hero and driver actions during it. Safety (share
 * trip, hold-for-SOS) stays one tap away. Trip state and actions live in
 * useBarberTrip; leaving the screen does NOT stop the trip.
 */
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { GlassIconButton } from '../../shared/components/GlassIconButton';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { TripSafetyBar } from '../../shared/components/trip/TripSafetyBar';
import { formatBookingWhen } from '../../shared/format';
import { getAppLanguage } from '../../shared/locale';
import { PrivelierMap, type PrivelierMapHandle } from '../../shared/maps/PrivelierMap';
import { Reveal } from '../../shared/motion/Reveal';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { TripIntro, TripLive } from '../components/trip/TripSheet';
import { useBarberTrip } from '../hooks/useBarberTrip';
import { clearFinishedTrip } from '../trip/tripService';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'Trip'>;

export default function TripScreen({ route, navigation }: Props) {
  const { booking, customerName, serviceName } = route.params;
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const mapRef = useRef<PrivelierMapHandle>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const trip = useBarberTrip(booking, customerName, de);
  const { live } = trip;
  const firstName = customerName.split(' ')[0] || customerName;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} testID="barber-trip-screen">
      <View style={StyleSheet.absoluteFill}>
        <PrivelierMap ref={mapRef} scene={trip.scene} testID="barber-trip-map" />
      </View>

      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <GlassIconButton
          icon="chevron-down"
          floating
          size={44}
          accessibilityLabel={live && !live.arrived ? (de ? 'Minimieren, Fahrt läuft weiter' : 'Minimise, trip keeps running') : (de ? 'Zurück' : 'Back')}
          onPress={() => navigation.goBack()}
          testID="barber-trip-back"
        />
        <GlassIconButton
          icon="crosshair"
          floating
          size={44}
          accessibilityLabel={de ? 'Karte zentrieren' : 'Recentre map'}
          onPress={() => mapRef.current?.recenter()}
          testID="barber-trip-recenter"
        />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheetWrap} pointerEvents="box-none">
        <Reveal index={1}>
          <GlassSurface variant="floating" style={styles.sheet} testID="barber-trip-sheet">
            <ScrollView bounces={false} contentContainerStyle={styles.sheetContent}>
              <Text style={[styles.overline, { color: colors.textSecondary, fontFamily: fonts.body }]} numberOfLines={1}>
                {serviceName} · {formatBookingWhen(booking.date, booking.time)}
              </Text>

              {!live ? (
                <TripIntro
                  firstName={firstName}
                  address={booking.location}
                  startError={trip.startError}
                  starting={trip.starting}
                  de={de}
                  onStart={() => void trip.start()}
                />
              ) : (
                <TripLive
                  live={live}
                  phase={trip.phase}
                  firstName={firstName}
                  de={de}
                  onNavigate={() => void trip.navigate()}
                  onArrived={() => void trip.arrive()}
                  onStop={() => setConfirmStop(true)}
                  onDone={() => {
                    clearFinishedTrip();
                    navigation.goBack();
                  }}
                />
              )}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TripSafetyBar bookingId={booking.id} onShare={trip.share} testIDPrefix="barber-trip-safety" />
            </ScrollView>
          </GlassSurface>
        </Reveal>
      </SafeAreaView>

      <ConfirmSheet
        open={confirmStop}
        title={de ? 'Standort nicht mehr teilen?' : 'Stop sharing your location?'}
        message={de ? `${firstName} sieht deine Ankunft dann nicht mehr. Dein Standort wird sofort gelöscht.` : `${firstName} will no longer see your arrival. Your location is deleted right away.`}
        confirmLabel={de ? 'Teilen stoppen' : 'Stop sharing'}
        cancelLabel={de ? 'Weiter teilen' : 'Keep sharing'}
        onConfirm={() => {
          setConfirmStop(false);
          void trip.stop();
        }}
        onClose={() => setConfirmStop(false)}
        destructive
        testID="barber-trip-stop-confirm"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.base, paddingTop: space.sm },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, paddingBottom: space.md },
  sheet: { borderRadius: radius.xl, maxHeight: 520, overflow: 'hidden' },
  sheetContent: { padding: space.lg, gap: space.md },
  overline: { fontSize: 13 },
  divider: { height: HAIRLINE, marginVertical: space.xs },
});
