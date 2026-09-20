import { useCallback, useState } from 'react';
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
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { RetryNotice } from '../../shared/components/RetryNotice';
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
  approved: 'Verification approved. Your profile can appear in customer search.',
  pending: 'Verification is under manual review.',
  rejected: 'Verification needs your attention.',
};

function readinessLabel(item: ReadinessItem): string {
  if (item.state === 'unavailable') {
    switch (item.key) {
      case 'services': return 'Could not check services';
      case 'availability': return 'Could not check availability';
      case 'portfolio': return 'Could not check portfolio';
      case 'bio': return 'Could not check bio';
      case 'verification': return 'Could not check verification';
    }
  }
  switch (item.key) {
    case 'services':
      return item.state === 'complete' ? 'Services added' : 'Add a service';
    case 'availability':
      return item.state === 'complete' ? 'Availability set' : 'Set your availability';
    case 'portfolio':
      return item.state === 'complete' ? 'Portfolio photos added' : 'Add portfolio photos';
    case 'bio':
      return item.state === 'complete' ? 'Bio added' : 'Add a short bio';
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
  unavailable: 'help-circle',
};

function servicesSummary(services: ServiceRow[]): string {
  if (services.length === 0) return 'No services yet.';
  const count = services.length === 1 ? '1 service' : `${services.length} services`;
  return `${count} · from ${formatMoney(Math.min(...services.map((service) => service.price)))}`;
}

function availabilitySummary(windows: AvailabilityRow[]): string {
  if (windows.length === 0) return 'No windows set.';
  return windows.length === 1 ? '1 window' : `${windows.length} windows`;
}

function portfolioSummary(count: number): string {
  if (count === 0) return 'No photos yet.';
  return count === 1 ? '1 of 6 photos' : `${count} of 6 photos`;
}

function bioSummary(bio: string | null): string {
  return bio?.trim() || 'Add a short introduction';
}

function locationSummary(address: string | null): string {
  return address?.trim() || 'Add your address for the Explore map';
}

function SectionUnavailable({
  label,
  testID,
  onRetry,
  retrying,
}: {
  label: string;
  testID: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.unavailable} testID={testID}>
      <Text accessibilityRole="alert" style={[styles.unavailableText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {label} could not load.
      </Text>
      {retrying ? (
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Refreshing studio" />
      ) : (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={`Retry ${label.toLowerCase()}`}
          testID={`${testID}-retry`}
          style={({ pressed }) => [styles.retryAction, { opacity: pressed ? pressOpacity.soft : 1 }]}
        >
          <Text style={[styles.retryText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
            Try again
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ManagementRow({
  title,
  summary,
  icon,
  testID,
  onPress,
  unavailable,
  onRetry,
  retrying,
  last = false,
}: {
  title: string;
  summary: string;
  icon: keyof typeof Feather.glyphMap;
  testID: string;
  onPress: () => void;
  unavailable: boolean;
  onRetry: () => void;
  retrying: boolean;
  last?: boolean;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[styles.managementItem, { borderBottomColor: colors.border, borderBottomWidth: last ? 0 : HAIRLINE }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${summary}`}
        testID={testID}
        style={({ pressed }) => [styles.managementLink, { opacity: pressed ? pressOpacity.soft : 1 }]}
      >
        <Feather name={icon} size={18} color={colors.textSecondary} />
        <View style={styles.managementText}>
          <Text style={[styles.managementTitle, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
            {title}
          </Text>
          <Text numberOfLines={2} style={[styles.managementSummary, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {summary}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </Pressable>
      {unavailable ? (
        <SectionUnavailable label={title} testID={`${testID}-unavailable`} onRetry={onRetry} retrying={retrying} />
      ) : null}
    </View>
  );
}

export default function StudioScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const onSignOut = useExitRole();
  const [name, setName] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const profileResult = await fetchOwnProfile();
      if (profileResult.status === 'error' || !profileResult.profile) {
        setError(profileResult.status === 'error' ? profileResult.message : 'Could not load your profile.');
        setView(null);
        return;
      }
      const nextView = await fetchDashboardView(profileResult.profile.id);
      setName(profileResult.profile.name);
      setView(nextView);
      setError(null);
    } catch {
      setError('Could not load your studio. Try again.');
      setView(null);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const retryDashboard = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    void load();
  }, [load, retrying]);

  const openReadinessTarget = useCallback(
    (key: ReadinessItemKey) => {
      switch (key) {
        case 'services': navigation.navigate('Services'); return;
        case 'availability': navigation.navigate('Availability'); return;
        case 'portfolio': navigation.navigate('Portfolio'); return;
        case 'bio': navigation.navigate('BioEdit'); return;
        case 'verification': navigation.navigate('Verify'); return;
      }
    },
    [navigation]
  );

  const verification = view?.profile.status === 'ok' ? view.profile.data.verification : null;
  const verificationText = verification
    ? VERIFICATION_LINES[verification]
    : 'Verify your profile to appear in customer search.';

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
            testID="barber-dashboard-logout"
            style={({ pressed }) => [styles.signOut, { opacity: pressed ? pressOpacity.soft : 1 }]}
          >
            <Feather name="log-out" size={16} color={colors.textSecondary} />
            <Text style={[styles.signOutText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
              Sign out
            </Text>
          </Pressable>
        </View>

        {loading && !view ? (
          <View style={styles.loading} testID="barber-dashboard-loading">
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              Loading your studio
            </Text>
          </View>
        ) : error && !view ? (
          <RetryNotice testID="barber-dashboard-error" message={error} onRetry={retryDashboard} style={styles.noticeMargins} />
        ) : view ? (
          <>
            <View testID="barber-dashboard-verification" style={styles.verification}>
              {view.profile.status === 'ok' ? (
                <Pressable
                  onPress={() => navigation.navigate('Verify')}
                  accessibilityRole="button"
                  accessibilityLabel={`${verificationText} View verification.`}
                  style={({ pressed }) => [styles.verificationLink, { opacity: pressed ? pressOpacity.soft : 1 }]}
                >
                  <Feather
                    name={verification === 'approved' ? 'check-circle' : verification === 'rejected' ? 'alert-circle' : 'clock'}
                    size={16}
                    color={verification === 'rejected' ? colors.errorText : verification === 'approved' ? colors.accentText : colors.textSecondary}
                  />
                  <Text style={[styles.verificationText, {
                    color: verification === 'rejected' ? colors.errorText : colors.textSecondary,
                    fontFamily: fonts.body,
                  }]}>
                    {verificationText}
                  </Text>
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </Pressable>
              ) : (
                <SectionUnavailable label="Verification status" testID="barber-dashboard-verification-unavailable" onRetry={retryDashboard} retrying={retrying} />
              )}
            </View>

            <View style={[styles.overview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                onPress={() => navigation.navigate('Requests')}
                accessibilityRole="button"
                accessibilityLabel={view.overview.status === 'ok'
                  ? `Bookings. ${view.overview.data.pendingCount} pending requests. View requests.`
                  : 'Bookings unavailable. View requests.'}
                testID="barber-dashboard-overview"
                style={({ pressed }) => [styles.overviewHeader, { opacity: pressed ? pressOpacity.soft : 1 }]}
              >
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                  Bookings
                </Text>
                <Feather name="chevron-right" size={18} color={colors.textSecondary} />
              </Pressable>
              {view.overview.status === 'ok' ? (
                <>
                  <View style={styles.pendingRow}>
                    <Text style={[styles.pendingNumber, { color: colors.accentText, fontFamily: fonts.headingMedium }]}>
                      {view.overview.data.pendingCount}
                    </Text>
                    <View style={styles.pendingCopy}>
                      <Text style={[styles.pendingTitle, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
                        {view.overview.data.pendingCount === 1 ? 'Pending request' : 'Pending requests'}
                      </Text>
                      <Text style={[styles.pendingHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                        {view.overview.data.pendingCount > 0 ? 'Awaiting your response' : 'No requests waiting'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.nextAppointment, { borderTopColor: colors.border }]}>
                    <Text style={[styles.eyebrow, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
                      Next appointment
                    </Text>
                    {view.overview.data.nextAppointment ? (
                      <>
                        <Text style={[styles.appointmentName, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
                          {view.overview.data.nextAppointment.counterpartName ??
                            view.overview.data.nextAppointment.serviceName ??
                            'Appointment'}
                        </Text>
                        <Text style={[styles.appointmentWhen, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                          {formatBookingWhen(
                            view.overview.data.nextAppointment.booking.date,
                            view.overview.data.nextAppointment.booking.time
                          )}
                          {view.overview.data.nextAppointment.counterpartName &&
                          view.overview.data.nextAppointment.serviceName
                            ? ` · ${view.overview.data.nextAppointment.serviceName}`
                            : ''}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                        Nothing scheduled yet.
                      </Text>
                    )}
                    {view.overview.data.upcomingCount > 0 ? (
                      <Text style={[styles.upcomingText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                        {view.overview.data.upcomingCount} upcoming in the next 7 days
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <SectionUnavailable label="Bookings" testID="barber-dashboard-overview-unavailable" onRetry={retryDashboard} retrying={retrying} />
              )}
            </View>

            <View testID="barber-dashboard-readiness" style={[styles.readiness, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                Studio setup
              </Text>
              {view.readiness.isLive === true ? (
                <Text style={[styles.readinessStatus, { color: colors.successText, fontFamily: fonts.bodyMedium }]}>
                  Studio setup complete.
                </Text>
              ) : (
                <Text style={[styles.readinessStatus, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {view.readiness.isLive === null
                    ? `${view.readiness.completeCount} confirmed complete; ${view.readiness.unavailableCount} unavailable`
                    : `${view.readiness.completeCount} of ${view.readiness.total} complete`}
                </Text>
              )}
              {view.readiness.unavailableCount > 0 ? (
                <SectionUnavailable label="Some setup details" testID="barber-dashboard-readiness-unavailable" onRetry={retryDashboard} retrying={retrying} />
              ) : null}
              <View style={styles.meter} accessible={false} importantForAccessibility="no-hide-descendants">
                {view.readiness.items.map((item) => (
                  <View
                    key={item.key}
                    style={[styles.meterSegment, { backgroundColor: item.state === 'complete' ? colors.accent : colors.border }]}
                  />
                ))}
              </View>
              <View style={styles.readinessItems}>
                {view.readiness.items.map((item, index) => {
                  const done = item.state === 'complete';
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
                          borderBottomWidth: index === view.readiness.items.length - 1 ? 0 : HAIRLINE,
                          borderColor: colors.border,
                          opacity: pressed && !done ? pressOpacity.soft : 1,
                        },
                      ]}
                    >
                      <Feather
                        name={READINESS_ICONS[item.state]}
                        size={17}
                        color={item.state === 'attention' ? colors.errorText : colors.textSecondary}
                      />
                      <Text style={[styles.readinessLabel, {
                        color: done ? colors.textSecondary : colors.textPrimary,
                        fontFamily: done ? fonts.body : fonts.bodyMedium,
                      }]}>
                        {readinessLabel(item)}
                      </Text>
                      {done ? null : <Feather name="chevron-right" size={16} color={colors.textSecondary} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.management, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                Manage your studio
              </Text>
              <View style={styles.managementRows}>
                <ManagementRow
                  title="Services"
                  summary={view.services.status === 'ok' ? servicesSummary(view.services.data) : 'Service summary unavailable'}
                  icon="scissors"
                  testID="barber-dashboard-services"
                  onPress={() => navigation.navigate('Services')}
                  unavailable={view.services.status !== 'ok'}
                  onRetry={retryDashboard}
                  retrying={retrying}
                />
                <ManagementRow
                  title="Availability"
                  summary={view.availability.status === 'ok' ? availabilitySummary(view.availability.data) : 'Availability summary unavailable'}
                  icon="calendar"
                  testID="barber-dashboard-availability"
                  onPress={() => navigation.navigate('Availability')}
                  unavailable={view.availability.status !== 'ok'}
                  onRetry={retryDashboard}
                  retrying={retrying}
                />
                <ManagementRow
                  title="Portfolio"
                  summary={view.portfolio.status === 'ok' ? portfolioSummary(view.portfolio.data.length) : 'Portfolio summary unavailable'}
                  icon="image"
                  testID="barber-dashboard-portfolio"
                  onPress={() => navigation.navigate('Portfolio')}
                  unavailable={view.portfolio.status !== 'ok'}
                  onRetry={retryDashboard}
                  retrying={retrying}
                />
                <ManagementRow
                  title="Bio"
                  summary={view.profile.status === 'ok' ? bioSummary(view.profile.data.bio) : 'Bio summary unavailable'}
                  icon="edit-3"
                  testID="barber-dashboard-bio"
                  onPress={() => navigation.navigate('BioEdit')}
                  unavailable={view.profile.status !== 'ok'}
                  onRetry={retryDashboard}
                  retrying={retrying}
                />
                <ManagementRow
                  title="Location"
                  summary={view.location.status === 'ok' ? locationSummary(view.location.data) : 'Location summary unavailable'}
                  icon="map-pin"
                  testID="barber-dashboard-location"
                  onPress={() => navigation.navigate('LocationEdit')}
                  unavailable={view.location.status !== 'ok'}
                  onRetry={retryDashboard}
                  retrying={retrying}
                  last
                />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space['2xl'] },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  headerText: { flexGrow: 1, flexShrink: 1, minWidth: 160 },
  greeting: { fontSize: 13, lineHeight: 20 },
  name: { fontSize: 30, lineHeight: 38, marginTop: space.xs },
  signOut: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  signOutText: { fontSize: 13 },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: space.md },
  loadingText: { fontSize: 13 },
  noticeMargins: { marginTop: space.xl },
  verification: { marginTop: space.sm },
  verificationLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  verificationText: { flex: 1, fontSize: 13, lineHeight: 19 },
  overview: { marginTop: space.lg, borderWidth: HAIRLINE, borderRadius: radius.sm, paddingHorizontal: space.base, paddingVertical: space.md },
  overviewHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 19, lineHeight: 26 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  pendingNumber: { minWidth: 34, fontSize: 34, lineHeight: 42 },
  pendingCopy: { flex: 1 },
  pendingTitle: { fontSize: 15, lineHeight: 22 },
  pendingHint: { fontSize: 13, lineHeight: 19 },
  nextAppointment: { borderTopWidth: HAIRLINE, paddingTop: space.md, paddingBottom: space.xs },
  eyebrow: { fontSize: 12, lineHeight: 18 },
  appointmentName: { fontSize: 16, lineHeight: 24, marginTop: space.xs },
  appointmentWhen: { fontSize: 13, lineHeight: 20, marginTop: space.xs },
  emptyText: { fontSize: 13, lineHeight: 20, marginTop: space.xs },
  upcomingText: { fontSize: 12, lineHeight: 18, marginTop: space.sm },
  readiness: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: HAIRLINE },
  readinessStatus: { fontSize: 13, lineHeight: 20, marginTop: space.xs },
  meter: { flexDirection: 'row', gap: space.xs, marginTop: space.base },
  meterSegment: { flex: 1, height: 3, borderRadius: 1.5 },
  readinessItems: { marginTop: space.sm },
  readinessRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  readinessLabel: { flex: 1, fontSize: 14, lineHeight: 21 },
  management: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: HAIRLINE },
  managementRows: { marginTop: space.sm },
  managementItem: { borderBottomWidth: HAIRLINE },
  managementLink: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  managementText: { flex: 1, minWidth: 0 },
  managementTitle: { fontSize: 15, lineHeight: 22 },
  managementSummary: { fontSize: 13, lineHeight: 19, marginTop: space.xs },
  unavailable: { paddingVertical: space.sm },
  unavailableText: { fontSize: 13, lineHeight: 20 },
  retryAction: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  retryText: { fontSize: 13 },
});
