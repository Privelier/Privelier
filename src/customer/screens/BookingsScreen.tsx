/**
 * Customer Bookings tab — rebuild of the prototype's customer.bookings route
 * with LIVE status updates (build-order step 13-14).
 *
 * Serif header, Upcoming/Past tab strip, and booking cards (barber image +
 * name + status label, service, "Wed 8 Jul · 14:30", price, location). Real
 * data end to end via fetchOwnBookingsView (RLS scopes the read to the
 * signed-in customer's own rows).
 *
 * REALTIME: we subscribe on `customer_id`, so an accept / reject / cancel the
 * barber performs appears here live — the row's status changes and it
 * re-buckets between Upcoming and Past automatically (isUpcomingBooking keys
 * off status + slot).
 *
 * The customer can also CANCEL their own booking while it is still actionable
 * (pending OR accepted — both allowed by the actor-aware trigger, migration
 * 0011). Terminal statuses (rejected/completed/cancelled) show no action.
 *
 * FOCUS + RECONCILIATION (the flakiness-critical part):
 * - The channel is gated on focus, not mount (bottom-tab screens stay
 *   mounted). useFocusEffect flips `focused` true — opening the channel BEFORE
 *   the baseline refetch, so nothing is missed in the gap window.
 * - Both the refetched snapshot and every streamed event fold through
 *   applyBookingChange (idempotent upsert-by-id); we re-sort date/time DESC
 *   after each merge (matching the fetch order the Upcoming/Past useMemo
 *   expects).
 * - Optimistic cancel: on tap we apply status='cancelled' locally at once and
 *   mark the card in-flight; on success we re-apply the authoritative row; on
 *   failure we roll the card back and surface the reason inline.
 * - Clobber guard: while a booking id is in-flight the baseline refetch SKIPS
 *   it, and the mutation's authoritative row is re-applied after it resolves,
 *   so a stale snapshot can't flip an optimistic card backward.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../../types';
import { cancelBookingAsCustomer, fetchOwnBookingsView, isUpcomingBooking } from '../bookingsData';
import { applyBookingChange, type BookingChangeEvent } from '../../shared/bookingRealtime';
import { useBookingsRealtime } from '../../shared/useBookingsRealtime';
import { BOOKING_STATUS_LABELS, formatBookingWhen, formatMoney } from '../format';

type TabKey = 'upcoming' | 'past';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

/**
 * Confirm before cancelling — cancelling is irreversible and money-adjacent,
 * matching the destructive-action convention (Alert.alert) used elsewhere.
 */
function confirmCancel(onConfirm: () => void) {
  Alert.alert('Cancel this booking?', 'This cannot be undone.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Cancel booking', style: 'destructive', onPress: onConfirm },
  ]);
}

/** Bookings render newest-first: sort by (date, time) descending. */
function sortDesc(rows: BookingRow[]): BookingRow[] {
  return [...rows].sort((a, b) => {
    const ka = `${a.date}T${a.time}`;
    const kb = `${b.date}T${b.time}`;
    return ka > kb ? -1 : ka < kb ? 1 : 0;
  });
}

export default function BookingsScreen() {
  const { colors, fonts } = useTheme();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [barbersById, setBarbersById] = useState<Map<string, BarberDirectoryRow>>(new Map());
  const [servicesById, setServicesById] = useState<Map<string, ServiceRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('upcoming');

  const [userId, setUserId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Per-card action state — `inFlightRef` guards the refetch merge; `inFlight`
  // drives the card's spinner/disabled rendering.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [inFlight, setInFlight] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

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
    if (result.status === 'ok') {
      setBarbersById(result.barbersById);
      setServicesById(result.servicesById);
      setBookings((prev) => {
        let next = prev;
        for (const row of result.bookings) {
          if (inFlightRef.current.has(row.id)) continue; // don't clobber optimistic cards
          next = applyBookingChange(next, { eventType: 'UPDATE', row });
        }
        return sortDesc(next);
      });
    } else {
      setError(result.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Open the channel before the refetch; tear it down on blur.
      setFocused(true);
      void load();
      return () => setFocused(false);
    }, [load])
  );

  const onRealtimeChange = useCallback((event: BookingChangeEvent) => {
    setBookings((prev) => sortDesc(applyBookingChange(prev, event)));
  }, []);

  useBookingsRealtime({
    filterColumn: 'customer_id',
    filterValue: userId,
    onChange: onRealtimeChange,
    enabled: focused,
  });

  const cancelBooking = useCallback(async (row: BookingRow) => {
    if (inFlightRef.current.has(row.id)) return; // guard double-taps
    inFlightRef.current.add(row.id);
    setInFlight((p) => ({ ...p, [row.id]: true }));
    setRowErrors((p) => {
      const n = { ...p };
      delete n[row.id];
      return n;
    });

    // Optimistic: show cancelled immediately (this re-buckets to Past).
    setBookings((prev) =>
      sortDesc(applyBookingChange(prev, { eventType: 'UPDATE', row: { ...row, status: 'cancelled' } }))
    );

    const result = await cancelBookingAsCustomer(row.id);

    inFlightRef.current.delete(row.id);
    setInFlight((p) => {
      const n = { ...p };
      delete n[row.id];
      return n;
    });

    if (result.status === 'ok') {
      setBookings((prev) =>
        sortDesc(applyBookingChange(prev, { eventType: 'UPDATE', row: result.booking }))
      );
    } else {
      // Roll back to the prior row and surface the reason inline.
      setBookings((prev) => sortDesc(applyBookingChange(prev, { eventType: 'UPDATE', row })));
      const message =
        result.status === 'not_found'
          ? 'That booking could no longer be found. Refresh to see its current status.'
          : result.message;
      setRowErrors((p) => ({ ...p, [row.id]: message }));
    }
  }, []);

  const list = useMemo(() => {
    const now = new Date();
    const upcoming = tab === 'upcoming';
    const filtered = bookings.filter((b) => isUpcomingBooking(b, now) === upcoming);
    // Past shows newest first (fetch order); Upcoming reads soonest-first.
    return upcoming ? [...filtered].reverse() : filtered;
  }, [bookings, tab]);

  const showSpinner = loading && bookings.length === 0;
  const showError = error !== null && bookings.length === 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-bookings-screen"
    >
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        Bookings
      </Text>

      <View style={[styles.tabStrip, { borderBottomColor: colors.border }]}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`customer-bookings-tab-${key}`}
              style={[styles.tabButton, active ? { borderBottomColor: colors.accent } : null]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { fontFamily: fonts.bodyMedium },
                  { color: active ? colors.accentText : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showSpinner ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="customer-bookings-loading"
        />
      ) : showError ? (
        <View
          testID="customer-bookings-error"
          accessibilityRole="alert"
          style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text
              style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
              testID="customer-bookings-empty"
            >
              {tab === 'upcoming'
                ? 'No upcoming appointments yet.'
                : 'No past appointments yet.'}
            </Text>
          }
          renderItem={({ item }) => {
            const barber = barbersById.get(item.barber_id);
            const service = servicesById.get(item.service_id);
            const actionable = item.status === 'pending' || item.status === 'accepted';
            const busy = inFlight[item.id] === true;
            const rowError = rowErrors[item.id];
            return (
              <View
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                testID={`customer-bookings-row-${item.id}`}
              >
                <View style={styles.cardMain}>
                  {barber?.profile_image ? (
                    <Image source={{ uri: barber.profile_image }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.background }]}>
                      <Text style={[styles.avatarInitial, { color: colors.textSecondary, fontFamily: fonts.headingMedium }]}>
                        {barber?.name.trim().charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <Text
                        numberOfLines={1}
                        style={[styles.cardName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
                      >
                        {barber?.name ?? 'Barber'}
                      </Text>
                      <Text style={[styles.cardStatus, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                        {BOOKING_STATUS_LABELS[item.status]}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}
                    >
                      {service?.name ?? 'Service'}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                      {formatBookingWhen(item.date, item.time)}
                    </Text>
                  </View>
                  <Text style={[styles.cardPrice, { color: colors.textPrimary, fontFamily: fonts.body }]}>
                    {formatMoney(item.price)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.cardLocation, { color: colors.textSecondary, fontFamily: fonts.body }]}
                >
                  {item.location}
                </Text>

                {actionable ? (
                  busy ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.accent}
                      style={styles.cardSpinner}
                      testID={`customer-bookings-row-busy-${item.id}`}
                      accessible
                      accessibilityLabel="Cancelling booking"
                      accessibilityLiveRegion="polite"
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cancel booking"
                      testID={`booking-cancel-${item.id}`}
                      onPress={() => confirmCancel(() => cancelBooking(item))}
                      style={({ pressed }) => [
                        styles.cancelButton,
                        { borderColor: colors.error },
                        pressed ? styles.cancelPressed : null,
                      ]}
                    >
                      <Text style={[styles.cancelText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                        Cancel booking
                      </Text>
                    </Pressable>
                  )
                ) : null}

                {rowError ? (
                  <View
                    style={[styles.rowError, { borderTopColor: colors.border }]}
                    accessibilityRole="alert"
                    testID={`customer-bookings-row-error-${item.id}`}
                  >
                    <Text style={[styles.rowErrorText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                      {rowError}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 24, marginTop: 24, paddingHorizontal: 24 },
  tabStrip: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 24,
    marginTop: 24,
    borderBottomWidth: 0.5,
  },
  tabButton: {
    paddingBottom: 12,
    marginBottom: -0.5,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 12, letterSpacing: 1.5 },

  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 24, marginHorizontal: 24 },
  noticeText: { fontSize: 14 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 40 },

  listContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  card: { borderWidth: 0.5, borderRadius: 8, padding: 16, marginBottom: 12 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 4 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 20 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 16, flexShrink: 1 },
  cardStatus: { fontSize: 10, letterSpacing: 1.5 },
  cardMeta: { fontSize: 12, marginTop: 3 },
  cardPrice: { fontSize: 14 },
  cardLocation: { fontSize: 12, marginTop: 12 },

  cardSpinner: { marginTop: 16, alignSelf: 'flex-start' },
  cancelButton: {
    marginTop: 16,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: { opacity: 0.7 },
  cancelText: { fontSize: 14 },

  rowError: { marginTop: 12, borderTopWidth: 0.5, paddingTop: 12 },
  rowErrorText: { fontSize: 12 },
});
