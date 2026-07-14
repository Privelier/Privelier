/**
 * Barber Studio tab (dashboard). Time-of-day greeting + serif first name +
 * sign out, then two READ-ONLY glances on top of real data:
 *
 *  1. Bookings overview — pending-request count, the next confirmed
 *     appointment, and a next-7-days count, all sourced from the same
 *     fetchOwnRequestsView() the Requests tab uses. It NEVER mutates a booking
 *     (accept/reject/complete live only on the Requests tab); tapping it
 *     deep-links there.
 *  2. Profile readiness — a four-item "readiness to go live" meter
 *     (service / availability / portfolio / verification; bio is
 *     founder-descoped). A verification still under manual review renders as a
 *     calm in-progress state, never the barber's fault (founder decision
 *     2026-07-13). Each incomplete item deep-links to the screen that fixes it.
 *
 * Founder decision (2026-07-08): Services and Availability are managed on
 * their own stack screens, not inline — the two summary cards here link to
 * them. All data is composed by fetchDashboardView (src/barber/dashboardData.ts),
 * which degrades per-field so one failed read never blanks the dashboard.
 *
 * The dashboard refreshes on focus (matching the rest of the app); the spinner
 * shows only on the first load, later focus refreshes update silently.
 *
 * Preserved testIDs (Maestro / login E2E depend on them): barber-dashboard-
 * screen, -logout, -loading, -error, -verification, -services, -availability.
 */
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchOwnProfile } from '../../auth/authService';
import { useExitRole } from '../../RoleContext';
import { useTheme } from '../../theme/useTheme';
import type { AvailabilityRow, ServiceRow, VerificationStatus } from '../../types';
import { fetchDashboardView } from '../dashboardData';
import { firstName, formatBookingWhen, formatMoney, timeOfDayGreeting } from '../../shared/format';
import type { DashboardView, ReadinessItem, ReadinessItemKey, ReadinessState } from '../types';
import type { BarberTabParamList } from '../BarberTabs';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BarberTabParamList, 'Studio'>,
  NativeStackScreenProps<BarberStackParamList>
>;

const VERIFICATION_LINES: Record<VerificationStatus, string> = {
  approved: 'Verified — you appear in customer search.',
  pending: 'Verification pending — our team reviews manually.',
  rejected: 'Verification declined — see the Verify tab.',
};

/** Per-item copy. Verification copy varies by state; the others toggle on
 * done/not-done. Sentence case, never all-caps (brand). */
function readinessLabel(item: ReadinessItem): string {
  switch (item.key) {
    case 'services':
      return item.state === 'complete' ? 'Services added' : 'Add a service';
    case 'availability':
      return item.state === 'complete' ? 'Availability set' : 'Set your availability';
    case 'portfolio':
      return item.state === 'complete' ? 'Portfolio photos added' : 'Add portfolio photos';
    case 'verification':
      return item.state === 'complete'
        ? 'Verified'
        : item.state === 'attention'
          ? 'Verification needs attention'
          : 'Verification in review';
  }
}

const READINESS_ICONS: Record<ReadinessState, keyof typeof Feather.glyphMap> = {
  complete: 'check-circle',
  incomplete: 'circle',
  in_progress: 'clock',
  attention: 'alert-circle',
};

function servicesSummary(services: ServiceRow[]): string {
  if (services.length === 0) return 'No services yet.';
  const count = services.length === 1 ? '1 service' : `${services.length} services`;
  return `${count} · from ${formatMoney(Math.min(...services.map((s) => s.price)))}`;
}

function availabilitySummary(windows: AvailabilityRow[]): string {
  if (windows.length === 0) return 'No windows set.';
  return windows.length === 1 ? '1 window' : `${windows.length} windows`;
}

export default function StudioScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const onSignOut = useExitRole();

  const [name, setName] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error' || !profileResult.profile) {
      // Only surface an error screen if nothing has ever loaded — a failed
      // focus refresh keeps the last good dashboard on screen.
      if (!loadedRef.current) {
        setError(
          profileResult.status === 'error' ? profileResult.message : 'Could not load your profile.'
        );
      }
      setLoading(false);
      return;
    }
    setName(profileResult.profile.name);
    const nextView = await fetchDashboardView(profileResult.profile.id);
    setView(nextView);
    setError(null);
    loadedRef.current = true;
    setLoading(false);
  }, []);

  // Refresh on every focus. useFocusEffect (unlike a bare useEffect) is not
  // flagged by react-hooks/set-state-in-effect, so load() is called directly —
  // no microtask deferral, which also keeps test act() scopes from overlapping.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  /** Deep-link an incomplete readiness item to the screen that resolves it. */
  const openReadinessTarget = useCallback(
    (key: ReadinessItemKey) => {
      switch (key) {
        case 'services':
          navigation.navigate('Services');
          return;
        case 'availability':
          navigation.navigate('Availability');
          return;
        case 'portfolio':
          navigation.navigate('Portfolio');
          return;
        case 'verification':
          navigation.navigate('Verify');
          return;
      }
    },
    [navigation]
  );

  const verification = view?.verification ?? null;
  const verificationColor =
    verification === 'approved'
      ? colors.successText
      : verification === 'rejected'
        ? colors.errorText
        : colors.textSecondary;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="barber-dashboard-screen"
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              {timeOfDayGreeting()},
            </Text>
            <Text style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
              {firstName(name)}.
            </Text>
          </View>
          <Pressable
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            hitSlop={12}
            testID="barber-dashboard-logout"
            style={styles.signOut}
          >
            <Feather name="log-out" size={12} color={colors.textSecondary} />
            <Text style={[styles.signOutText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              Sign out
            </Text>
          </Pressable>
        </View>

        {loading && !view ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="barber-dashboard-loading"
          />
        ) : error && !view ? (
          <View
            testID="barber-dashboard-error"
            accessibilityRole="alert"
            style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
              {error}
            </Text>
          </View>
        ) : view ? (
          <>
            {verification ? (
              <Text
                style={[styles.verification, { color: verificationColor, fontFamily: fonts.body }]}
                testID="barber-dashboard-verification"
              >
                {VERIFICATION_LINES[verification]}
              </Text>
            ) : null}

            {/* Bookings overview — read-only glance; taps go to Requests. */}
            <Pressable
              onPress={() => navigation.navigate('Requests')}
              accessibilityRole="button"
              accessibilityLabel={
                view.overview.pendingCount > 0
                  ? `${view.overview.pendingCount} pending requests. View booking requests.`
                  : 'View booking requests'
              }
              testID="barber-dashboard-overview"
              style={({ pressed }) => [
                styles.card,
                styles.overview,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.overviewHeader}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                  Bookings
                </Text>
                {/* Pill and chevron coexist — the nav affordance must not vanish
                    exactly when the card is most worth tapping. */}
                <View style={styles.overviewHeaderRight}>
                  {view.overview.pendingCount > 0 ? (
                    <View style={[styles.pendingPill, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.pendingPillText, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
                        {view.overview.pendingCount} pending
                      </Text>
                    </View>
                  ) : null}
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </View>
              </View>
              {view.overview.nextAppointment ? (
                <>
                  <Text style={[styles.overviewCaption, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    Next appointment
                  </Text>
                  <View style={styles.overviewNextRow}>
                    <Text
                      numberOfLines={1}
                      style={[styles.overviewWho, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}
                    >
                      {view.overview.nextAppointment.counterpartName ??
                        view.overview.nextAppointment.serviceName ??
                        'Appointment'}
                    </Text>
                    <Text style={[styles.overviewWhen, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                      {' · '}
                      {formatBookingWhen(
                        view.overview.nextAppointment.booking.date,
                        view.overview.nextAppointment.booking.time
                      )}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.overviewEmpty, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  Nothing scheduled yet.
                </Text>
              )}
              {view.overview.upcomingCount > 0 ? (
                <Text style={[styles.overviewMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {view.overview.upcomingCount} upcoming in the next 7 days
                </Text>
              ) : null}
            </Pressable>

            {/* Profile readiness meter. */}
            <View
              testID="barber-dashboard-readiness"
              style={[styles.card, styles.readiness, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                Readiness to go live
              </Text>
              {view.readiness.isLive ? (
                // The screen's single green moment — the quiet, earned ending.
                <View style={styles.liveRow}>
                  <Feather name="check-circle" size={14} color={colors.successText} />
                  <Text style={[styles.liveText, { color: colors.successText, fontFamily: fonts.bodyMedium }]}>
                    {"You're live — customers can find you."}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.readinessStatus, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {view.readiness.completeCount} of {view.readiness.total} complete
                </Text>
              )}
              {/* Four discrete segments mirror the four rows one-to-one — a
                  countable fact, not a percentage (readiness, never a score).
                  Hidden from the a11y tree: the status line above already
                  carries the count, so color is never the sole signal. */}
              <View style={styles.meter} accessible={false} importantForAccessibility="no-hide-descendants">
                {view.readiness.items.map((item) => (
                  <View
                    key={item.key}
                    style={[
                      styles.meterSegment,
                      { backgroundColor: item.state === 'complete' ? colors.accent : colors.border },
                    ]}
                  />
                ))}
              </View>

              <View style={styles.readinessItems}>
                {view.readiness.items.map((item, index) => {
                  const done = item.state === 'complete';
                  const last = index === view.readiness.items.length - 1;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={done ? undefined : () => openReadinessTarget(item.key)}
                      disabled={done}
                      accessibilityRole={done ? 'text' : 'button'}
                      accessibilityState={{ disabled: done }}
                      accessibilityLabel={readinessLabel(item)}
                      testID={`barber-dashboard-readiness-${item.key}`}
                      style={({ pressed }) => [
                        styles.readinessRow,
                        {
                          borderBottomWidth: last ? 0 : 0.5,
                          borderColor: colors.border,
                          opacity: pressed && !done ? 0.85 : 1,
                        },
                      ]}
                    >
                      {/* Done rows recede entirely (muted icon + label) — the
                          checklist's job is to surface what REMAINS. Error
                          color is reserved for the one attention state. */}
                      <Feather
                        name={READINESS_ICONS[item.state]}
                        size={15}
                        color={item.state === 'attention' ? colors.errorText : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.readinessLabel,
                          done
                            ? { color: colors.textSecondary, fontFamily: fonts.body }
                            : { color: colors.textPrimary, fontFamily: fonts.bodyMedium },
                        ]}
                      >
                        {readinessLabel(item)}
                      </Text>
                      {done ? null : <Feather name="chevron-right" size={15} color={colors.textSecondary} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Management cards (separate stack screens — founder 2026-07-08). */}
            <View style={styles.cards}>
              <Pressable
                onPress={() => navigation.navigate('Services')}
                accessibilityRole="button"
                accessibilityLabel="Manage services"
                testID="barber-dashboard-services"
                style={({ pressed }) => [
                  styles.card,
                  styles.linkCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                    Services
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {servicesSummary(view.services)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate('Availability')}
                accessibilityRole="button"
                accessibilityLabel="Manage availability"
                testID="barber-dashboard-availability"
                style={({ pressed }) => [
                  styles.card,
                  styles.linkCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                    Availability
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {availabilitySummary(view.windows)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerText: { flexShrink: 1 },
  greeting: { fontSize: 13 },
  name: { fontSize: 30, marginTop: 4 },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  signOutText: { fontSize: 12 },

  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 24 },
  noticeText: { fontSize: 14 },

  verification: { fontSize: 12, marginTop: 12 },

  card: { borderWidth: 0.5, borderRadius: 8, padding: 16 },
  cardTitle: { fontSize: 18 },
  cardMeta: { fontSize: 12, marginTop: 4 },

  overview: { marginTop: 24 },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overviewHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overviewCaption: { fontSize: 12, marginTop: 14 },
  overviewNextRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 3 },
  overviewWho: { fontSize: 14, flexShrink: 1 },
  overviewWhen: { fontSize: 14, flexShrink: 0 },
  overviewEmpty: { fontSize: 13, marginTop: 12 },
  overviewMeta: { fontSize: 12, marginTop: 10 },
  pendingPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pendingPillText: { fontSize: 11 },

  readiness: { marginTop: 12 },
  readinessStatus: { fontSize: 12, marginTop: 6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  liveText: { fontSize: 13 },
  meter: { flexDirection: 'row', gap: 4, marginTop: 12 },
  meterSegment: { flex: 1, height: 3, borderRadius: 1.5 },
  readinessItems: { marginTop: 8 },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  readinessLabel: { flex: 1, fontSize: 14 },

  cards: { marginTop: 12, gap: 12 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardText: { flex: 1, minWidth: 0 },
});
