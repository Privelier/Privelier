/**
 * Barber Studio tab (dashboard) — rebuild of the prototype's
 * barber.dashboard route header (time-of-day greeting, serif first name,
 * sign out top-right) on top of real data.
 *
 * Founder decision (2026-07-08): unlike the prototype, Services and
 * Availability are NOT managed inline here — they stay separate, fully
 * tested stack screens. Studio links to them through two summary cards
 * carrying real counts ("3 services · from €30" / "2 windows"), keeping the
 * barber-dashboard-services / barber-dashboard-availability testIDs the
 * step 7-8 Maestro flows navigate by.
 *
 * The verification line under the greeting is real
 * (barber_profile.verification_status, read-only — the column is
 * admin-owned). The prototype's "N reviews" line is absent: reviews don't
 * exist until build-order step 18.
 *
 * barber-dashboard-logout keeps its testID (login E2E flow asserts on it).
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchOwnProfile } from '../../auth/authService';
import { useExitRole } from '../../RoleContext';
import { useTheme } from '../../theme/useTheme';
import type { AvailabilityRow, ServiceRow, VerificationStatus } from '../../types';
import { listOwnServices } from '../servicesData';
import { listOwnAvailability } from '../availabilityData';
import { fetchOwnBarberProfile } from '../profileData';
import { firstName, formatMoney, timeOfDayGreeting } from '../../shared/format';
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

function servicesSummary(services: ServiceRow[]): string {
  if (services.length === 0) return 'No services yet.';
  const count = services.length === 1 ? '1 service' : `${services.length} services`;
  const from = formatMoney(Math.min(...services.map((s) => s.price)));
  return `${count} · from ${from}`;
}

function availabilitySummary(windows: AvailabilityRow[]): string {
  if (windows.length === 0) return 'No windows set.';
  return windows.length === 1 ? '1 window' : `${windows.length} windows`;
}

export default function StudioScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const onSignOut = useExitRole();

  const [name, setName] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [windows, setWindows] = useState<AvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error' || !profileResult.profile) {
      setLoading(false);
      setError(
        profileResult.status === 'error'
          ? profileResult.message
          : 'Could not load your profile.'
      );
      return;
    }
    setName(profileResult.profile.name);
    const barberId = profileResult.profile.id;

    // Summaries and the verification line are independent reads — each
    // degrades on its own; a failure never blanks the whole dashboard.
    const [barberProfileResult, servicesResult, availabilityResult] = await Promise.all([
      fetchOwnBarberProfile(barberId),
      listOwnServices(barberId),
      listOwnAvailability(barberId),
    ]);
    setVerification(
      barberProfileResult.status === 'ok'
        ? (barberProfileResult.profile?.verification_status ?? null)
        : null
    );
    setServices(servicesResult.status === 'ok' ? servicesResult.services : []);
    setWindows(availabilityResult.status === 'ok' ? availabilityResult.windows : []);
    setLoading(false);
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

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="barber-dashboard-loading"
          />
        ) : error ? (
          <View
            testID="barber-dashboard-error"
            accessibilityRole="alert"
            style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
              {error}
            </Text>
          </View>
        ) : (
          <>
            {verification ? (
              <Text
                style={[styles.verification, { color: verificationColor, fontFamily: fonts.body }]}
                testID="barber-dashboard-verification"
              >
                {VERIFICATION_LINES[verification]}
              </Text>
            ) : null}

            <View style={styles.cards}>
              <Pressable
                onPress={() => navigation.navigate('Services')}
                accessibilityRole="button"
                accessibilityLabel="Manage services"
                testID="barber-dashboard-services"
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                    Services
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {servicesSummary(services)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate('Availability')}
                accessibilityRole="button"
                accessibilityLabel="Manage availability"
                testID="barber-dashboard-availability"
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                    Availability
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {availabilitySummary(windows)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          </>
        )}
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
  cards: { marginTop: 40, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 16,
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 18 },
  cardMeta: { fontSize: 12, marginTop: 4 },
});
