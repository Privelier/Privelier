/**
 * Free road routing for live trips — no API key, no bill, ever.
 *
 * Order: FOSSGIS OSRM (routing.openstreetmap.de) → FOSSGIS Valhalla →
 * calibrated straight-line estimate. Both servers are community-run under a
 * fair-use policy; a trip makes one request at start plus a rare reroute, so
 * Privelier's volume stays far inside it. To self-host later (an OSRM docker
 * container on any free VM), set EXPO_PUBLIC_OSRM_URL — nothing else changes.
 *
 * Never throws: the worst case is the offline estimate, so "On my way"
 * always works, even in a dead zone.
 */
import { estimateTrip, type TripRoute } from './eta';
import { decodePolyline, type LngLat } from './geo';

const OSRM_URL = process.env.EXPO_PUBLIC_OSRM_URL || 'https://routing.openstreetmap.de/routed-car';
const VALHALLA_URL = process.env.EXPO_PUBLIC_VALHALLA_URL || 'https://valhalla1.openstreetmap.de';
const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const fmt = ([lng, lat]: LngLat) => `${lng.toFixed(6)},${lat.toFixed(6)}`;

export async function routeOsrm(from: LngLat, to: LngLat): Promise<TripRoute> {
  const body = (await getJson(
    `${OSRM_URL}/route/v1/driving/${fmt(from)};${fmt(to)}?overview=full&geometries=polyline6&steps=false`
  )) as { code?: string; routes?: { geometry: string; distance: number; duration: number }[] };
  const best = body.routes?.[0];
  if (body.code !== 'Ok' || !best) throw new Error(`OSRM ${body.code ?? 'no route'}`);
  const coordinates = decodePolyline(best.geometry, 6);
  if (coordinates.length < 2) throw new Error('OSRM empty geometry');
  return { coordinates, distanceM: best.distance, durationS: best.duration, source: 'osrm' };
}

export async function routeValhalla(from: LngLat, to: LngLat): Promise<TripRoute> {
  const request = {
    locations: [
      { lon: from[0], lat: from[1] },
      { lon: to[0], lat: to[1] },
    ],
    costing: 'auto',
    units: 'kilometers',
  };
  const body = (await getJson(`${VALHALLA_URL}/route?json=${encodeURIComponent(JSON.stringify(request))}`)) as {
    trip?: { legs?: { shape: string }[]; summary?: { length: number; time: number } };
  };
  const shape = body.trip?.legs?.[0]?.shape;
  const summary = body.trip?.summary;
  if (!shape || !summary) throw new Error('Valhalla no trip');
  const coordinates = decodePolyline(shape, 6);
  if (coordinates.length < 2) throw new Error('Valhalla empty geometry');
  return { coordinates, distanceM: summary.length * 1000, durationS: summary.time, source: 'valhalla' };
}

/** Best available route; falls back to the calibrated estimate, never throws. */
export async function fetchRoute(from: LngLat, to: LngLat): Promise<TripRoute> {
  for (const engine of [routeOsrm, routeValhalla]) {
    try {
      return await engine(from, to);
    } catch (raw) {
      if (__DEV__) console.warn('[routing]', engine.name, raw);
    }
  }
  return estimateTrip(from, to);
}
