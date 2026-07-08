/**
 * Customer Bookings tab — rebuild of the prototype's customer.bookings
 * route: serif header, Upcoming/Past tab strip, and booking cards (barber
 * image + name + status label, service, "Wed 8 Jul · 14:30", price,
 * location line).
 *
 * Real data end to end via fetchOwnBookingsView (RLS scopes the read to the
 * signed-in customer's own rows). Until build-order step 11-12 ships the
 * booking flow there is simply no data, so the empty state ("No upcoming
 * appointments yet.") is the expected first render — no mock bookings.
 * Cards are intentionally not tappable yet: the booking detail screen
 * belongs to step 11-12.
 *
 * Upcoming = still alive in the state machine (pending/accepted) AND the
 * slot is in the future; everything else is Past (see isUpcomingBooking).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../../types';
import { fetchOwnBookingsView, isUpcomingBooking } from '../bookingsData';
import { BOOKING_STATUS_LABELS, formatBookingWhen, formatMoney } from '../format';

type TabKey = 'upcoming' | 'past';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

export default function BookingsScreen() {
  const { colors, fonts } = useTheme();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [barbersById, setBarbersById] = useState<Map<string, BarberDirectoryRow>>(new Map());
  const [servicesById, setServicesById] = useState<Map<string, ServiceRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOwnBookingsView();
    setLoading(false);
    if (result.status === 'ok') {
      setBookings(result.bookings);
      setBarbersById(result.barbersById);
      setServicesById(result.servicesById);
    } else {
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Deferred via .then() (not called directly) for the same
    // react-hooks/set-state-in-effect reason as the other data screens.
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const list = useMemo(() => {
    const now = new Date();
    const upcoming = tab === 'upcoming';
    const filtered = bookings.filter((b) => isUpcomingBooking(b, now) === upcoming);
    // Past shows newest first (fetch order); Upcoming reads soonest-first.
    return upcoming ? [...filtered].reverse() : filtered;
  }, [bookings, tab]);

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

      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="customer-bookings-loading"
        />
      ) : error ? (
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
});
