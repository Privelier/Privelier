import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../types';
import { bookingSlotStart, isUpcomingBooking } from '../shared/bookingTime';
import { formatBookingWhen } from '../shared/format';
import { byId } from '../shared/lookup';

export const MAX_DISCOVER_SERVICE_FILTERS = 6;

const BRAND_MESSAGES = {
  de: [
    'Dein Barber kommt zu dir.',
    'Ein guter Schnitt beginnt mit Zeit für dich.',
    'Dein Zuhause. Dein Termin. Dein Rhythmus.',
    'Persönlicher Service, ganz in deiner Nähe.',
  ],
  en: [
    'Your barber comes to you.',
    'A great cut starts with time for yourself.',
    'Your place. Your appointment. Your pace.',
    'Personal service, right where you are.',
  ],
} as const;

export function getDiscoverBrandMessages(languageCode: string | null | undefined): readonly string[] {
  return languageCode?.toLowerCase().startsWith('de') ? BRAND_MESSAGES.de : BRAND_MESSAGES.en;
}

const DAY_IN_MS = 86_400_000;

export function groupServicesByBarber(
  services: readonly ServiceRow[]
): Map<string, ServiceRow[]> {
  const grouped = new Map<string, ServiceRow[]>();

  for (const service of services) {
    const current = grouped.get(service.barber_id);
    if (current) current.push(service);
    else grouped.set(service.barber_id, [service]);
  }

  return grouped;
}

export function deriveServiceFilters(
  services: readonly ServiceRow[] | null,
  limit = MAX_DISCOVER_SERVICE_FILTERS
): string[] {
  if (!services) return [];

  const counts = new Map<string, { label: string; count: number }>();
  for (const service of services) {
    const label = service.name.trim();
    const key = label.toLowerCase();
    if (!key) continue;

    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { label, count: 1 });
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit)
    .map(({ label }) => label);
}

type DiscoverFilterInput = {
  barbers: readonly BarberDirectoryRow[];
  servicesByBarber: ReadonlyMap<string, readonly ServiceRow[]>;
  servicesAvailable: boolean;
  query: string;
  activeService: string | null;
};

export function filterDiscoverBarbers({
  barbers,
  servicesByBarber,
  servicesAvailable,
  query,
  activeService,
}: DiscoverFilterInput): BarberDirectoryRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedService = servicesAvailable ? activeService?.trim().toLowerCase() : null;

  return barbers.filter((barber) => {
    const services = servicesByBarber.get(barber.id) ?? [];
    if (
      normalizedService &&
      !services.some((service) => service.name.trim().toLowerCase() === normalizedService)
    ) {
      return false;
    }

    if (!normalizedQuery) return true;
    if (barber.name.toLowerCase().includes(normalizedQuery)) return true;

    return (
      servicesAvailable &&
      services.some((service) => service.name.toLowerCase().includes(normalizedQuery))
    );
  });
}

export function selectDailySpotlight(
  barbers: readonly BarberDirectoryRow[],
  servicesByBarber: ReadonlyMap<string, readonly ServiceRow[]>,
  servicesAvailable: boolean,
  now = new Date()
): BarberDirectoryRow | null {
  if (barbers.length === 0) return null;

  const preferred = servicesAvailable
    ? barbers.filter(
        (barber) =>
          Boolean(barber.profile_image?.trim()) &&
          (servicesByBarber.get(barber.id)?.length ?? 0) > 0
      )
    : [];
  const candidates = preferred.length > 0 ? preferred : barbers;
  const ordered = [...candidates].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  );
  const epochDay = Math.floor(now.getTime() / DAY_IN_MS);

  return ordered[epochDay % ordered.length] ?? null;
}

type DiscoverPresentationInput = DiscoverFilterInput & { now?: Date };

export type DiscoverPresentation = {
  spotlight: BarberDirectoryRow | null;
  directory: BarberDirectoryRow[];
  hasActiveFilter: boolean;
};

export function buildDiscoverPresentation({
  barbers,
  servicesByBarber,
  servicesAvailable,
  query,
  activeService,
  now,
}: DiscoverPresentationInput): DiscoverPresentation {
  const hasActiveFilter =
    query.trim().length > 0 || (servicesAvailable && Boolean(activeService?.trim()));
  const filtered = filterDiscoverBarbers({
    barbers,
    servicesByBarber,
    servicesAvailable,
    query,
    activeService,
  });

  if (hasActiveFilter) {
    return { spotlight: null, directory: filtered, hasActiveFilter };
  }

  const spotlight = selectDailySpotlight(
    filtered,
    servicesByBarber,
    servicesAvailable,
    now
  );

  return {
    spotlight,
    directory: spotlight
      ? filtered.filter((barber) => barber.id !== spotlight.id)
      : filtered,
    hasActiveFilter,
  };
}

/**
 * "Up next" on Discover: the soonest booking that can still happen (pending
 * or accepted, slot not yet passed — the same predicate the Bookings tab
 * uses), with its best-effort barber/service enrichment and how many other
 * live bookings follow it. Null when nothing is upcoming.
 */
export type UpNextBooking = {
  booking: BookingRow;
  barber: BarberDirectoryRow | null;
  service: ServiceRow | null;
  laterCount: number;
};

export function selectUpNext(
  bookings: readonly BookingRow[],
  barbersById: ReadonlyMap<string, BarberDirectoryRow>,
  servicesById: ReadonlyMap<string, ServiceRow>,
  now = new Date()
): UpNextBooking | null {
  const upcoming = bookings
    .filter((booking) => isUpcomingBooking(booking, now))
    .sort((left, right) => bookingSlotStart(left).getTime() - bookingSlotStart(right).getTime());
  const next = upcoming[0];
  if (!next) return null;
  return {
    booking: next,
    barber: byId(barbersById, next.barber_id) ?? null,
    service: byId(servicesById, next.service_id) ?? null,
    laterCount: upcoming.length - 1,
  };
}

/**
 * "Book again": barbers the customer has a completed booking with, most
 * recent first, one entry each. Only barbers still in the approved directory
 * are returned, so the rail never links to a profile that would not open.
 */
export function selectRebookBarbers(
  bookings: readonly BookingRow[],
  barbersById: ReadonlyMap<string, BarberDirectoryRow>,
  limit = 8
): BarberDirectoryRow[] {
  const completed = bookings
    .filter((booking) => booking.status === 'completed')
    .sort((left, right) => bookingSlotStart(right).getTime() - bookingSlotStart(left).getTime());
  const seen = new Set<string>();
  const result: BarberDirectoryRow[] = [];
  for (const booking of completed) {
    if (!booking.barber_id || seen.has(booking.barber_id)) continue;
    seen.add(booking.barber_id);
    const barber = barbersById.get(booking.barber_id);
    if (barber) result.push(barber);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * "Highest rated": barbers with a real customer rating, best first (ties by
 * name so the order is stable). Unrated barbers never appear. It returns []
 * when fewer than two are rated, or when the directory is small enough that
 * the rail above already shows everyone (the section would only repeat it).
 */
export const TOP_RATED_MIN_DIRECTORY = 4;

export function selectTopRated(
  barbers: readonly BarberDirectoryRow[],
  limit = 3
): BarberDirectoryRow[] {
  if (barbers.length < TOP_RATED_MIN_DIRECTORY) return [];
  const rated = barbers
    .filter((barber) => Number.isFinite(barber.rating) && barber.rating > 0)
    .sort((left, right) => right.rating - left.rating || left.name.localeCompare(right.name));
  return rated.length < 2 ? [] : rated.slice(0, limit);
}

/** Directory barbers that can appear on the Explore map (display coordinates set). */
export function selectMappableBarbers(barbers: readonly BarberDirectoryRow[]): BarberDirectoryRow[] {
  return barbers.filter(
    (barber) => Number.isFinite(barber.display_latitude) && Number.isFinite(barber.display_longitude)
  );
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "Today · 14:30", "Tomorrow · 09:00", else the standard booking date line.
 * Calendar days are compared at local midnight so a slot at 00:30 tomorrow
 * reads as tomorrow even when it is under an hour away.
 */
export function formatUpNextWhen(booking: Pick<BookingRow, 'date' | 'time'>, now = new Date(), de = false): string {
  const slot = bookingSlotStart(booking);
  const clock = booking.time.slice(0, 5);
  if (Number.isNaN(slot.getTime())) return formatBookingWhen(booking.date, booking.time);
  const days = Math.round((startOfDay(slot) - startOfDay(now)) / DAY_IN_MS);
  if (days === 0) return `${de ? 'Heute' : 'Today'} · ${clock}`;
  if (days === 1) return `${de ? 'Morgen' : 'Tomorrow'} · ${clock}`;
  return formatBookingWhen(booking.date, booking.time);
}

/**
 * A short countdown for a slot within the next 24 hours ("in 2 h 15 min",
 * "in 25 min", "starting now"); null when the slot is further away or the
 * row is malformed. Callers re-render it on a minute tick.
 */
export function formatStartsIn(booking: Pick<BookingRow, 'date' | 'time'>, now = new Date(), de = false): string | null {
  const slot = bookingSlotStart(booking);
  if (Number.isNaN(slot.getTime())) return null;
  const minutes = Math.ceil((slot.getTime() - now.getTime()) / 60_000);
  if (minutes > 24 * 60) return null;
  if (minutes <= 0) return de ? 'Beginnt jetzt' : 'Starting now';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const span = hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  return `In ${span}`; // "In" reads the same in German and English
}
