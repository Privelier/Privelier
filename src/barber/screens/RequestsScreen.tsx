/**
 * Barber Requests tab — rebuild of the prototype's barber.requests route:
 * serif header + subtitle and booking-request cards (serif title, slot
 * line, location, price + brass status label on the right).
 *
 * Real data end to end via fetchOwnRequestsView (RLS scopes bookings to
 * the signed-in barber). Until step 11-12 ships the customer booking flow
 * there are no bookings, so the empty state is the expected first render.
 *
 * Honesty deviations from the prototype:
 * - NO accept/decline/start/cancel action buttons yet — status transitions
 *   are build-order step 13-14 (with Realtime + our authoritative state
 *   machine; the prototype's confirmed/in_progress states do not exist in
 *   ours and are ignored).
 * - Cards lead with the SERVICE name, not the customer's name: users RLS
 *   is own-row-only, so a barber cannot read a customer's name today. The
 *   counterpart-identity read path is tracked for step 13-14 in CLAUDE.md.
 *
 * Reloads on every FOCUS, not just on first mount (build-order step 11-12
 * fix): bottom-tab screens stay mounted after their first visit, so a
 * mount-only effect would mean a booking a customer just created via the
 * new booking flow would not appear here until the app restarts.
 * useFocusEffect re-runs fetchOwnRequestsView every time this tab becomes
 * active again.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/useTheme';
import type { BookingRow, ServiceRow } from '../../types';
import { fetchOwnRequestsView } from '../requestsData';
import { BOOKING_STATUS_LABELS, formatBookingWhen, formatMoney } from '../../shared/format';

export default function RequestsScreen() {
  const { colors, fonts } = useTheme();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [servicesById, setServicesById] = useState<Map<string, ServiceRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOwnRequestsView();
    setLoading(false);
    if (result.status === 'ok') {
      setBookings(result.bookings);
      setServicesById(result.servicesById);
    } else {
      setError(result.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="barber-requests-screen"
    >
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Requests
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          Booking requests from your clients.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="barber-requests-loading"
        />
      ) : error ? (
        <View
          testID="barber-requests-error"
          accessibilityRole="alert"
          style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text
                style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
                testID="barber-requests-empty"
              >
                No booking requests yet.
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Requests appear here the moment a client books you.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const service = servicesById.get(item.service_id);
            return (
              <View
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                testID={`barber-requests-row-${item.id}`}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text
                      numberOfLines={1}
                      style={[styles.cardTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
                    >
                      {service?.name ?? 'Service'}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                      {formatBookingWhen(item.date, item.time)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}
                    >
                      {item.location}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={[styles.cardPrice, { color: colors.textPrimary, fontFamily: fonts.body }]}>
                      {formatMoney(item.price)}
                    </Text>
                    <Text style={[styles.cardStatus, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                      {BOOKING_STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                </View>
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
  header: { paddingHorizontal: 24, marginTop: 24 },
  heading: { fontSize: 24 },
  subtitle: { fontSize: 12, marginTop: 4 },

  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 24, marginHorizontal: 24 },
  noticeText: { fontSize: 14 },

  listContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13 },
  emptyHint: { fontSize: 12, marginTop: 6 },

  card: { borderWidth: 0.5, borderRadius: 8, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 18 },
  cardMeta: { fontSize: 12, marginTop: 4 },
  cardRight: { alignItems: 'flex-end' },
  cardPrice: { fontSize: 14 },
  cardStatus: { fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
});
