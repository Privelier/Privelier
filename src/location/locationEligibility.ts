/**
 * Privacy-minimal location eligibility for Privelier's current service area.
 * The gateway's coordinates exist only inside this function while native
 * reverse geocoding runs; callers receive a derived availability result.
 */
export const MAX_ACCEPTABLE_ACCURACY_METERS = 1_000;

export type LocationEligibility =
  | { status: 'eligible'; city: 'Nuremberg'; country: 'Germany' }
  | { status: 'permission_denied' }
  | { status: 'unavailable' }
  | { status: 'outside_service_area' };

export interface LocationGateway {
  requestForegroundPermission: () => Promise<'granted' | 'denied'>;
  getCurrentPlace: () => Promise<{
    accuracy: number | null;
    place: { city: string | null; country: string | null } | null;
  }>;
}

function normalize(value: string | null): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isNurembergGermany(place: { city: string | null; country: string | null }): boolean {
  const city = normalize(place.city);
  const country = normalize(place.country);
  return (city === 'nuremberg' || city === 'nurnberg' || city === 'nuernberg') &&
    (country === 'germany' || country === 'deutschland');
}

/** Requests foreground permission once and evaluates only the current fix. */
export async function checkLocationEligibility(gateway: LocationGateway): Promise<LocationEligibility> {
  try {
    if ((await gateway.requestForegroundPermission()) !== 'granted') {
      return { status: 'permission_denied' };
    }

    const current = await gateway.getCurrentPlace();
    if (
      current.accuracy === null ||
      !Number.isFinite(current.accuracy) ||
      current.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS
    ) {
      return { status: 'unavailable' };
    }

    if (!current.place) return { status: 'unavailable' };
    return isNurembergGermany(current.place)
      ? { status: 'eligible', city: 'Nuremberg', country: 'Germany' }
      : { status: 'outside_service_area' };
  } catch {
    return { status: 'unavailable' };
  }
}
