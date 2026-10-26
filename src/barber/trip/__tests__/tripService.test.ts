import type { BookingRow } from '../../../types';

const mockRpc = jest.fn();
jest.mock('../../../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

let mockTaskHandler: ((body: { data?: unknown; error?: unknown }) => Promise<void>) | null = null;
jest.mock('expo-task-manager', () => ({
  defineTask: (_name: string, handler: typeof mockTaskHandler) => {
    mockTaskHandler = handler;
  },
  isAvailableAsync: jest.fn(async () => true),
}));

const mockLocation = {
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(async () => undefined),
  stopLocationUpdatesAsync: jest.fn(async () => undefined),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  Accuracy: { BestForNavigation: 6, High: 4, Balanced: 3 },
  ActivityType: { AutomotiveNavigation: 2 },
};
jest.mock('expo-location', () => mockLocation);

const mockRoute = jest.fn();
jest.mock('../../../shared/tracking/routing', () => ({ fetchRoute: (...args: unknown[]) => mockRoute(...args) }));
const mockGeocode = jest.fn();
jest.mock('../../../shared/geocoding', () => ({ geocodeBestMatch: (...args: unknown[]) => mockGeocode(...args) }));
jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));

// required (not imported) so it loads AFTER the mock objects above exist —
// babel would hoist an import above them.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { startTrip, stopTrip, subscribeToTrip, TRIP_LOCATION_TASK } = require('../tripService') as typeof import('../tripService');
type LiveTripState = import('../tripService').LiveTripState;

const ORIGIN = { coords: { longitude: 11.064, latitude: 49.448, accuracy: 8, speed: 0, heading: null }, timestamp: 1_000 };
const DEST: [number, number] = [11.0772, 49.4547];
const ROUTE = {
  coordinates: [[11.064, 49.448], [11.07, 49.451], DEST] as [number, number][],
  distanceM: 1300,
  durationS: 200,
  source: 'osrm' as const,
};
const booking = (over: Partial<BookingRow> = {}): BookingRow => ({
  id: 'booking-1', customer_id: 'c', barber_id: 'b', service_id: 's', date: '2026-10-25', time: '14:00:00',
  location: 'Hauptmarkt 18, Nürnberg', location_latitude: DEST[1], location_longitude: DEST[0],
  price: 30, duration_minutes: 45, status: 'accepted', created_at: '', idempotency_key: null, slot: null, ...over,
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: { status: 'en_route' }, error: null });
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockLocation.getLastKnownPositionAsync.mockResolvedValue(ORIGIN);
  mockRoute.mockResolvedValue(ROUTE);
  await stopTrip('booking-1');
  mockRpc.mockClear();
});

it('declares the background location task at import time', () => {
  expect(TRIP_LOCATION_TASK).toBe('privelier-trip-location');
  expect(mockTaskHandler).not.toBeNull();
});

it('asks only for while-using permission and stops cleanly when refused', async () => {
  mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  expect(await startTrip(booking())).toEqual({ status: 'error', code: 'permission_denied' });
  expect(mockRpc).not.toHaveBeenCalled();
  expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
});

it('starts with the stored destination, a road route and an initial ETA, then runs as a foreground service', async () => {
  const states: (LiveTripState | null)[] = [];
  const unsubscribe = subscribeToTrip((s) => states.push(s));
  expect(await startTrip(booking())).toEqual({ status: 'ok' });
  unsubscribe();

  expect(mockGeocode).not.toHaveBeenCalled();
  expect(mockRoute).toHaveBeenCalledWith([11.064, 49.448], DEST);
  const [name, args] = mockRpc.mock.calls[0];
  expect(name).toBe('start_trip');
  expect(args).toMatchObject({
    p_booking_id: 'booking-1', p_latitude: 49.448, p_longitude: 11.064,
    p_dest_latitude: DEST[1], p_dest_longitude: DEST[0], p_route_source: 'osrm',
  });
  expect(typeof args.p_route_polyline).toBe('string');
  expect(args.p_eta_seconds).toBeGreaterThan(0);
  expect(args.p_remaining_distance_m).toBeGreaterThan(1000);

  const options = (mockLocation.startLocationUpdatesAsync.mock.calls[0] as unknown[])[1] as { foregroundService: { notificationTitle: string }; showsBackgroundLocationIndicator: boolean };
  expect(options.foregroundService.notificationTitle).toBe('Sharing your trip');
  expect(options.showsBackgroundLocationIndicator).toBe(true);
  expect(states.at(-1)).toMatchObject({ bookingId: 'booking-1', mode: 'background', arrived: false });
});

it('geocodes the address when the booking has no coordinates, and refuses without any destination', async () => {
  mockGeocode.mockResolvedValueOnce({ label: 'x', latitude: DEST[1], longitude: DEST[0] });
  expect(await startTrip(booking({ location_latitude: null, location_longitude: null }))).toEqual({ status: 'ok' });
  expect(mockGeocode).toHaveBeenCalledWith('Hauptmarkt 18, Nürnberg', { latitude: 49.448, longitude: 11.064 });

  await stopTrip('booking-1');
  mockGeocode.mockResolvedValueOnce(null);
  expect(await startTrip(booking({ location_latitude: null, location_longitude: null }))).toEqual({ status: 'error', code: 'no_destination' });
});

it('maps a server refusal (wrong day / not accepted) to not_allowed', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PT003', message: 'day' } });
  expect(await startTrip(booking())).toEqual({ status: 'error', code: 'not_allowed' });
  expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
});

it('falls back to foreground watching where background updates are unavailable (Expo Go)', async () => {
  mockLocation.startLocationUpdatesAsync.mockRejectedValueOnce(new Error('not in Expo Go'));
  expect(await startTrip(booking())).toEqual({ status: 'ok' });
  expect(mockLocation.watchPositionAsync).toHaveBeenCalledTimes(1);
});

it('throttles position updates and auto-marks arrival at the door', async () => {
  await startTrip(booking());
  mockRpc.mockClear();
  const fix = (lng: number, lat: number, t: number) => ({
    locations: [{ coords: { longitude: lng, latitude: lat, accuracy: 8, speed: 7, heading: 60 }, timestamp: t }],
  });

  // Same place, moments later: nothing sent (moved < 20 m, < 15 s).
  await mockTaskHandler!({ data: fix(11.06401, 49.44801, 2_000) });
  expect(mockRpc).not.toHaveBeenCalled();

  // At the door: final position, then mark_trip_arrived, then stop updates.
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
  await mockTaskHandler!({ data: fix(DEST[0], DEST[1], 90_000) });
  const names = mockRpc.mock.calls.map((call) => call[0]);
  expect(names).toEqual(['update_trip_position', 'mark_trip_arrived']);
  expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_remaining_distance_m: 0, p_eta_seconds: 0 });
  (Date.now as jest.Mock).mockRestore();
});

it('stop sharing always calls end_trip (which wipes the position server-side)', async () => {
  await startTrip(booking());
  mockRpc.mockClear();
  await stopTrip('booking-1');
  expect(mockRpc).toHaveBeenCalledWith('end_trip', { p_booking_id: 'booking-1' });
});
