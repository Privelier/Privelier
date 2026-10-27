/**
 * The barber's live trip for one booking: the tripService subscription, the
 * map scene, the trip phase and the start / navigate / arrive / stop / share
 * actions. Leaving the screen does NOT stop a trip; it runs until arrival,
 * "Stop sharing", or the booking being completed or cancelled.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { openNavigationTo } from '../../shared/bookingActions';
import { useToast } from '../../shared/components/ToastProvider';
import type { TripPhase } from '../../shared/components/trip/TripStatusPanel';
import { formatBookingWhen } from '../../shared/format';
import { haptics } from '../../shared/haptics';
import type { MapScene } from '../../shared/maps/mapScene';
import { askForPushPermissionInContext } from '../../shared/push';
import { formatEta } from '../../shared/tracking/eta';
import { remainingLine } from '../../shared/tracking/geo';
import { shareTrip } from '../../shared/tracking/safety';
import type { BookingRow } from '../../types';
import { arriveNow, resumeActiveTrip, startTrip, stopTrip, subscribeToTrip, type LiveTripState, type StartTripError } from '../trip/tripService';

export function useBarberTrip(booking: BookingRow, customerName: string, de: boolean) {
  const { showToast } = useToast();
  const [live, setLive] = useState<LiveTripState | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<StartTripError | null>(null);

  useEffect(() => {
    void resumeActiveTrip();
    return subscribeToTrip((next) => setLive(next && next.bookingId === booking.id ? next : null));
  }, [booking.id]);

  const destination = useMemo(
    () =>
      live?.destination ??
      (booking.location_longitude != null && booking.location_latitude != null
        ? ([booking.location_longitude, booking.location_latitude] as [number, number])
        : null),
    [live?.destination, booking.location_latitude, booking.location_longitude]
  );

  const scene = useMemo<MapScene>(() => {
    if (!live) return { camera: 'fit', destination };
    const projection = live.snapshot?.projection ?? null;
    const coordinates = live.route.coordinates;
    return {
      camera: 'follow',
      destination: live.destination,
      route: live.route.source === 'estimate' ? null : coordinates,
      routeAhead: live.arrived || live.route.source === 'estimate' ? null : projection ? remainingLine(coordinates, projection) : coordinates,
      vehicle: live.position ? { lngLat: live.position, heading: live.heading } : null,
    };
  }, [live, destination]);

  const start = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    void haptics.confirm();
    const result = await startTrip(booking);
    setStarting(false);
    if (result.status === 'ok') {
      void haptics.success();
      // The barber benefits too (arrival confirmations, messages en route).
      void askForPushPermissionInContext();
    } else {
      void haptics.warning();
      setStartError(result.code);
    }
  }, [booking, starting]);

  const navigate = useCallback(async () => {
    if (!destination) return;
    const result = await openNavigationTo(destination[1], destination[0]);
    if (result === 'unavailable') showToast({ message: de ? 'Keine Karten-App gefunden.' : 'No maps app is available.' });
  }, [destination, de, showToast]);

  const arrive = useCallback(async () => {
    void haptics.success();
    await arriveNow();
  }, []);

  const stop = useCallback(async () => {
    await stopTrip(booking.id);
    showToast({ message: de ? 'Standortfreigabe beendet.' : 'Location sharing stopped.' });
  }, [booking.id, de, showToast]);

  const liveEtaS = live?.snapshot?.etaS ?? null;
  const share = useCallback(() => {
    void shareTrip({
      bookingId: booking.id,
      role: 'barber',
      counterpartName: customerName,
      address: booking.location,
      whenText: formatBookingWhen(booking.date, booking.time),
      etaText: liveEtaS != null ? formatEta(liveEtaS, de) : null,
    });
  }, [booking, customerName, liveEtaS, de]);

  const phase: TripPhase = !live
    ? 'starting'
    : live.arrived
      ? 'arrived'
      : (live.snapshot?.etaS ?? Infinity) <= 300
        ? 'arriving'
        : 'en_route';

  return { live, starting, startError, scene, phase, start, navigate, arrive, stop, share };
}
