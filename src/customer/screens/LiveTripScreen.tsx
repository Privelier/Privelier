/**
 * Customer live arrival — "where is my barber?" answered at a glance.
 *
 * Full-bleed map with the barber's gliding marker on a brass route to the
 * customer's door, the ETA hero counting down in real time (re-derived from
 * eta_at every few seconds between GPS updates, so it never freezes), and a
 * progress track. States are explicit and honest:
 *  - not started yet  → what will happen and that a push will announce it;
 *  - on the way       → live ETA; "Almost there" inside 5 minutes;
 *  - signal lost      → last known position greyed out, never a fake ETA;
 *  - arrived          → "at your door";
 *  - ended            → sharing stopped, nothing shown.
 *
 * Realtime: booking_trips postgres_changes (RLS: participants only).
 */
import { Reveal } from '../../shared/motion/Reveal';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { getAppLanguage } from '../../shared/locale';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { GlassIconButton } from '../../shared/components/GlassIconButton';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { Avatar } from '../../shared/components/Avatar';
import { Skeleton } from '../../shared/components/Skeleton';
import { useToast } from '../../shared/components/ToastProvider';
import { PrivelierMap, type PrivelierMapHandle } from '../../shared/maps/PrivelierMap';
import type { MapScene } from '../../shared/maps/mapScene';
import { TripStatusPanel, type TripPhase } from '../../shared/components/trip/TripStatusPanel';
import { TripSafetyBar } from '../../shared/components/trip/TripSafetyBar';
import { projectOntoRoute, remainingLine } from '../../shared/tracking/geo';
import { formatEta } from '../../shared/tracking/eta';
import { shareTrip } from '../../shared/tracking/safety';
import { useLiveTrip, useTripView } from '../../shared/tracking/tripData';
import { fetchRoomForBooking } from '../inboxData';
import { fetchLiveTripContext, type LiveTripContext } from '../liveTripData';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'LiveTrip'>;

export default function LiveTripScreen({ route, navigation }: Props) {
  const { bookingId, context: passedContext } = route.params;
  // From a list the context rides along; from a push only the id does.
  const [context, setContext] = useState<LiveTripContext | null>(passedContext ?? null);
  useEffect(() => {
    if (passedContext) return;
    let active = true;
    void fetchLiveTripContext(bookingId).then((loaded) => {
      if (active) setContext(loaded);
    });
    return () => {
      active = false;
    };
  }, [bookingId, passedContext]);
  const barberId = context?.barberId ?? '';
  const barberName = context?.barberName ?? (getAppLanguage() === 'de' ? 'Dein Barber' : 'Your barber');
  const barberImage = context?.barberImage ?? null;
  const address = context?.address ?? '';
  const whenText = context?.whenText ?? '';
  const serviceName = context?.serviceName ?? null;
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const mapRef = useRef<PrivelierMapHandle>(null);
  const [openingChat, setOpeningChat] = useState(false);

  const { trip, loading } = useLiveTrip(bookingId);
  const view = useTripView(trip);
  const firstName = barberName.split(' ')[0] || barberName;

  const phase: TripPhase | 'waiting' = !view || view.status === 'ended'
    ? (trip?.status === 'ended' ? 'ended' : 'waiting')
    : view.status === 'arrived'
      ? 'arrived'
      : view.stale
        ? 'stale'
        : (view.etaS ?? Infinity) <= 300
          ? 'arriving'
          : 'en_route';

  const scene = useMemo<MapScene>(() => {
    if (!view || view.status === 'ended') return { camera: 'fit', destination: null };
    let ahead = view.route;
    if (view.route && view.position) {
      const projection = projectOntoRoute(view.position, view.route);
      if (projection) ahead = remainingLine(view.route, projection);
    }
    return {
      camera: 'follow',
      destination: view.destination,
      route: view.status === 'arrived' ? null : view.route,
      routeAhead: view.status === 'arrived' || view.stale ? null : ahead,
      vehicle: view.position ? { lngLat: view.position, heading: view.heading, stale: view.stale } : null,
    };
  }, [view]);

  const onMessage = useCallback(async () => {
    if (openingChat || !context) return;
    setOpeningChat(true);
    const result = await fetchRoomForBooking(bookingId);
    setOpeningChat(false);
    if (result.status !== 'ok' || !result.room) {
      showToast({ message: de ? 'Der Chat ist gerade nicht verfügbar.' : 'The chat is not available right now.' });
      return;
    }
    navigation.navigate('Conversation', {
      room: result.room,
      title: barberName,
      subtitle: [serviceName, whenText].filter(Boolean).join(' · '),
      counterpart: { id: barberId, name: barberName, profile_image: barberImage ?? null },
    });
  }, [openingChat, context, bookingId, de, showToast, navigation, barberName, serviceName, whenText, barberId, barberImage]);

  const viewEtaS = view?.etaS ?? null;
  const onShare = useCallback(() => {
    void shareTrip({
      bookingId,
      role: 'customer',
      counterpartName: barberName,
      address,
      whenText,
      etaText: viewEtaS != null && phase !== 'arrived' ? formatEta(viewEtaS, de) : null,
    });
  }, [bookingId, barberName, address, whenText, viewEtaS, phase, de]);

  const caption =
    phase === 'arrived'
      ? de ? `${firstName} ist an deiner Tür.` : `${firstName} is at your door.`
      : phase === 'stale'
        ? de ? `Letzter bekannter Standort von ${firstName}` : `${firstName}'s last known position`
        : de ? `${firstName} ist unterwegs zu dir` : `${firstName} is on the way to you`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]} testID="customer-live-trip-screen">
      <View style={StyleSheet.absoluteFill}>
        <PrivelierMap ref={mapRef} scene={scene} testID="customer-live-trip-map" />
      </View>

      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <GlassIconButton icon="chevron-down" floating size={44} accessibilityLabel={de ? 'Schließen' : 'Close'} onPress={() => navigation.goBack()} testID="customer-live-trip-close" />
        {view?.position ? (
          <GlassIconButton icon="crosshair" floating size={44} accessibilityLabel={de ? 'Karte zentrieren' : 'Recentre map'} onPress={() => mapRef.current?.recenter()} testID="customer-live-trip-recenter" />
        ) : null}
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheetWrap} pointerEvents="box-none">
        <Reveal index={1}>
        <GlassSurface variant="floating" style={styles.sheet} testID="customer-live-trip-sheet">
          <ScrollView bounces={false} contentContainerStyle={styles.sheetContent}>
            <View style={styles.who}>
              <Avatar id={barberId} name={barberName} imageUrl={barberImage ?? null} size={44} />
              <View style={styles.whoText}>
                <Text style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]} numberOfLines={1}>{barberName}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary, fontFamily: fonts.body }]} numberOfLines={1}>
                  {[serviceName, whenText].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>

            {loading ? (
              <View style={styles.loading} testID="customer-live-trip-loading">
                <Skeleton style={styles.skeletonLine} />
                <Skeleton style={styles.skeletonHero} />
              </View>
            ) : phase === 'waiting' || phase === 'ended' ? (
              <View style={[styles.waiting, { borderColor: colors.border }]} testID={`customer-live-trip-${phase}`}>
                <Feather name={phase === 'ended' ? 'pause-circle' : 'clock'} size={20} color={colors.textSecondary} />
                <View style={styles.waitingText}>
                  <Text style={[styles.waitingTitle, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
                    {phase === 'ended'
                      ? de ? 'Live-Standort beendet' : 'Live location ended'
                      : de ? `${firstName} ist noch nicht losgefahren` : `${firstName} hasn't set off yet`}
                  </Text>
                  <Text style={[styles.waitingBody, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {phase === 'ended'
                      ? de ? `${firstName} teilt den Standort nicht mehr. Schreib bei Fragen einfach eine Nachricht.` : `${firstName} stopped sharing. Send a message if you have a question.`
                      : de ? 'Sobald die Fahrt startet, siehst du hier die Ankunft live und bekommst eine Benachrichtigung.' : "Once the trip starts you'll see the arrival live here and get a notification."}
                  </Text>
                </View>
              </View>
            ) : (
              <TripStatusPanel
                phase={phase}
                etaS={view?.etaS ?? null}
                remainingM={view?.remainingM ?? null}
                progress={view?.progress ?? null}
                caption={caption}
                testID="customer-live-trip-status"
              />
            )}

            <PrimaryButton
              label={de ? `${firstName} schreiben` : `Message ${firstName}`}
              icon="message-circle"
              onPress={() => void onMessage()}
              loading={openingChat}
              testID="customer-live-trip-message"
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TripSafetyBar bookingId={bookingId} onShare={onShare} testIDPrefix="customer-live-trip-safety" />
            <Text style={[styles.privacy, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              {de ? 'Der Standort wird nur während der Anfahrt geteilt und danach gelöscht.' : 'Location is shared only during the trip and deleted afterwards.'}
            </Text>
          </ScrollView>
        </GlassSurface>
        </Reveal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.base, paddingTop: space.sm },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, paddingBottom: space.md },
  sheet: { borderRadius: radius.xl, maxHeight: 560, overflow: 'hidden' },
  sheetContent: { padding: space.lg, gap: space.md },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  whoText: { flex: 1, minWidth: 0 },
  name: { fontSize: 20, lineHeight: 26 },
  meta: { fontSize: 13, lineHeight: 18 },
  loading: { gap: space.sm },
  skeletonLine: { height: 14, width: 120, borderRadius: radius.sm },
  skeletonHero: { height: 56, width: 180, borderRadius: radius.md },
  waiting: { flexDirection: 'row', gap: space.md, borderTopWidth: HAIRLINE, borderBottomWidth: HAIRLINE, paddingVertical: space.md },
  waitingText: { flex: 1, gap: 2 },
  waitingTitle: { fontSize: 15, lineHeight: 21 },
  waitingBody: { fontSize: 13, lineHeight: 19 },
  divider: { height: HAIRLINE, marginVertical: space.xs },
  privacy: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
