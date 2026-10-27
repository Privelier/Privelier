/**
 * Discover's data: the customer's profile city, the approved directory for
 * that city, service and stats enrichment, and the customer's own bookings
 * (for "Up next" and "Book again").
 *
 * Service data is optional enrichment: if its read fails, the directory and
 * barber-name search stay available while service filters and prices hide.
 * The own-bookings read is optional too and never blocks discovery.
 *
 * The directory is keyed by the profile city, which the customer can change
 * in Edit profile. On refocus, one profile read decides whether the city
 * changed; only then is the directory reloaded, so ordinary tab switches
 * cost no list requests.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOwnProfile } from '../../auth/authService';
import { fetchBarberStats, type BarberStatsRow } from '../../shared/barberStats';
import type { BarberDirectoryRow, ServiceRow } from '../../types';
import { fetchOwnBookingsView } from '../bookingsData';
import { listBarbersByCity, listServicesForBarberIds } from '../discoveryData';
import type { OwnBookingsViewResult } from '../types';

type OwnBookings = Extract<OwnBookingsViewResult, { status: 'ok' }>;

export function useDiscoverData({
  de,
  onFocus,
}: {
  de: boolean;
  /** Subscribes to screen focus; returns the unsubscribe function. */
  onFocus: (listener: () => void) => () => void;
}) {
  const [ownName, setOwnName] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [serviceArea, setServiceArea] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberDirectoryRow[]>([]);
  const [statsById, setStatsById] = useState<Map<string, BarberStatsRow>>(new Map());
  const [services, setServices] = useState<ServiceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingCity, setMissingCity] = useState(false);
  // The service filter lives here because a reload drops a filter whose
  // service no longer exists.
  const [activeService, setActiveService] = useState<string | null>(null);
  const [ownBookings, setOwnBookings] = useState<OwnBookings | null>(null);

  const loadOwnBookings = useCallback(async () => {
    try {
      const result = await fetchOwnBookingsView();
      if (result.status === 'ok') setOwnBookings(result);
    } catch {
      // Keep the last good snapshot; the directory does not depend on it.
    }
  }, []);

  const load = useCallback(async () => {
    void loadOwnBookings();
    setLoading(true);
    setError(null);
    setMissingCity(false);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error') {
      setLoading(false);
      setError(profileResult.message);
      return;
    }
    setOwnName(profileResult.profile?.name ?? null);

    const city = profileResult.profile?.city?.trim();
    if (!city) {
      setLoading(false);
      setMissingCity(true);
      setHasSnapshot(false);
      setCityName(null);
      setServiceArea(null);
      setBarbers([]);
      setServices(null);
      setError(de ? 'Füge deine Stadt hinzu, um verifizierte Barber in deiner Nähe zu finden.' : 'Add your city to discover verified barbers near you.');
      return;
    }
    const country = profileResult.profile?.country?.trim();
    const barbersResult = await listBarbersByCity(city);
    if (barbersResult.status !== 'ok') {
      setLoading(false);
      setError(barbersResult.message);
      return;
    }
    setCityName(city);
    setServiceArea(country ? `${city}, ${country}` : city);
    setBarbers(barbersResult.barbers);
    setHasSnapshot(true);

    const barberIds = barbersResult.barbers.map((barber) => barber.id);
    // Stats ride alongside services in parallel; they only decorate cards.
    const [servicesResult, stats] = await Promise.all([
      listServicesForBarberIds(barberIds),
      fetchBarberStats(barberIds),
    ]);
    setStatsById(stats);
    if (servicesResult.status === 'ok') {
      setServices(servicesResult.services);
      setActiveService((current) => {
        if (!current) return null;
        const stillAvailable = servicesResult.services.some(
          (service) => service.name.trim().toLowerCase() === current.toLowerCase()
        );
        return stillAvailable ? current : null;
      });
    } else {
      setServices(null);
      setActiveService(null);
    }
    setLoading(false);
  }, [de, loadOwnBookings]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const loadedCityRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Recorded only once a load has settled on a city (or on "no city").
    if (hasSnapshot || missingCity) loadedCityRef.current = missingCity ? null : cityName;
  }, [cityName, missingCity, hasSnapshot]);
  useEffect(() => {
    return onFocus(() => {
      if (loadedCityRef.current === undefined) return; // first load still owns this
      // A booking made or answered elsewhere shows up here on return.
      void loadOwnBookings();
      void fetchOwnProfile().then((result) => {
        if (result.status !== 'ok') return;
        const city = result.profile?.city?.trim() || null;
        const loaded = loadedCityRef.current?.trim() || null;
        if ((city ?? '').toLocaleLowerCase() !== (loaded ?? '').toLocaleLowerCase()) void load();
      });
    });
  }, [onFocus, load, loadOwnBookings]);

  return {
    ownName,
    cityName,
    serviceArea,
    barbers,
    statsById,
    services,
    loading,
    hasSnapshot,
    error,
    missingCity,
    activeService,
    setActiveService,
    ownBookings,
    load,
  };
}
