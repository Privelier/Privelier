/**
 * Barber Requests tab — rebuild of the prototype's barber.requests route with
 * LIVE status transitions (build-order step 13-14).
 *
 * A serif header + subtitle and booking-request cards (serif title, slot line,
 * location, price + status label). Real data end to end via
 * fetchOwnRequestsView (RLS scopes bookings to the signed-in barber); the four
 * status-transition mutations (accept / reject / complete / cancel) are
 * authorized server-side by the actor-aware trigger (migration 0011) — this
 * screen never re-checks a transition client-side, it only optimistically
 * predicts the outcome and reconciles.
 *
 * Actions per state (authoritative state machine only):
 * - pending  -> Accept (primary, brass) + Reject
 * - accepted -> Mark complete + Cancel
 * - rejected / completed / cancelled -> terminal, no actions.
 *
 * Cards lead with the CUSTOMER's real name + photo when the
 * get_booking_counterparts RPC (migration 0012) returned one; otherwise they
 * fall back to the service name (the RPC is best-effort — a failure leaves the
 * map empty rather than failing the whole view).
 *
 * REALTIME + FOCUS RECONCILIATION (the flakiness-critical part):
 * - The channel is gated on focus, not mount: bottom-tab screens stay mounted,
 *   so a mount-gated channel would leak across tab switches. useFocusEffect
 *   flips `focused` true (opening the channel via useBookingsRealtime) BEFORE
 *   kicking off the baseline refetch, so any write that lands in the gap
 *   between "subscription active" and "snapshot returned" also arrives on the
 *   stream — nothing is missed.
 * - BOTH the refetched snapshot and every streamed event fold through
 *   applyBookingChange (idempotent upsert-by-id); overlap is harmless, no dedup
 *   logic. We re-sort date/time ASC (soonest first) after every merge.
 * - Optimistic action: on tap we apply the predicted row locally at once and
 *   mark the card in-flight; on success we re-apply the authoritative returned
 *   row (a no-op vs. its realtime echo); on failure we roll the card back to
 *   its prior row and surface the error inline.
 * - Clobber guard: while a booking id is in-flight, the baseline refetch SKIPS
 *   it (so a stale snapshot cannot flip an optimistic card backward mid-write),
 *   and the mutation's authoritative row is re-applied AFTER it resolves — so
 *   even a snapshot that raced past the write converges to the correct status.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import type { Palette } from '../../theme/colors';
import type { BookingCounterpart, TransitionBookingResult } from '../types';
import type { BookingRow, ServiceRow } from '../../types';
import {
  acceptBooking,
  cancelBookingAsBarber,
  completeBooking,
  fetchOwnRequestsView,
  rejectBooking,
} from '../requestsData';
import {
  applyBookingChange,
  applyBookingChangeSorted,
  type BookingChangeEvent,
} from '../../shared/bookingRealtime';
import { useBookingsRealtime } from '../../shared/useBookingsRealtime';
import { BOOKING_STATUS_LABELS, formatBookingWhen, formatMoney } from '../../shared/format';

/**
 * Confirm an irreversible transition before running it, matching the
 * destructive-action convention established in ServicesScreen (Alert.alert with
 * a cancel + destructive option). Accept / Mark complete are not destructive
 * and stay one-tap.
 */
function confirmDestructive(title: string, confirmLabel: string, onConfirm: () => void) {
  Alert.alert(title, 'This cannot be undone.', [
    { text: 'Keep', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Requests read soonest-first: sort by (date, time) ascending. */
function sortAsc(rows: BookingRow[]): BookingRow[] {
  return [...rows].sort((a, b) => {
    const ka = `${a.date}T${a.time}`;
    const kb = `${b.date}T${b.time}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export default function RequestsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(colors);

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [servicesById, setServicesById] = useState<Map<string, ServiceRow>>(new Map());
  const [counterpartsById, setCounterpartsById] = useState<Map<string, BookingCounterpart>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Per-card action state. `inFlightRef` is the source of truth the baseline
  // refetch reads to avoid clobbering an optimistic card; `inFlight` state
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
    const result = await fetchOwnRequestsView();
    setLoading(false);
    if (result.status === 'ok') {
      setServicesById(result.servicesById);
      setCounterpartsById(result.counterpartsByBookingId);
      setBookings((prev) => {
        let next = prev;
        for (const row of result.bookings) {
          // Don't let a snapshot flip a card that is mid-write backward.
          if (inFlightRef.current.has(row.id)) continue;
          next = applyBookingChange(next, { eventType: 'UPDATE', row });
        }
        // An all-no-op snapshot (the common refocus/recovery case) keeps the
        // same reference — no sort, no re-render.
        return next === prev ? prev : sortAsc(next);
      });
    } else {
      setError(result.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Open the channel (focused -> enabled) BEFORE the refetch so no event
      // is missed in the gap window; tear it down on blur.
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
    // A reconnect after a network blip may have dropped events — refetch the
    // baseline (idempotent merge makes this race-free; review finding F1).
    onRecovered: load,
    enabled: focused,
  });

  const runTransition = useCallback(
    async (
      row: BookingRow,
      nextStatus: BookingRow['status'],
      mutate: (id: string) => Promise<TransitionBookingResult>
    ) => {
      if (inFlightRef.current.has(row.id)) return; // guard double-taps
      inFlightRef.current.add(row.id);
      setInFlight((p) => ({ ...p, [row.id]: true }));
      setRowErrors((p) => {
        const n = { ...p };
        delete n[row.id];
        return n;
      });

      // Optimistic: show the predicted status immediately.
      setBookings((prev) =>
        applyBookingChangeSorted(prev, { eventType: 'UPDATE', row: { ...row, status: nextStatus } }, sortAsc)
      );

      const result = await mutate(row.id);

      inFlightRef.current.delete(row.id);
      setInFlight((p) => {
        const n = { ...p };
        delete n[row.id];
        return n;
      });

      if (result.status === 'ok') {
        // Re-apply the authoritative row — corrects any stale refetch that
        // raced past the write; the realtime echo then reconciles to a no-op.
        setBookings((prev) =>
          applyBookingChangeSorted(prev, { eventType: 'UPDATE', row: result.booking }, sortAsc)
        );
      } else {
        // Roll the card back to its prior state and surface the reason inline.
        setBookings((prev) => applyBookingChangeSorted(prev, { eventType: 'UPDATE', row }, sortAsc));
        const message =
          result.status === 'not_found'
            ? 'That booking could no longer be found. Refresh to see its current status.'
            : result.message;
        setRowErrors((p) => ({ ...p, [row.id]: message }));
      }
    },
    []
  );

  const showSpinner = loading && bookings.length === 0;
  const showError = error !== null && bookings.length === 0;

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
      testID="barber-requests-screen"
    >
      <View style={styles.header}>
        <Text style={styles.heading}>Requests</Text>
        <Text style={styles.subtitle}>Booking requests from your clients.</Text>
      </View>

      {showSpinner ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="barber-requests-loading"
        />
      ) : showError ? (
        <View testID="barber-requests-error" accessibilityRole="alert" style={styles.notice}>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText} testID="barber-requests-empty">
                No booking requests yet.
              </Text>
              <Text style={styles.emptyHint}>
                Requests appear here the moment a client books you.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const service = servicesById.get(item.service_id);
            const counterpart = counterpartsById.get(item.id);
            const busy = inFlight[item.id] === true;
            const rowError = rowErrors[item.id];
            // Lead with the customer's name when known; fall back to service.
            const title = counterpart?.name ?? service?.name ?? 'Booking';
            const subline = counterpart ? service?.name ?? 'Service' : formatBookingWhen(item.date, item.time);

            return (
              <View style={styles.card} testID={`barber-requests-row-${item.id}`}>
                <View style={styles.cardTop}>
                  {counterpart?.profile_image ? (
                    <Image source={{ uri: counterpart.profile_image }} style={styles.avatar} />
                  ) : counterpart ? (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>
                        {counterpart.name.trim().charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.cardInfo}>
                    <Text numberOfLines={1} style={styles.cardTitle}>
                      {title}
                    </Text>
                    <Text numberOfLines={1} style={styles.cardMeta}>
                      {subline}
                    </Text>
                    {counterpart ? (
                      <Text style={styles.cardMeta}>{formatBookingWhen(item.date, item.time)}</Text>
                    ) : null}
                    <Text numberOfLines={1} style={styles.cardMeta}>
                      {item.location}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.cardPrice}>{formatMoney(item.price)}</Text>
                    <Text style={styles.cardStatus}>{BOOKING_STATUS_LABELS[item.status]}</Text>
                  </View>
                </View>

                {item.status === 'pending' || item.status === 'accepted' ? (
                  <View style={styles.actions} testID={`barber-requests-actions-${item.id}`}>
                    {busy ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.accent}
                        style={styles.actionSpinner}
                        testID={`barber-requests-row-busy-${item.id}`}
                        accessible
                        accessibilityLabel="Updating booking"
                        accessibilityLiveRegion="polite"
                      />
                    ) : item.status === 'pending' ? (
                      <>
                        <ActionButton
                          styles={styles}
                          variant="secondary"
                          label="Reject"
                          testID={`request-reject-${item.id}`}
                          onPress={() =>
                            confirmDestructive('Reject this booking?', 'Reject', () =>
                              runTransition(item, 'rejected', rejectBooking)
                            )
                          }
                        />
                        <ActionButton
                          styles={styles}
                          variant="primary"
                          label="Accept"
                          testID={`request-accept-${item.id}`}
                          onPress={() => runTransition(item, 'accepted', acceptBooking)}
                        />
                      </>
                    ) : (
                      <>
                        <ActionButton
                          styles={styles}
                          variant="secondary"
                          label="Cancel"
                          testID={`request-cancel-${item.id}`}
                          onPress={() =>
                            confirmDestructive('Cancel this booking?', 'Cancel booking', () =>
                              runTransition(item, 'cancelled', cancelBookingAsBarber)
                            )
                          }
                        />
                        <ActionButton
                          styles={styles}
                          variant="success"
                          label="Mark complete"
                          testID={`request-complete-${item.id}`}
                          onPress={() => runTransition(item, 'completed', completeBooking)}
                        />
                      </>
                    )}
                  </View>
                ) : null}

                {rowError ? (
                  <View
                    style={styles.rowError}
                    accessibilityRole="alert"
                    testID={`barber-requests-row-error-${item.id}`}
                  >
                    <Text style={styles.rowErrorText}>{rowError}</Text>
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

type ActionVariant = 'primary' | 'secondary' | 'success';

function ActionButton({
  styles,
  variant,
  label,
  testID,
  onPress,
}: {
  styles: ReturnType<typeof useStyles>;
  variant: ActionVariant;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const shape =
    variant === 'primary'
      ? styles.actionPrimary
      : variant === 'success'
        ? styles.actionSuccess
        : styles.actionSecondary;
  const text =
    variant === 'primary'
      ? styles.actionPrimaryText
      : variant === 'success'
        ? styles.actionSuccessText
        : styles.actionSecondaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, shape, pressed ? styles.actionPressed : null]}
    >
      <Text style={text}>{label}</Text>
    </Pressable>
  );
}

function useStyles(colors: Palette) {
  const { fonts } = useTheme();
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 24, marginTop: 24 },
    heading: { fontSize: 24, color: colors.textPrimary, fontFamily: fonts.headingMedium },
    subtitle: { fontSize: 12, marginTop: 4, color: colors.textSecondary, fontFamily: fonts.body },

    spinner: { marginTop: 48 },
    notice: {
      borderWidth: 0.5,
      borderRadius: 8,
      padding: 12,
      marginTop: 24,
      marginHorizontal: 24,
      borderColor: colors.error,
      backgroundColor: colors.surface,
    },
    noticeText: { fontSize: 14, color: colors.errorText, fontFamily: fonts.bodyMedium },

    listContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body },
    emptyHint: { fontSize: 12, marginTop: 6, color: colors.textSecondary, fontFamily: fonts.body },

    card: {
      borderWidth: 0.5,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 4 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    avatarInitial: { fontSize: 16, color: colors.textSecondary, fontFamily: fonts.headingMedium },
    cardInfo: { flex: 1, minWidth: 0 },
    cardTitle: { fontSize: 18, color: colors.textPrimary, fontFamily: fonts.headingMedium },
    cardMeta: { fontSize: 12, marginTop: 4, color: colors.textSecondary, fontFamily: fonts.body },
    cardRight: { alignItems: 'flex-end' },
    cardPrice: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.body },
    cardStatus: {
      fontSize: 10,
      letterSpacing: 1.5,
      marginTop: 4,
      color: colors.accentText,
      fontFamily: fonts.bodyMedium,
    },

    actions: { flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'center' },
    actionSpinner: { paddingVertical: 10 },
    actionButton: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 14,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionPressed: { opacity: 0.7 },
    actionPrimary: { backgroundColor: colors.accent },
    actionPrimaryText: { fontSize: 14, color: colors.onAccent, fontFamily: fonts.bodySemiBold },
    actionSecondary: { borderWidth: 0.5, borderColor: colors.error },
    actionSecondaryText: { fontSize: 14, color: colors.errorText, fontFamily: fonts.bodyMedium },
    actionSuccess: { borderWidth: 0.5, borderColor: colors.success },
    actionSuccessText: { fontSize: 14, color: colors.successText, fontFamily: fonts.bodyMedium },

    rowError: {
      marginTop: 12,
      borderTopWidth: 0.5,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    rowErrorText: { fontSize: 12, color: colors.errorText, fontFamily: fonts.bodyMedium },
  });
}
