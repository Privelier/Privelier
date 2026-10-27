/**
 * Data for the customer Explore tab. Reuses the Discover read chain: own
 * city via fetchOwnProfile → listBarbersByCity → one batched services read +
 * one batched availability read. The enrichment reads back the filter chips:
 * a chip whose read failed is HIDDEN rather than silently filtering everyone
 * out (a failed availability read must not render as "no one is available").
 *
 * The mount load is a deferred plain useEffect (component-testable, same
 * set-state-in-effect rationale as Discover); saved barbers are re-read on
 * every focus because they change on the profile screen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchOwnProfile } from '../../auth/authService';
import type { AvailabilityRow, BarberDirectoryRow, ServiceRow } from '../../types';
import { listAvailabilityForBarberIds } from '../availabilityData';
import { listBarbersByCity, listServicesForBarberIds } from '../discoveryData';
import { applyExploreFilter, toMapPin, type ExploreFilterKey } from '../exploreData';
import { listFavoriteBarberIds } from '../personalData';

function groupByBarber<T extends { barber_id: string }>(rows: T[] | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows ?? []) {
    const list = map.get(row.barber_id);
    if (list) list.push(row);
    else map.set(row.barber_id, [row]);
  }
  return map;
}

export function useExploreData(de: boolean, addFocusListener: (listener: () => void) => () => void) {
  const [city, setCity] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberDirectoryRow[]>([]);
  const [services, setServices] = useState<ServiceRow[] | null>(null);
  const [windows, setWindows] = useState<AvailabilityRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExploreFilterKey>('all');
  // null = unknown -> the Saved chip stays hidden.
  const [favoriteIds, setFavoriteIds] = useState<Set<string> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error') {
      setLoading(false);
      setError(profileResult.message);
      return;
    }
    const ownCity = profileResult.profile?.city?.trim();
    if (!ownCity) {
      setLoading(false);
      setError(de ? 'Wir konnten deine Stadt nicht bestätigen. Versuch es erneut.' : 'We could not confirm your service area. Try again.');
      return;
    }
    setCity(ownCity);

    const barbersResult = await listBarbersByCity(ownCity);
    if (barbersResult.status !== 'ok') {
      setLoading(false);
      setError(barbersResult.message);
      return;
    }
    setBarbers(barbersResult.barbers);

    // null = read failed = that chip hides.
    const ids = barbersResult.barbers.map((b) => b.id);
    const [servicesResult, windowsResult] = await Promise.all([
      listServicesForBarberIds(ids),
      listAvailabilityForBarberIds(ids),
    ]);
    setServices(servicesResult.status === 'ok' ? servicesResult.services : null);
    setWindows(windowsResult.status === 'ok' ? windowsResult.windows : null);
    setLoading(false);
  }, [de]);

  useEffect(() => {
    const refresh = () => {
      void listFavoriteBarberIds().then((result) => setFavoriteIds(result.status === 'ok' ? result.ids : null));
    };
    refresh();
    return addFocusListener(refresh);
  }, [addFocusListener]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const servicesByBarber = useMemo(() => groupByBarber(services), [services]);
  const windowsByBarber = useMemo(() => groupByBarber(windows), [windows]);

  // Chips whose backing data actually loaded.
  const availableChips = useMemo(() => {
    const chips: ExploreFilterKey[] = ['all'];
    if (favoriteIds !== null && favoriteIds.size > 0) chips.push('saved');
    if (windows !== null) chips.push('today');
    if (services !== null) chips.push('under100');
    return chips;
  }, [services, windows, favoriteIds]);

  const filtered = useMemo(
    () => applyExploreFilter(barbers, filter, { servicesByBarber, windowsByBarber, now: new Date(), favoriteIds: favoriteIds ?? undefined }),
    [barbers, filter, servicesByBarber, windowsByBarber, favoriteIds]
  );

  // Map pins: OFFSET display coordinates only; a barber without location
  // data has no pin. Derived from the FILTERED list so chips govern the map too.
  const pins = useMemo(
    () => filtered.map((b) => toMapPin(b, servicesByBarber.get(b.id) ?? [])).filter((p): p is NonNullable<typeof p> => p !== null),
    [filtered, servicesByBarber]
  );

  const barbersById = useMemo(() => new Map(barbers.map((b) => [b.id, b])), [barbers]);

  const selectChip = useCallback((key: ExploreFilterKey) => {
    setFilter((prev) => (prev === key && key !== 'all' ? 'all' : key));
  }, []);

  return { city, barbers, loading, error, load, filter, selectChip, availableChips, filtered, pins, barbersById, servicesByBarber };
}
