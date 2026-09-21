import type { BarberDirectoryRow, ServiceRow } from '../types';

export const MAX_DISCOVER_SERVICE_FILTERS = 6;

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
