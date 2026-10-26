/**
 * The barber's "On my way" engine: GPS → route → ETA → the customer's screen.
 *
 * Flow
 *  1. startTrip(): ask for WHILE-USING location permission (never "always",
 *     never earlier than this tap), take a fix, resolve the destination (the
 *     booking's stored coordinates, else a one-off Photon geocode of the
 *     address), fetch a free road route, call start_trip.
 *  2. Location updates run as a user-started foreground session — Android
 *     shows a "Sharing your trip" notification, iOS the blue location pill —
 *     so they keep flowing when the barber switches to a navigation app,
 *     WITHOUT background-location permission. Expo Go cannot do this, so
 *     there it falls back to foreground watching.
 *  3. Each fix goes through TripEngine (eta.ts): snapped progress, a learned
 *     pace factor, smoothed ETA, off-route detection with throttled
 *     rerouting, and arrival detection (auto-marks "arrived").
 *  4. Updates are sent sparingly — at most every 5 s, and only when the
 *     barber moved 20 m or 15 s passed — to save battery and data. The
 *     server rate-limits again and fires "arriving soon" itself.
 *
 * State survives the app being backgrounded or killed and relaunched by the
 * OS (persisted in AsyncStorage, rebuilt on the next fix). Stopping is always
 * possible and wipes the position server-side.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../../../lib/supabase';
import { geocodeBestMatch } from '../../shared/geocoding';
import { TripEngine, type TripRoute, type TripSnapshot } from '../../shared/tracking/eta';
import { bearingDeg, decodePolyline, encodePolyline, haversineM, type LngLat } from '../../shared/tracking/geo';
import { fetchRoute } from '../../shared/tracking/routing';
import { getAppLanguage } from '../../shared/locale';
import type { BookingRow } from '../../types';
import { devWarn } from '../../shared/devLog';

/** @public Read by the trip tests through the module registry. */
export const TRIP_LOCATION_TASK = 'privelier-trip-location';
const STORAGE_KEY = 'privelier.activeTrip.v1';
const SEND_MIN_INTERVAL_MS = 5000;
const SEND_MOVE_M = 20;
const SEND_MAX_SILENCE_MS = 15_000;
/** Polylines are long; keep what we send small (≈ 1 point per 15 m). */
const ROUTE_SIMPLIFY_M = 15;

export type StartTripError =
  | 'permission_denied'
  | 'location_unavailable'
  | 'no_destination'
  | 'not_allowed'
  | 'network';

export type StartTripResult = { status: 'ok' } | { status: 'error'; code: StartTripError };

interface PersistedTrip {
  bookingId: string;
  destination: LngLat;
  route: { polyline: string; distanceM: number; durationS: number; source: TripRoute['source'] };
  mode: 'background' | 'foreground';
}

export interface LiveTripState {
  bookingId: string;
  destination: LngLat;
  route: TripRoute;
  position: LngLat | null;
  heading: number | null;
  snapshot: TripSnapshot | null;
  arrived: boolean;
  mode: 'background' | 'foreground';
}

// ---------------------------------------------------------------------------
// In-memory session (rebuilt from storage after a relaunch)
// ---------------------------------------------------------------------------

let trip: PersistedTrip | null = null;
let engine: TripEngine | null = null;
let state: LiveTripState | null = null;
let lastSent: { at: number; position: LngLat } | null = null;
let rerouting = false;
let arriving = false;
let foregroundWatch: Location.LocationSubscription | null = null;
const listeners = new Set<(state: LiveTripState | null) => void>();

function emit() {
  listeners.forEach((listener) => listener(state));
}

export function subscribeToTrip(listener: (state: LiveTripState | null) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

/** Drop points closer than `minM` apart (keeps first and last). */
function simplify(line: LngLat[], minM: number): LngLat[] {
  if (line.length <= 2) return line;
  const out: LngLat[] = [line[0]];
  for (let i = 1; i < line.length - 1; i++) {
    if (haversineM(out[out.length - 1], line[i]) >= minM) out.push(line[i]);
  }
  out.push(line[line.length - 1]);
  return out;
}

function toPersistedRoute(route: TripRoute): PersistedTrip['route'] {
  return {
    polyline: encodePolyline(simplify(route.coordinates, ROUTE_SIMPLIFY_M)),
    distanceM: route.distanceM,
    durationS: route.durationS,
    source: route.source,
  };
}

function fromPersistedRoute(route: PersistedTrip['route']): TripRoute {
  return { coordinates: decodePolyline(route.polyline), distanceM: route.distanceM, durationS: route.durationS, source: route.source };
}

async function persist() {
  if (trip) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
  else await AsyncStorage.removeItem(STORAGE_KEY);
}

async function restore(): Promise<boolean> {
  if (trip && engine) return true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    trip = JSON.parse(raw) as PersistedTrip;
    const route = fromPersistedRoute(trip.route);
    engine = new TripEngine(route, trip.destination);
    state = {
      bookingId: trip.bookingId,
      destination: trip.destination,
      route,
      position: null,
      heading: null,
      snapshot: null,
      arrived: false,
      mode: trip.mode,
    };
    return true;
  } catch {
    return false;
  }
}

/** Resume the in-app view of a trip that is still running after a relaunch. */
export async function resumeActiveTrip(): Promise<LiveTripState | null> {
  if (!(await restore())) return null;
  if (trip?.mode === 'foreground' && !foregroundWatch) await startForegroundWatch();
  emit();
  return state;
}

// ---------------------------------------------------------------------------
// Per-fix pipeline
// ---------------------------------------------------------------------------

async function handleFix(location: Location.LocationObject): Promise<void> {
  if (!(await restore()) || !trip || !engine || !state) return;
  const position: LngLat = [location.coords.longitude, location.coords.latitude];
  const speed = location.coords.speed != null && location.coords.speed >= 0 ? location.coords.speed : null;
  // GPS heading is meaningless when standing still; derive from movement.
  let heading = location.coords.heading != null && location.coords.heading >= 0 && (speed ?? 0) > 1 ? location.coords.heading : null;
  if (heading == null && state.position && haversineM(state.position, position) > 8) {
    heading = bearingDeg(state.position, position);
  }

  const snapshot = engine.update({
    position,
    timestampMs: location.timestamp,
    speedMps: speed,
    accuracyM: location.coords.accuracy,
    heading,
  });
  state = { ...state, position, heading: heading ?? state.heading, snapshot, arrived: snapshot.arrived };
  emit();

  let newRoute: TripRoute | null = null;
  if (snapshot.shouldReroute && !rerouting) {
    rerouting = true;
    engine.markRerouteRequested();
    try {
      const route = await fetchRoute(position, trip.destination);
      if (route.source !== 'estimate') {
        engine.setRoute(route);
        trip = { ...trip, route: toPersistedRoute(route) };
        state = { ...state, route };
        newRoute = route;
        void persist();
        emit();
      }
    } finally {
      rerouting = false;
    }
  }

  if (snapshot.arrived && !arriving) {
    arriving = true;
    await sendUpdate(position, heading, speed, location.coords.accuracy, snapshot, null);
    await markArrived();
    return;
  }

  const now = Date.now();
  const due =
    !lastSent ||
    newRoute !== null ||
    (now - lastSent.at >= SEND_MIN_INTERVAL_MS &&
      (haversineM(lastSent.position, position) >= SEND_MOVE_M || now - lastSent.at >= SEND_MAX_SILENCE_MS));
  if (due) await sendUpdate(position, heading, speed, location.coords.accuracy, snapshot, newRoute);
}

async function sendUpdate(
  position: LngLat,
  heading: number | null,
  speed: number | null,
  accuracy: number | null,
  snapshot: TripSnapshot,
  newRoute: TripRoute | null
) {
  if (!trip) return;
  lastSent = { at: Date.now(), position };
  const { data, error } = await supabase.rpc('update_trip_position', {
    p_booking_id: trip.bookingId,
    p_latitude: position[1],
    p_longitude: position[0],
    // Absent optional values are omitted; the RPC defaults them to null.
    p_heading: heading ?? undefined,
    p_speed_mps: speed ?? undefined,
    p_accuracy_m: accuracy ?? undefined,
    p_remaining_distance_m: Math.round(snapshot.remainingM),
    p_eta_seconds: snapshot.etaS,
    p_route_polyline: newRoute ? toPersistedRoute(newRoute).polyline : undefined,
    p_route_source: newRoute ? newRoute.source : undefined,
  });
  if (error) {
    devWarn('[trip] update failed', error);
    // The booking left 'accepted' (completed/cancelled elsewhere) or the day
    // passed: the server refuses; stop quietly.
    if (error.code === 'PT001' || error.code === 'PT002' || error.code === 'PT003') await stopLocal();
    return;
  }
  if ((data as { status?: string } | null)?.status === 'ended') await stopLocal();
}

TaskManager.defineTask(TRIP_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    devWarn('[trip] location task error', error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (latest) await handleFix(latest);
});

// ---------------------------------------------------------------------------
// Location session
// ---------------------------------------------------------------------------

async function startBackgroundUpdates(): Promise<boolean> {
  try {
    if (!(await TaskManager.isAvailableAsync())) return false;
    const de = getAppLanguage() === 'de';
    await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 4000,
      distanceInterval: 10,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: de ? 'Fahrt wird geteilt' : 'Sharing your trip',
        notificationBody: de ? 'Dein Kunde sieht deine Ankunftszeit live.' : 'Your customer sees your live arrival time.',
        notificationColor: '#BFA06B',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (raw) {
    devWarn('[trip] background updates unavailable, using foreground watch', raw);
    return false;
  }
}

async function startForegroundWatch() {
  foregroundWatch?.remove();
  foregroundWatch = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 4000, distanceInterval: 10 },
    (location) => void handleFix(location)
  );
}

async function stopLocationSession() {
  foregroundWatch?.remove();
  foregroundWatch = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
    }
  } catch {
    // Not running.
  }
}

async function stopLocal() {
  await stopLocationSession();
  trip = null;
  engine = null;
  state = null;
  lastSent = null;
  arriving = false;
  await persist();
  emit();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function startTrip(booking: BookingRow): Promise<StartTripResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return { status: 'error', code: 'permission_denied' };

  let fix: Location.LocationObject | null = null;
  try {
    fix =
      (await Location.getLastKnownPositionAsync({ maxAge: 30_000, requiredAccuracy: 100 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
  } catch {
    fix = null;
  }
  if (!fix) return { status: 'error', code: 'location_unavailable' };
  const origin: LngLat = [fix.coords.longitude, fix.coords.latitude];

  let destination: LngLat | null =
    booking.location_longitude != null && booking.location_latitude != null
      ? [booking.location_longitude, booking.location_latitude]
      : null;
  if (!destination) {
    const match = await geocodeBestMatch(booking.location, { latitude: origin[1], longitude: origin[0] });
    destination = match ? [match.longitude, match.latitude] : null;
  }
  if (!destination) return { status: 'error', code: 'no_destination' };

  const route = await fetchRoute(origin, destination);
  const persistedRoute = toPersistedRoute(route);
  const initial = new TripEngine(route, destination).update({
    position: origin,
    timestampMs: fix.timestamp,
    accuracyM: fix.coords.accuracy,
  });

  const { error } = await supabase.rpc('start_trip', {
    p_booking_id: booking.id,
    p_latitude: origin[1],
    p_longitude: origin[0],
    p_dest_latitude: destination[1],
    p_dest_longitude: destination[0],
    p_route_polyline: persistedRoute.polyline,
    p_route_source: route.source,
    p_remaining_distance_m: Math.round(initial.remainingM),
    p_eta_seconds: initial.etaS,
  });
  if (error) {
    devWarn('[trip] start failed', error);
    return { status: 'error', code: error.code?.startsWith('PT') ? 'not_allowed' : 'network' };
  }

  await stopLocationSession();
  const background = await startBackgroundUpdates();
  trip = { bookingId: booking.id, destination, route: persistedRoute, mode: background ? 'background' : 'foreground' };
  engine = new TripEngine(route, destination);
  engine.update({ position: origin, timestampMs: fix.timestamp, accuracyM: fix.coords.accuracy });
  lastSent = { at: Date.now(), position: origin };
  arriving = false;
  state = {
    bookingId: booking.id,
    destination,
    route,
    position: origin,
    heading: null,
    snapshot: initial,
    arrived: false,
    mode: trip.mode,
  };
  await persist();
  if (!background) await startForegroundWatch();
  emit();
  return { status: 'ok' };
}

async function markArrived() {
  if (!trip) return;
  const { error } = await supabase.rpc('mark_trip_arrived', { p_booking_id: trip.bookingId });
  if (error) devWarn('[trip] arrive failed', error);
  // Arrived: no more position updates needed. The row keeps its "arrived"
  // state until the booking is completed or the barber ends sharing.
  await stopLocationSession();
  const finished = state ? { ...state, arrived: true } : null;
  trip = null;
  engine = null;
  lastSent = null;
  await persist();
  state = finished;
  emit();
}

/** "I've arrived" button. */
export async function arriveNow(): Promise<void> {
  if (!(await restore())) return;
  arriving = true;
  await markArrived();
}

/** Stop sharing. Always works; wipes the barber's position server-side. */
export async function stopTrip(bookingId: string): Promise<void> {
  await stopLocal();
  const { error } = await supabase.rpc('end_trip', { p_booking_id: bookingId });
  if (error) devWarn('[trip] end failed', error);
}

/** Clears the arrived summary from the screen once the barber dismisses it. */
export function clearFinishedTrip(): void {
  if (!trip) {
    state = null;
    emit();
  }
}

/** Sign-out: stop broadcasting before the session disappears. */
export async function stopAnyTripForSignOut(): Promise<void> {
  const bookingId = trip?.bookingId ?? state?.bookingId ?? null;
  if (await restore()) {
    if (bookingId) await stopTrip(bookingId);
    else await stopLocal();
  } else {
    await stopLocationSession();
  }
}
