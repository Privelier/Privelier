/**
 * Barber "On my way" screen — the live side of arrival tracking.
 *
 * Before starting: a calm explanation of exactly what is shared, with whom
 * and for how long, then one primary action. Location permission is asked
 * only on that tap ("while using" — never "always").
 *
 * While driving: full-bleed map (brass route ahead, the barber's gliding
 * marker, the customer's door), the shared ETA hero, and the three things a
 * driver needs — open turn-by-turn in their own maps app, "I've arrived",
 * stop sharing. Safety (share trip, hold-for-SOS) stays one tap away.
 *
 * Leaving the screen does NOT stop the trip; it keeps running (with the
 * system's location indicator) until arrival, "Stop sharing", or the
 * booking being completed/cancelled.
 */
import { Reveal } from '../../shared/motion/Reveal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { getAppLanguage } from '../../shared/locale';
import { haptics } from '../../shared/haptics';
import { formatBookingWhen } from '../../shared/format';
import { openNavigationTo } from '../../shared/bookingActions';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { GlassIconButton } from '../../shared/components/GlassIconButton';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { useToast } from '../../shared/components/ToastProvider';
import { PrivelierMap, type PrivelierMapHandle } from '../../shared/maps/PrivelierMap';
import type { MapScene } from '../../shared/maps/mapScene';
import { TripStatusPanel, type TripPhase } from '../../shared/components/trip/TripStatusPanel';
import { TripSafetyBar } from '../../shared/components/trip/TripSafetyBar';
import { remainingLine } from '../../shared/tracking/geo';
import { formatEta } from '../../shared/tracking/eta';
import { shareTrip } from '../../shared/tracking/safety';
import { askForPushPermissionInContext } from '../../shared/push';
import {
  arriveNow,
  clearFinishedTrip,
  resumeActiveTrip,
  startTrip,
  stopTrip,
  subscribeToTrip,
  type LiveTripState,
  type StartTripError,
} from '../trip/tripService';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'Trip'>;

export default function TripScreen({ route, navigation }: Props) {
  const { booking, customerName, serviceName } = route.params;
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const mapRef = useRef<PrivelierMapHandle>(null);

  const [live, setLive] = useState<LiveTripState | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<StartTripError | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  useEffect(() => {
    void resumeActiveTrip();
    return subscribeToTrip((next) => setLive(next && next.bookingId === booking.id ? next : null));
  }, [booking.id]);

  const firstName = customerName.split(' ')[0] || customerName;
  const destination = useMemo(
    () =>
      live?.destination ??
      (booking.location_longitude != null && booking.location_latitude != null
        ? ([booking.location_longitude, booking.location_latitude] as [number, number])
        : null),
    [live?.destination, booking.location_latitude, booking.location_longitude]
  );

  const scene = useMemo<MapScene>(() => {
    if (!live) return { camera: 'fit', destination };
    const projection = live.snapshot?.projection ?? null;
    const coordinates = live.route.coordinates;
    return {
      camera: 'follow',
      destination: live.destination,
      route: live.route.source === 'estimate' ? null : coordinates,
      routeAhead: live.arrived || live.route.source === 'estimate' ? null : projection ? remainingLine(coordinates, projection) : coordinates,
      vehicle: live.position ? { lngLat: live.position, heading: live.heading } : null,
    };
  }, [live, destination]);

  const onStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    void haptics.confirm();
    const result = await startTrip(booking);
    setStarting(false);
    if (result.status === 'ok') {
      void haptics.success();
      // The barber benefits too (arrival confirmations, messages en route).
      void askForPushPermissionInContext();
    } else {
      void haptics.warning();
      setStartError(result.code);
    }
  }, [booking, starting]);

  const onNavigate = useCallback(async () => {
    if (!destination) return;
    const result = await openNavigationTo(destination[1], destination[0]);
    if (result === 'unavailable') showToast({ message: de ? 'Keine Karten-App gefunden.' : 'No maps app is available.' });
  }, [destination, de, showToast]);

  const onArrived = useCallback(async () => {
    void haptics.success();
    await arriveNow();
  }, []);

  const onStop = useCallback(async () => {
    setConfirmStop(false);
    await stopTrip(booking.id);
    showToast({ message: de ? 'Standortfreigabe beendet.' : 'Location sharing stopped.' });
  }, [booking.id, de, showToast]);

  const liveEtaS = live?.snapshot?.etaS ?? null;
  const onShare = useCallback(() => {
    void shareTrip({
      bookingId: booking.id,
      role: 'barber',
      counterpartName: customerName,
      address: booking.location,
      whenText: formatBookingWhen(booking.date, booking.time),
      etaText: liveEtaS != null ? formatEta(liveEtaS, de) : null,
    });
  }, [booking, customerName, liveEtaS, de]);

  const phase: TripPhase = !live
    ? 'starting'
    : live.arrived
      ? 'arrived'
      : (live.snapshot?.etaS ?? Infinity) <= 300
        ? 'arriving'
        : 'en_route';

  const errorCopy: Record<StartTripError, string> = de
    ? {
        permission_denied: 'Ohne Standortzugriff kann dein Kunde deine Ankunft nicht sehen. Du kannst ihn in den Einstellungen erlauben.',
        location_unavailable: 'Dein Standort ist gerade nicht verfügbar. Geh kurz ins Freie und versuch es erneut.',
        no_destination: 'Diese Adresse konnte nicht auf der Karte gefunden werden. Nutze die Route in deiner Karten-App.',
        not_allowed: 'Live-Ankunft ist nur am Tag eines bestätigten Termins möglich.',
        network: 'Keine Verbindung. Prüfe dein Netz und versuch es erneut.',
      }
    : {
        permission_denied: 'Without location access your customer cannot see your arrival. You can allow it in Settings.',
        location_unavailable: 'Your location is not available right now. Step outside for a moment and try again.',
        no_destination: 'We could not find this address on the map. Use directions in your maps app instead.',
        not_allowed: 'Live arrival works on the day of an accepted appointment only.',
        network: 'No connection. Check your signal and try again.',
      };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} testID="barber-trip-screen">
      <View style={StyleSheet.absoluteFill}>
        <PrivelierMap ref={mapRef} scene={scene} testID="barber-trip-map" />
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
              <>
                <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                  {de ? `Auf dem Weg zu ${firstName}?` : `On your way to ${firstName}?`}
                </Text>
                <Text style={[styles.address, { color: colors.textSecondary, fontFamily: fonts.body }]} numberOfLines={2} selectable>
                  {booking.location}
                </Text>
                <View style={[styles.promise, { borderColor: colors.border }]}>
                  <PromiseLine icon="navigation" text={de ? `${firstName} sieht deine Ankunftszeit live und wird kurz vorher benachrichtigt.` : `${firstName} sees your live arrival time and gets a heads-up just before you arrive.`} />
                  <PromiseLine icon="eye-off" text={de ? 'Nur während der Anfahrt. Bei Ankunft oder Stopp wird dein Standort gelöscht.' : 'Only while you travel. Your location is deleted when you arrive or stop.'} />
                  <PromiseLine icon="battery" text={de ? 'Sparsam: Updates nur bei Bewegung.' : 'Battery-friendly: updates only as you move.'} />
                </View>
                {startError ? (
                  <View style={styles.errorBox} accessibilityRole="alert" testID="barber-trip-error">
                    <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>{errorCopy[startError]}</Text>
                    {startError === 'permission_denied' ? (
                      <Text
                        onPress={() => void Linking.openSettings()}
                        accessibilityRole="link"
                        style={[styles.link, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}
                      >
                        {de ? 'Einstellungen öffnen' : 'Open Settings'}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <PrimaryButton
                  label={starting ? (de ? 'Beste Route wird gesucht …' : 'Finding the best route…') : (de ? 'Ich bin unterwegs' : "I'm on my way")}
                  icon="navigation"
                  onPress={() => void onStart()}
                  loading={starting}
                  testID="barber-trip-start"
                />
              </>
            ) : (
              <>
                <TripStatusPanel
                  phase={phase}
                  etaS={live.snapshot?.etaS ?? null}
                  remainingM={live.snapshot?.remainingM ?? null}
                  progress={live.snapshot?.progress ?? null}
                  caption={live.arrived
                    ? (de ? `${firstName} wurde benachrichtigt.` : `${firstName} has been notified.`)
                    : (de ? `${firstName} sieht deine Ankunft live` : `${firstName} is following your arrival`)}
                  testID="barber-trip-status"
                />
                {live.route.source === 'estimate' && !live.arrived ? (
                  <Text style={[styles.note, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {de ? 'Routendienst nicht erreichbar — Ankunft wird geschätzt.' : 'Route service unreachable — arrival is estimated.'}
                  </Text>
                ) : null}
                {live.mode === 'foreground' && !live.arrived ? (
                  <Text style={[styles.note, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {de ? 'Lass Privelier geöffnet, damit die Ankunft aktuell bleibt.' : 'Keep Privelier open so your arrival stays up to date.'}
                  </Text>
                ) : null}

                {!live.arrived ? (
                  <View style={styles.actions}>
                    <PrimaryButton label={de ? 'Navigation starten' : 'Start navigation'} icon="map" onPress={() => void onNavigate()} testID="barber-trip-navigate" />
                    <View style={styles.actionRow}>
                      <SecondaryAction icon="check" label={de ? 'Ich bin da' : "I've arrived"} onPress={() => void onArrived()} testID="barber-trip-arrived" />
                      <SecondaryAction icon="pause-circle" label={de ? 'Teilen stoppen' : 'Stop sharing'} onPress={() => setConfirmStop(true)} testID="barber-trip-stop" />
                    </View>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <PrimaryButton
                      label={de ? 'Fertig' : 'Done'}
                      onPress={() => {
                        clearFinishedTrip();
                        navigation.goBack();
                      }}
                      testID="barber-trip-done"
                    />
                  </View>
                )}
              </>
            )}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TripSafetyBar bookingId={booking.id} onShare={onShare} testIDPrefix="barber-trip-safety" />
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
        onConfirm={() => void onStop()}
        onClose={() => setConfirmStop(false)}
        destructive
        testID="barber-trip-stop-confirm"
      />
    </View>
  );
}

function PromiseLine({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.promiseLine}>
      <Feather name={icon} size={15} color={colors.accentText} style={styles.promiseIcon} />
      <Text style={[styles.promiseText, { color: colors.textPrimary, fontFamily: fonts.body }]}>{text}</Text>
    </View>
  );
}

function SecondaryAction({ icon, label, onPress, testID }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; testID: string }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.secondary, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <Feather name={icon} size={16} color={colors.textPrimary} />
      <Text style={[styles.secondaryText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.base, paddingTop: space.sm },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, paddingBottom: space.md },
  sheet: { borderRadius: radius.xl, maxHeight: 520, overflow: 'hidden' },
  sheetContent: { padding: space.lg, gap: space.md },
  overline: { fontSize: 13 },
  title: { fontSize: 26, lineHeight: 32 },
  address: { fontSize: 15, lineHeight: 22 },
  promise: { borderTopWidth: HAIRLINE, borderBottomWidth: HAIRLINE, paddingVertical: space.md, gap: space.md },
  promiseLine: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  promiseIcon: { marginTop: 3 },
  promiseText: { flex: 1, fontSize: 14, lineHeight: 20 },
  errorBox: { gap: space.xs },
  errorText: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, paddingVertical: space.xs },
  note: { fontSize: 13, lineHeight: 19 },
  actions: { gap: space.sm, marginTop: space.xs },
  actionRow: { flexDirection: 'row', gap: space.sm },
  secondary: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: HAIRLINE,
    borderRadius: radius.md,
  },
  secondaryText: { fontSize: 14 },
  divider: { height: HAIRLINE, marginVertical: space.xs },
});
