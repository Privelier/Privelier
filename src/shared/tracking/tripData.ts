/**
 * Live trip rows (public.booking_trips, migration 0049) for both apps.
 *
 * Reads: participants only (RLS). Writes: the barber, through the
 * start_trip / update_trip_position / mark_trip_arrived / end_trip RPCs —
 * see src/barber/trip/tripService.ts. The table keeps only the LATEST
 * position and wipes it when the trip ends; there is no history to fetch.
 *
 * useLiveTrip opens the Realtime channel BEFORE the baseline read (same rule
 * as useBookingsRealtime): an update landing between the two can then never
 * be lost, and applying the older baseline after a newer event is guarded by
 * updated_at.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { decodePolyline, lineLengthM, type LngLat } from './geo';
import { devWarn } from '../devLog';

type TripStatus = 'en_route' | 'arrived' | 'ended';

export interface BookingTripRow {
  booking_id: string;
  barber_id: string;
  customer_id: string;
  status: TripStatus;
  dest_latitude: number | null;
  dest_longitude: number | null;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed_mps: number | null;
  accuracy_m: number | null;
  position_at: string | null;
  remaining_distance_m: number | null;
  eta_at: string | null;
  route_polyline: string | null;
  route_source: 'osrm' | 'valhalla' | 'estimate' | null;
  started_at: string;
  arriving_notified_at: string | null;
  arrived_at: string | null;
  ended_at: string | null;
  updated_at: string;
}

/** A position older than this is shown as "last known", not live. */
const STALE_AFTER_MS = 90_000;

async function fetchTrip(bookingId: string): Promise<BookingTripRow | null> {
  const { data, error } = await supabase.from('booking_trips').select('*').eq('booking_id', bookingId).maybeSingle();
  if (error) {
    devWarn('[tripData] fetchTrip', error);
    return null;
  }
  return (data as BookingTripRow | null) ?? null;
}

const newer = (a: BookingTripRow | null, b: BookingTripRow) => !a || b.updated_at >= a.updated_at;

let channelSequence = 0;

export function useLiveTrip(bookingId: string | null): { trip: BookingTripRow | null; loading: boolean } {
  const [trip, setTrip] = useState<BookingTripRow | null>(null);
  const [loading, setLoading] = useState(bookingId !== null);

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    const channel = supabase
      .channel(`trip:${bookingId}:${Date.now()}:${++channelSequence}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_trips', filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          if (!active) return;
          const row = payload.new as BookingTripRow | undefined;
          if (row && row.booking_id) setTrip((current) => (newer(current, row) ? row : current));
        }
      )
      .subscribe();

    void fetchTrip(bookingId).then((row) => {
      if (!active) return;
      if (row) setTrip((current) => (newer(current, row) ? row : current));
      setLoading(false);
    });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [bookingId]);

  return { trip, loading };
}

export interface TripView {
  status: TripStatus;
  position: LngLat | null;
  destination: LngLat | null;
  heading: number | null;
  route: LngLat[] | null;
  remainingM: number | null;
  /** Seconds until arrival, recomputed against the local clock. */
  etaS: number | null;
  stale: boolean;
  /** 0..1 progress along the route (from remaining vs total route). */
  progress: number | null;
}

/** Derives display values, re-evaluated every few seconds for a live countdown. */
export function useTripView(trip: BookingTripRow | null, tickMs = 5000): TripView | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!trip || trip.status === 'ended') return;
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [trip, tickMs]);

  const polyline = trip?.route_polyline ?? null;
  const remainingDistanceM = trip?.remaining_distance_m ?? null;
  const route = useMemo(() => (polyline ? decodePolyline(polyline) : null), [polyline]);
  // The stored route starts where the trip (or the last reroute) started, so
  // its length is the total to measure progress against — correct even when
  // the customer opens tracking halfway through. No history needed.
  const routeTotalM = useMemo(() => {
    const length = route ? lineLengthM(route) : 0;
    return Math.max(length, remainingDistanceM ?? 0) || null;
  }, [route, remainingDistanceM]);

  return useMemo(() => {
    if (!trip) return null;
    const position: LngLat | null =
      trip.longitude != null && trip.latitude != null ? [trip.longitude, trip.latitude] : null;
    const destination: LngLat | null =
      trip.dest_longitude != null && trip.dest_latitude != null ? [trip.dest_longitude, trip.dest_latitude] : null;
    const positionAge = trip.position_at ? now - Date.parse(trip.position_at) : Infinity;
    const etaS =
      trip.status === 'arrived' ? 0 : trip.eta_at ? Math.max(0, Math.round((Date.parse(trip.eta_at) - now) / 1000)) : null;
    const progress =
      trip.status === 'arrived'
        ? 1
        : routeTotalM && trip.remaining_distance_m != null
          ? Math.min(1, Math.max(0, 1 - trip.remaining_distance_m / routeTotalM))
          : null;
    return {
      status: trip.status,
      position,
      destination,
      heading: trip.heading,
      route,
      remainingM: trip.remaining_distance_m,
      etaS,
      stale: trip.status === 'en_route' && positionAge > STALE_AFTER_MS,
      progress,
    };
  }, [trip, now, route, routeTotalM]);
}
