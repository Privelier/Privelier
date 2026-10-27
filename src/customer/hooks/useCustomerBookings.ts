/**
 * The customer's bookings with live status updates and cancellation.
 *
 * REALTIME + FOCUS: the channel subscribes on customer_id and is gated on
 * focus (bottom-tab screens stay mounted). Focus opens the channel BEFORE
 * the baseline refetch, so nothing is missed in the gap; snapshot rows and
 * streamed events both fold through applyBookingChange (idempotent upsert by
 * id) and re-sort newest first. A reconnect refetches (review finding F1).
 *
 * CANCELLATION: a five-second undo window first; only then the optimistic
 * 'cancelled' and the request. On failure the card is restored with the
 * reason and the authoritative row is refetched. While a booking is in
 * flight the baseline refetch skips it, and the mutation's row is applied
 * after it resolves, so a stale snapshot cannot flip a card backward.
 *
 * PAGING: the baseline read is the newest page; "show older" fetches the
 * next keyset page and merges it. Once older pages are loaded, a focus
 * refetch of the first page leaves the cursor where it is.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { applyBookingChange, applyBookingChangeSorted, type BookingChangeEvent } from '../../shared/bookingRealtime';
import { useToast } from '../../shared/components/ToastProvider';
import { useBookingsRealtime } from '../../shared/useBookingsRealtime';
import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../../types';
import type { BookingCursor } from '../../shared/bookingPagination';
import { cancelBookingAsCustomer, fetchOwnBookingsView } from '../bookingsData';
import { fetchOwnReviewedBookingIds } from '../reviewsData';

/** Bookings render newest first: sort by (date, time) descending. */
function sortDesc(rows: BookingRow[]): BookingRow[] {
  return [...rows].sort((a, b) => {
    const ka = `${a.date}T${a.time}`;
    const kb = `${b.date}T${b.time}`;
    return ka > kb ? -1 : ka < kb ? 1 : 0;
  });
}

function mergeMaps<K, V>(previous: Map<K, V>, next: Map<K, V>): Map<K, V> {
  return next.size === 0 ? previous : new Map([...previous, ...next]);
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function useCustomerBookings(de: boolean) {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [barbersById, setBarbersById] = useState<Map<string, BarberDirectoryRow>>(new Map());
  const [servicesById, setServicesById] = useState<Map<string, ServiceRow>>(new Map());
  // Best-effort enrichment: a failed read leaves it empty, the card then
  // offers "Leave a review", and a duplicate post is refused server-side.
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // inFlightRef guards the refetch merge; inFlight drives the card spinner.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [inFlight, setInFlight] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const queuedRef = useRef<Set<string>>(new Set());
  const [queued, setQueued] = useState<Record<string, boolean>>({});
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
    const result = await fetchOwnBookingsView();
    setLoading(false);
    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }
    // Older pages keep their entries: merge, never replace.
    setBarbersById((prev) => mergeMaps(prev, result.barbersById));
    setServicesById((prev) => mergeMaps(prev, result.servicesById));
    if (!pagedOlderRef.current) {
      setHasOlder(result.hasOlder);
      setOlderCursor(result.olderCursor);
    }
    setBookings((prev) => {
      let next = prev;
      for (const row of result.bookings) {
        if (inFlightRef.current.has(row.id)) continue; // don't clobber optimistic cards
        next = applyBookingChange(next, { eventType: 'UPDATE', row });
      }
      // An all-no-op snapshot keeps the same reference: no sort, no render.
      return next === prev ? prev : sortDesc(next);
    });
    // Only the completed ids the tab could show, so the round trip stays bounded.
    const completedIds = result.bookings.filter((b) => b.status === 'completed').map((b) => b.id);
    const reviewedResult = await fetchOwnReviewedBookingIds(completedIds);
    if (reviewedResult.status === 'ok') {
      setReviewedBookingIds((prev) => new Set([...prev, ...reviewedResult.reviewedBookingIds]));
    }
  }, []);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !olderCursor) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setOlderError(null);
    const result = await fetchOwnBookingsView(olderCursor);
    loadingOlderRef.current = false;
    setLoadingOlder(false);
    if (result.status !== 'ok') {
      setOlderError(result.message);
      return;
    }
    pagedOlderRef.current = true;
    setHasOlder(result.hasOlder);
    setOlderCursor(result.olderCursor);
    setBarbersById((prev) => mergeMaps(prev, result.barbersById));
    setServicesById((prev) => mergeMaps(prev, result.servicesById));
    setBookings((prev) => {
      let next = prev;
      for (const row of result.bookings) next = applyBookingChange(next, { eventType: 'UPDATE', row });
      return next === prev ? prev : sortDesc(next);
    });
    const completedIds = result.bookings.filter((b) => b.status === 'completed').map((b) => b.id);
    const reviewedResult = await fetchOwnReviewedBookingIds(completedIds);
    if (reviewedResult.status === 'ok') {
      setReviewedBookingIds((prev) => new Set([...prev, ...reviewedResult.reviewedBookingIds]));
    }
  }, [olderCursor]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void load();
      return () => setFocused(false);
    }, [load])
  );

  const onRealtimeChange = useCallback((event: BookingChangeEvent) => {
    setBookings((prev) => applyBookingChangeSorted(prev, event, sortDesc));
  }, []);

  useBookingsRealtime({
    filterColumn: 'customer_id',
    filterValue: userId,
    onChange: onRealtimeChange,
    onRecovered: () => void load(),
    enabled: focused,
  });

  const cancelBooking = useCallback(async (row: BookingRow) => {
    if (inFlightRef.current.has(row.id)) return; // guard double taps
    inFlightRef.current.add(row.id);
    setInFlight((p) => ({ ...p, [row.id]: true }));
    setRowErrors((p) => without(p, row.id));

    // Optimistic: show cancelled immediately (this re-buckets to Past).
    setBookings((prev) => applyBookingChangeSorted(prev, { eventType: 'UPDATE', row: { ...row, status: 'cancelled' } }, sortDesc));
    const result = await cancelBookingAsCustomer(row.id);
    inFlightRef.current.delete(row.id);
    setInFlight((p) => without(p, row.id));

    if (result.status === 'ok') {
      setBookings((prev) => applyBookingChangeSorted(prev, { eventType: 'UPDATE', row: result.booking }, sortDesc));
      return;
    }
    setBookings((prev) => applyBookingChangeSorted(prev, { eventType: 'UPDATE', row }, sortDesc));
    const message = result.status === 'not_found'
      ? (de ? 'Dieser Termin wurde nicht mehr gefunden. Aktualisiere, um den aktuellen Stand zu sehen.' : 'That booking could no longer be found. Refresh to see its current status.')
      : result.message;
    setRowErrors((p) => ({ ...p, [row.id]: message }));
    void load();
  }, [load, de]);

  const queueCancellation = useCallback((row: BookingRow) => {
    if (queuedRef.current.has(row.id) || inFlightRef.current.has(row.id)) return;
    queuedRef.current.add(row.id);
    setQueued((previous) => ({ ...previous, [row.id]: true }));
    showToast({
      message: de ? 'Stornierung vorgemerkt' : 'Booking cancellation pending',
      durationMs: 5000,
      action: { label: de ? 'Rückgängig' : 'Undo', onPress: () => {} },
      onClose: (reason) => {
        queuedRef.current.delete(row.id);
        setQueued((previous) => without(previous, row.id));
        if (reason !== 'action') void cancelBooking(row);
      },
    });
  }, [cancelBooking, showToast, de]);

  return {
    bookings,
    barbersById,
    servicesById,
    reviewedBookingIds,
    loading,
    error,
    inFlight,
    rowErrors,
    queued,
    load,
    queueCancellation,
    hasOlder,
    loadingOlder,
    olderError,
    loadOlder,
  };
}
