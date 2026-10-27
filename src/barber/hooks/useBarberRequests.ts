/**
 * The barber's bookings with live status and the four transitions (accept,
 * reject, complete, cancel). The actor-aware trigger (migration 0011) is the
 * authority; this hook only predicts the outcome and reconciles.
 *
 * REALTIME + FOCUS: the channel subscribes on barber_id and is gated on
 * focus; focus opens it BEFORE the baseline refetch so nothing is missed.
 * Snapshot rows and streamed events fold through applyBookingChange
 * (idempotent upsert by id), sorted soonest first.
 *
 * OPTIMISTIC TRANSITIONS: the predicted row shows at once; on success the
 * authoritative row is re-applied (its realtime echo is a no-op); on
 * failure the card rolls back with the reason. While a booking is in flight
 * the baseline refetch skips it, so a stale snapshot cannot flip it back.
 *
 * PAGING: the baseline read is the newest page; "show older" fetches the
 * next keyset page and merges it. Once older pages are loaded, a focus
 * refetch of the first page leaves the cursor where it is.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { applyBookingChange, applyBookingChangeSorted, type BookingChangeEvent } from '../../shared/bookingRealtime';
import { useBookingsRealtime } from '../../shared/useBookingsRealtime';
import type { BookingRow, ServiceRow } from '../../types';
import type { BookingCursor } from '../../shared/bookingPagination';
import { sortAsc } from '../requestPresentation';
import { fetchOwnRequestsView } from '../requestsData';
import type { BookingCounterpart, TransitionBookingResult } from '../types';

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function mergeMaps<K, V>(previous: Map<K, V>, next: Map<K, V>): Map<K, V> {
  return next.size === 0 ? previous : new Map([...previous, ...next]);
}

function mergeRows(prev: BookingRow[], rows: BookingRow[], skip: ReadonlySet<string>): BookingRow[] {
  let next = prev;
  for (const row of rows) {
    if (skip.has(row.id)) continue; // never flip a card mid-write
    next = applyBookingChange(next, { eventType: 'UPDATE', row });
  }
  // An all-no-op snapshot keeps the same reference: no sort, no render.
  return next === prev ? prev : sortAsc(next);
}

export function useBarberRequests(de: boolean) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [servicesById, setServicesById] = useState<Map<string, ServiceRow>>(new Map());
  const [counterpartsById, setCounterpartsById] = useState<Map<string, BookingCounterpart>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // inFlightRef guards the refetch merge; inFlight drives the card spinner.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [inFlight, setInFlight] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [celebration, setCelebration] = useState<string | null>(null);
  const clearCelebration = useCallback(() => setCelebration(null), []);
  const [hasOlder, setHasOlder] = useState(false);
  const [olderCursor, setOlderCursor] = useState<BookingCursor | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const pagedOlderRef = useRef(false);
  const loadingOlderRef = useRef(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOwnRequestsView();
    setLoading(false);
    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }
    // Older pages keep their entries: merge, never replace.
    setServicesById((prev) => mergeMaps(prev, result.servicesById));
    setCounterpartsById((prev) => mergeMaps(prev, result.counterpartsByBookingId));
    if (!pagedOlderRef.current) {
      setHasOlder(result.hasOlder);
      setOlderCursor(result.olderCursor);
    }
    setBookings((prev) => mergeRows(prev, result.bookings, inFlightRef.current));
  }, []);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !olderCursor) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setOlderError(null);
    const result = await fetchOwnRequestsView(olderCursor);
    loadingOlderRef.current = false;
    setLoadingOlder(false);
    if (result.status !== 'ok') {
      setOlderError(result.message);
      return;
    }
    pagedOlderRef.current = true;
    setHasOlder(result.hasOlder);
    setOlderCursor(result.olderCursor);
    setServicesById((prev) => mergeMaps(prev, result.servicesById));
    setCounterpartsById((prev) => mergeMaps(prev, result.counterpartsByBookingId));
    setBookings((prev) => mergeRows(prev, result.bookings, inFlightRef.current));
  }, [olderCursor]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void load();
      return () => setFocused(false);
    }, [load])
  );

  const onRealtimeChange = useCallback((event: BookingChangeEvent) => {
    setBookings((prev) => applyBookingChangeSorted(prev, event, sortAsc));
  }, []);

  useBookingsRealtime({
    filterColumn: 'barber_id',
    filterValue: userId,
    onChange: onRealtimeChange,
    onRecovered: () => void load(),
    enabled: focused,
  });

  const runTransition = useCallback(
    async (row: BookingRow, nextStatus: BookingRow['status'], mutate: (id: string) => Promise<TransitionBookingResult>) => {
      if (inFlightRef.current.has(row.id)) return; // guard double taps
      inFlightRef.current.add(row.id);
      setInFlight((p) => ({ ...p, [row.id]: true }));
      setRowErrors((p) => without(p, row.id));
      setBookings((prev) => applyBookingChangeSorted(prev, { eventType: 'UPDATE', row: { ...row, status: nextStatus } }, sortAsc));

      const result = await mutate(row.id);
      inFlightRef.current.delete(row.id);
      setInFlight((p) => without(p, row.id));

      if (result.status === 'ok') {
        setBookings((prev) => applyBookingChangeSorted(prev, { eventType: 'UPDATE', row: result.booking }, sortAsc));
        if (nextStatus === 'accepted') setCelebration(de ? 'Termin bestätigt' : 'Booking accepted');
        else if (nextStatus === 'completed') setCelebration(de ? 'Gut gemacht' : 'Nicely done');
        return;
      }
      setBookings((prev) => applyBookingChangeSorted(prev, { eventType: 'UPDATE', row }, sortAsc));
      const message = result.status === 'not_found'
        ? (de ? 'Dieser Termin wurde nicht mehr gefunden. Aktualisiere, um den aktuellen Stand zu sehen.' : 'That booking could no longer be found. Refresh to see its current status.')
        : result.message;
      setRowErrors((p) => ({ ...p, [row.id]: message }));
    },
    [de]
  );

  return {
    bookings,
    servicesById,
    counterpartsById,
    loading,
    error,
    inFlight,
    rowErrors,
    celebration,
    clearCelebration,
    load,
    runTransition,
    hasOlder,
    loadingOlder,
    olderError,
    loadOlder,
  };
}
