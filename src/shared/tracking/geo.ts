/**
 * Pure geo math for live trip tracking. No I/O, no React — every function is
 * deterministic and covered by shared test vectors
 * (tools/geo/fixtures/geo_vectors.json) that the Python reference
 * implementation (tools/geo/geo_core.py) must also pass, so the app and the
 * tooling can never silently disagree about a distance or an ETA.
 *
 * Coordinates are [longitude, latitude] everywhere (GeoJSON / MapLibre
 * order), never the other way round.
 */

export type LngLat = [longitude: number, latitude: number];

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north in [0, 360). */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δλ = toRad(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Total length of a line in metres. */
export function lineLengthM(line: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += haversineM(line[i - 1], line[i]);
  return total;
}

// ---------------------------------------------------------------------------
// Encoded polylines (Google algorithm; OSRM `polyline6` = precision 6)
// ---------------------------------------------------------------------------

export function decodePolyline(encoded: string, precision = 6): LngLat[] {
  const factor = 10 ** precision;
  const out: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        if (index >= encoded.length) return out; // truncated input: keep what parsed
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push([lng / factor, lat / factor]);
  }
  return out;
}

export function encodePolyline(line: LngLat[], precision = 6): string {
  const factor = 10 ** precision;
  let prevLat = 0;
  let prevLng = 0;
  let out = '';
  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lng, lat] of line) {
    const iLat = Math.round(lat * factor);
    const iLng = Math.round(lng * factor);
    encodeValue(iLat - prevLat);
    encodeValue(iLng - prevLng);
    prevLat = iLat;
    prevLng = iLng;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Snapping a GPS fix onto the route
// ---------------------------------------------------------------------------

export interface RouteProjection {
  /** Closest point on the route. */
  point: LngLat;
  /** Index of the segment start the point lies on. */
  segmentIndex: number;
  /** Metres travelled along the route up to `point`. */
  alongM: number;
  /** Metres between the fix and the route (off-route signal). */
  crossTrackM: number;
}

/**
 * Projects a fix onto a route polyline using a local equirectangular frame
 * per segment — accurate to centimetres at city scale, and cheap enough to
 * run on every GPS fix. `cumulative` (from cumulativeDistances) is optional
 * but avoids an O(n) re-sum per call.
 */
export function projectOntoRoute(
  fix: LngLat,
  route: LngLat[],
  cumulative: number[] = cumulativeDistances(route)
): RouteProjection | null {
  if (route.length === 0) return null;
  if (route.length === 1) {
    return { point: route[0], segmentIndex: 0, alongM: 0, crossTrackM: haversineM(fix, route[0]) };
  }
  let best: RouteProjection | null = null;
  const cosLat = Math.cos(toRad(fix[1]));
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    // Local planar frame (metres) centred on the fix.
    const ax = toRad(a[0] - fix[0]) * cosLat * EARTH_RADIUS_M;
    const ay = toRad(a[1] - fix[1]) * EARTH_RADIUS_M;
    const bx = toRad(b[0] - fix[0]) * cosLat * EARTH_RADIUS_M;
    const by = toRad(b[1] - fix[1]) * EARTH_RADIUS_M;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const cross = Math.hypot(px, py);
    if (best === null || cross < best.crossTrackM) {
      const segLen = cumulative[i + 1] - cumulative[i];
      best = {
        point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
        segmentIndex: i,
        alongM: cumulative[i] + t * segLen,
        crossTrackM: cross,
      };
    }
  }
  return best;
}

export function cumulativeDistances(route: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < route.length; i++) out.push(out[i - 1] + haversineM(route[i - 1], route[i]));
  return out;
}

/** The part of the route still ahead of a projection (for drawing). */
export function remainingLine(route: LngLat[], projection: RouteProjection): LngLat[] {
  return [projection.point, ...route.slice(projection.segmentIndex + 1)];
}

/** Bounds as [west, south, east, north] — MapLibre's LngLatBounds order. */
export function boundsOf(points: LngLat[]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of points) {
    w = Math.min(w, lng);
    s = Math.min(s, lat);
    e = Math.max(e, lng);
    n = Math.max(n, lat);
  }
  return [w, s, e, n];
}

/** Linear interpolation between two fixes, used for smooth marker motion. */
export function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** Shortest signed rotation from one heading to another, in degrees. */
export function headingDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}
