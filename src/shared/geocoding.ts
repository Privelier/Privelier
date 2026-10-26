/**
 * Forward geocoding on Photon (photon.komoot.io) — free OpenStreetMap address
 * search with autocomplete, no API key and no account. Replaced the Mapbox
 * Geocoding API (design: docs/design/explore-location-design-approval.md,
 * condition C7, still holds: plain HTTPS, deliberately NO native module, so
 * address search works on every build).
 *
 * Fair use: Photon's public instance asks for reasonable volume. Callers
 * debounce as-you-type search, and booking geocodes run once per booking.
 * To self-host (one docker container) set EXPO_PUBLIC_PHOTON_URL.
 *
 * Error handling mirrors the data-layer house style (src/barber/errors.ts):
 * the UI only ever sees a closed set of codes with calm, sentence-case copy;
 * raw response text goes to __DEV__ logging only, and log lines carry the
 * query only, never the request URL.
 */
import { getAppLanguage } from './locale';
import { devWarn } from './devLog';

export interface GeocodeCandidate {
  /** Human-readable address label. */
  label: string;
  latitude: number;
  longitude: number;
}

type GeocodeErrorCode = 'network' | 'bad_response';

export type ForwardGeocodeResult =
  | { status: 'ok'; candidates: GeocodeCandidate[] }
  | { status: 'error'; code: GeocodeErrorCode; message: string; retryable: boolean };

/** User-facing copy per code. Sentence case, calm, no exclamation marks. */
const geocodeErrorCopy: Record<GeocodeErrorCode, string> = {
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
  devWarn(`[geocoding] ${context}`, raw);
}

const PHOTON_URL = process.env.EXPO_PUBLIC_PHOTON_URL || 'https://photon.komoot.io';
/** Candidate cap — the picker UI shows a short list, not a search engine. */
const CANDIDATE_LIMIT = 5;
const TIMEOUT_MS = 8000;

/** Minimal slice of Photon's GeoJSON feature this module reads. */
interface PhotonFeatureLike {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
}

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * "Hauptmarkt 18, 90403 Nürnberg, Deutschland" from Photon's structured
 * properties. A named place (a building, a shop) leads with its name when
 * it is not just the street again.
 */
export function photonLabel(props: Record<string, unknown>): string | null {
  const street = str(props.street);
  const house = str(props.housenumber);
  const name = str(props.name);
  const streetLine = street ? (house ? `${street} ${house}` : street) : null;
  const first = streetLine && name && name !== street ? `${name}, ${streetLine}` : streetLine ?? name;
  const city = str(props.city) ?? str(props.town) ?? str(props.village) ?? str(props.district);
  const postcode = str(props.postcode);
  const cityLine = city ? (postcode ? `${postcode} ${city}` : city) : null;
  const parts = [first, cityLine !== first ? cityLine : null, str(props.country)].filter(
    (p): p is string => p !== null
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Parse one GeoJSON feature into a candidate; null for anything malformed
 * (a skipped feature, never a thrown parse — partial results beat none).
 */
function toCandidate(feature: PhotonFeatureLike): GeocodeCandidate | null {
  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const label = photonLabel(feature.properties ?? {});
  if (!label) return null;
  return { label, latitude: lat, longitude: lng };
}

/**
 * Forward-geocode a free-text address into up to 5 candidates.
 *
 * - A blank/whitespace query resolves to `ok` with zero candidates (the
 *   screen treats "nothing typed yet" as an ordinary empty state).
 * - `near` biases results toward a point (e.g. the barber's base) without
 *   excluding anything elsewhere.
 * - Every fetch/parse fault maps to the closed code set; nothing raw
 *   reaches the caller.
 */
export async function forwardGeocode(
  query: string,
  options: { near?: { latitude: number; longitude: number }; limit?: number } = {}
): Promise<ForwardGeocodeResult> {
  const trimmed = query.trim();
  if (trimmed === '') return { status: 'ok', candidates: [] };

  const params = [
    `q=${encodeURIComponent(trimmed)}`,
    `limit=${options.limit ?? CANDIDATE_LIMIT}`,
    `lang=${getAppLanguage() === 'de' ? 'de' : 'en'}`,
  ];
  if (options.near) {
    params.push(`lat=${options.near.latitude.toFixed(4)}`, `lon=${options.near.longitude.toFixed(4)}`);
  }
  const url = `${PHOTON_URL}/api/?${params.join('&')}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (raw) {
    logGeocodeError(`forwardGeocode fetch (query: ${trimmed})`, raw);
    return geocodeFailure('network');
  } finally {
    clearTimeout(timer);
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

  const seen = new Set<string>();
  const candidates = features
    .map((f) => toCandidate(f as PhotonFeatureLike))
    .filter((c): c is GeocodeCandidate => {
      // Photon can return the same address as several OSM objects
      // (the building and its entrance); show each label once.
      if (c === null || seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    });

  return { status: 'ok', candidates };
}

/** One best guess for a full address, or null — used for booking pins. */
export async function geocodeBestMatch(
  address: string,
  near?: { latitude: number; longitude: number }
): Promise<GeocodeCandidate | null> {
  const result = await forwardGeocode(address, { near, limit: 1 });
  return result.status === 'ok' ? (result.candidates[0] ?? null) : null;
}
