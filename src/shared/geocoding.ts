/**
 * Mapbox forward-geocoding client (Explore/location feature, Run A — design:
 * docs/design/explore-location-design-approval.md, condition C7).
 *
 * Plain HTTPS fetch against the Mapbox Geocoding v6 API — deliberately NO
 * native module: address search must work on the current dev client. Uses the
 * public `EXPO_PUBLIC_MAPBOX_TOKEN` (a pk. token, public by design — same
 * trust class as the Supabase anon key; it ships inside the app bundle).
 *
 * Error handling mirrors the data-layer house style (src/barber/errors.ts):
 * the UI only ever sees a closed set of codes with calm, sentence-case copy;
 * raw response text goes to __DEV__ logging only. The token is never logged —
 * log lines carry the query only, never the request URL.
 */

export interface GeocodeCandidate {
  /** Human-readable address label, as returned by Mapbox. */
  label: string;
  latitude: number;
  longitude: number;
}

export type GeocodeErrorCode = 'missing_token' | 'network' | 'bad_response';

export type ForwardGeocodeResult =
  | { status: 'ok'; candidates: GeocodeCandidate[] }
  | { status: 'error'; code: GeocodeErrorCode; message: string; retryable: boolean };

/** User-facing copy per code. Sentence case, calm, no exclamation marks. */
export const geocodeErrorCopy: Record<GeocodeErrorCode, string> = {
  missing_token: 'Address search is not configured on this build. Contact support.',
  network: 'We could not reach the address service. Check your connection and try again.',
  bad_response: 'The address service had a problem. Try again in a moment.',
};

function geocodeFailure(code: GeocodeErrorCode): ForwardGeocodeResult {
  return {
    status: 'error',
    code,
    message: geocodeErrorCopy[code],
    retryable: code === 'network',
  };
}

function logGeocodeError(context: string, raw: unknown): void {
  if (__DEV__) {
    console.warn(`[geocoding] ${context}`, raw);
  }
}

const FORWARD_ENDPOINT = 'https://api.mapbox.com/search/geocode/v6/forward';
/** Candidate cap — the picker UI shows a short list, not a search engine. */
const CANDIDATE_LIMIT = 5;

/** Minimal slice of the Mapbox v6 GeoJSON response this module reads. */
interface MapboxFeatureLike {
  geometry?: { coordinates?: unknown };
  properties?: {
    full_address?: unknown;
    place_formatted?: unknown;
    name?: unknown;
  };
}

/**
 * Parse one GeoJSON feature into a candidate; null for anything malformed
 * (a skipped feature, never a thrown parse — partial results beat none).
 */
function toCandidate(feature: MapboxFeatureLike): GeocodeCandidate | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const props = feature.properties ?? {};
  const label =
    (typeof props.full_address === 'string' && props.full_address) ||
    (typeof props.place_formatted === 'string' && props.place_formatted) ||
    (typeof props.name === 'string' && props.name) ||
    null;
  if (!label) return null;

  return { label, latitude: lat, longitude: lng };
}

/**
 * Forward-geocode a free-text address into up to 5 candidates.
 *
 * - A blank/whitespace query resolves to `ok` with zero candidates (the
 *   screen treats "nothing typed yet" as an ordinary empty state, not an
 *   error).
 * - `missing_token` is a build/configuration fault, not a user fault — the
 *   env var is inlined at bundle time, so at runtime this is unrecoverable.
 * - Every fetch/parse fault maps to the closed code set; nothing raw
 *   reaches the caller.
 */
export async function forwardGeocode(query: string): Promise<ForwardGeocodeResult> {
  const trimmed = query.trim();
  if (trimmed === '') return { status: 'ok', candidates: [] };

  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    logGeocodeError('forwardGeocode', 'EXPO_PUBLIC_MAPBOX_TOKEN is not set');
    return geocodeFailure('missing_token');
  }

  const url =
    `${FORWARD_ENDPOINT}?q=${encodeURIComponent(trimmed)}` +
    `&limit=${CANDIDATE_LIMIT}&autocomplete=true&access_token=${encodeURIComponent(token)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (raw) {
    logGeocodeError(`forwardGeocode fetch (query: ${trimmed})`, raw);
    return geocodeFailure('network');
  }

  if (!response.ok) {
    logGeocodeError(`forwardGeocode status (query: ${trimmed})`, response.status);
    return geocodeFailure('bad_response');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (raw) {
    logGeocodeError('forwardGeocode json parse', raw);
    return geocodeFailure('bad_response');
  }

  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) {
    logGeocodeError('forwardGeocode shape', 'response has no features array');
    return geocodeFailure('bad_response');
  }

  const candidates = features
    .map((f) => toCandidate(f as MapboxFeatureLike))
    .filter((c): c is GeocodeCandidate => c !== null);

  return { status: 'ok', candidates };
}
