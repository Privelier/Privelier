import { renderHook } from '@testing-library/react-native';
import { brandMapStyle } from '../../maps/mapStyle';
import { buildWebMapHtml } from '../../maps/webMapHtml';
import { navigationUrls } from '../../bookingActions';
import { notificationCopy, type NotificationRow } from '../../notifications';
import { emergencyNumber, osmLink } from '../safety';
import { encodePolyline } from '../geo';
import { useTripView, type BookingTripRow } from '../tripData';
import { isTripWindow } from '../../../barber/screens/RequestsScreen';

jest.mock('../../../../lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'DE' }] }));
jest.mock('expo-location', () => ({}));

describe('brandMapStyle', () => {
  const style = {
    version: 8,
    sources: {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
      { id: 'water', type: 'fill', paint: { 'fill-color': 'x', 'fill-opacity': 0.9 } },
      { id: 'place_city', type: 'symbol', paint: { 'text-color': 'grey' }, layout: { 'text-transform': 'uppercase', 'text-size': 12 } },
      { id: 'untouched', type: 'line', paint: { 'line-color': 'red' } },
    ],
  };

  it('re-tints known layers to the brand, keeps other paint props, leaves unknown layers alone', () => {
    const out = brandMapStyle(style as never) as unknown as typeof style;
    expect(out.layers[0].paint).toEqual({ 'background-color': '#121214' });
    expect(out.layers[1].paint).toEqual({ 'fill-color': '#0C0E11', 'fill-opacity': 0.9 });
    expect(out.layers[2].paint).toMatchObject({ 'text-color': '#8F8B81' });
    // Never all-caps (brand), other layout props kept.
    expect((out.layers[2] as { layout?: object }).layout).toEqual({ 'text-transform': 'none', 'text-size': 12 });
    expect(out.layers[3]).toBe(style.layers[3]);
    // Pure: the input document is not mutated.
    expect(style.layers[0].paint['background-color']).toBe('rgb(12,12,12)');
  });
});

describe('buildWebMapHtml', () => {
  it('pins the MapLibre GL version and cannot be broken out of by style JSON', () => {
    const html = buildWebMapHtml({ version: 8, name: '</script><script>alert(1)</script>', sources: {}, layers: [] } as never, false);
    expect(html).toContain('maplibre-gl@5.24.0/dist/maplibre-gl.js');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });

  it('disables marker animation for reduced motion', () => {
    expect(buildWebMapHtml('https://tiles.openfreemap.org/styles/dark', true)).toContain('var REDUCE=true');
  });
});

describe('safety helpers', () => {
  it('picks the regional emergency number with a 112 default', () => {
    expect(emergencyNumber('US')).toBe('911');
    expect(emergencyNumber('gb')).toBe('999');
    expect(emergencyNumber('AU')).toBe('000');
    expect(emergencyNumber('DE')).toBe('112');
    expect(emergencyNumber(null)).toBe('112');
  });

  it('builds a free OpenStreetMap link', () => {
    expect(osmLink([11.0772, 49.4547])).toBe('https://www.openstreetmap.org/?mlat=49.45470&mlon=11.07720#map=17/49.45470/11.07720');
  });
});

describe('navigationUrls', () => {
  it('opens Apple Maps on iOS and Google turn-by-turn then geo: on Android', () => {
    expect(navigationUrls(49.4547, 11.0772, 'ios')).toEqual(['https://maps.apple.com/?daddr=49.454700,11.077200&dirflg=d']);
    expect(navigationUrls(49.4547, 11.0772, 'android')).toEqual([
      'google.navigation:q=49.454700,11.077200&mode=d',
      'geo:49.454700,11.077200?q=49.454700,11.077200',
    ]);
  });
});

describe('trip notification copy', () => {
  const row = (event_type: NotificationRow['event_type']): NotificationRow => ({
    id: 'n', recipient_id: 'c', event_type, booking_id: 'b', message_id: null, actor_id: 'barber',
    booking_status: null, event_key: 'k', created_at: '', read_at: null,
  });
  it('covers every trip event in both languages', () => {
    expect(notificationCopy(row('trip_started'), 'Marco', 'en')).toEqual({ title: 'Your barber is on the way', body: 'Marco is on the way to you. Follow the arrival live.' });
    expect(notificationCopy(row('trip_arriving'), 'Marco', 'de').title).toBe('Gleich da');
    expect(notificationCopy(row('trip_arrived'), 'Marco', 'en').body).toBe('Marco has arrived at your address.');
  });
});

describe('isTripWindow', () => {
  const booking = { date: '2026-10-25', time: '14:00:00', duration_minutes: 45 };
  const at = (iso: string) => Date.parse(iso);
  it('opens 12 h before the slot and closes at its scheduled end', () => {
    expect(isTripWindow(booking, at('2026-10-25T01:59:00'))).toBe(false);
    expect(isTripWindow(booking, at('2026-10-25T02:00:00'))).toBe(true);
    expect(isTripWindow(booking, at('2026-10-25T14:44:00'))).toBe(true);
    expect(isTripWindow(booking, at('2026-10-25T14:46:00'))).toBe(false);
  });
});

describe('useTripView', () => {
  const base: BookingTripRow = {
    booking_id: 'b', barber_id: 'br', customer_id: 'c', status: 'en_route',
    dest_latitude: 49.4547, dest_longitude: 11.0772, latitude: 49.448, longitude: 11.064,
    heading: 45, speed_mps: 8, accuracy_m: 10, position_at: new Date().toISOString(),
    remaining_distance_m: 600, eta_at: new Date(Date.now() + 240_000).toISOString(),
    route_polyline: encodePolyline([[11.064, 49.448], [11.07, 49.451], [11.0772, 49.4547]]),
    route_source: 'osrm', started_at: '', arriving_notified_at: null, arrived_at: null, ended_at: null,
    updated_at: '',
  };

  it('derives a live ETA, progress against the stored route and fresh status', async () => {
    const { result } = await renderHook(() => useTripView(base));
    const view = result.current!;
    expect(view.position).toEqual([11.064, 49.448]);
    expect(view.destination).toEqual([11.0772, 49.4547]);
    expect(view.etaS).toBeGreaterThan(230);
    expect(view.etaS).toBeLessThanOrEqual(240);
    expect(view.stale).toBe(false);
    expect(view.route).toHaveLength(3);
    // ~1.3 km route, 600 m left -> a bit over half way.
    expect(view.progress).toBeGreaterThan(0.45);
    expect(view.progress).toBeLessThan(0.65);
  });

  it('marks an old fix as stale and an arrival as complete', async () => {
    const stale = await renderHook(() => useTripView({ ...base, position_at: new Date(Date.now() - 120_000).toISOString() }));
    expect(stale.result.current!.stale).toBe(true);
    const arrived = await renderHook(() => useTripView({ ...base, status: 'arrived' }));
    expect(arrived.result.current!.etaS).toBe(0);
    expect(arrived.result.current!.progress).toBe(1);
  });
});
