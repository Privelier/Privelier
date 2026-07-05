/**
 * Barber profile screen (build-order step 9-10) — read-only view of an
 * approved barber's public profile and services.
 *
 * `rating` on `barber_directory` is currently always the unmodified default
 * (no review-aggregation built yet, per architect-review): `rating > 0` is
 * the only case rendered as a real numeric rating; anything else falls back
 * to a calm "no ratings yet" text state.
 *
 * No booking action (build-order step 11-12) and no real portfolio data
 * (build-order step 17 has not built portfolio upload yet) — both are
 * explicit placeholders here, not oversights.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import type { BarberDirectoryRow, ServiceRow } from '../../types';
import { getBarberProfile, listServicesForBarber } from '../discoveryData';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BarberProfile'>;

export default function BarberProfileScreen({ route, navigation }: Props) {
  const { barberId } = route.params;
  const { colors, fonts } = useTheme();

  const [barber, setBarber] = useState<BarberDirectoryRow | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setServicesError(null);

    const profileResult = await getBarberProfile(barberId);
    if (profileResult.status === 'error') {
      setLoading(false);
      setError(profileResult.message);
      return;
    }
    if (profileResult.status === 'not_found') {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setBarber(profileResult.barber);

    const servicesResult = await listServicesForBarber(barberId);
    setLoading(false);
    if (servicesResult.status === 'ok') {
      setServices(servicesResult.services);
    } else {
      setServicesError(servicesResult.message);
    }
  }, [barberId]);

  useEffect(() => {
    let active = true;
    // Deferred via .then() (not called directly) for the same reason as
    // CustomerHomeScreen — see the comment there.
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="barber-profile-screen"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={16}
          testID="barber-profile-back"
        >
          <Text style={[styles.backText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
            {'‹ Back'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="barber-profile-loading"
        />
      ) : error ? (
        <View
          testID="barber-profile-error"
          accessibilityRole="alert"
          style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
            {error}
          </Text>
        </View>
      ) : notFound ? (
        <Text
          style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
          testID="barber-profile-not-found"
        >
          This barber is no longer available.
        </Text>
      ) : barber ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
            {barber.name}
          </Text>
          <Text style={[styles.location, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {[barber.city, barber.country].filter(Boolean).join(', ') || 'Location not set'}
          </Text>

          {barber.rating > 0 ? (
            <Text
              style={[styles.rating, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}
              accessibilityLabel={`Rating ${barber.rating.toFixed(1)} out of 5`}
              testID="barber-profile-rating"
            >
              {`★ ${barber.rating.toFixed(1)}`}
            </Text>
          ) : (
            <Text
              style={[styles.rating, { color: colors.textSecondary, fontFamily: fonts.body }]}
              accessibilityLabel="No ratings yet"
              testID="barber-profile-rating"
            >
              No ratings yet.
            </Text>
          )}

          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
            About
          </Text>
          <Text style={[styles.bio, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {barber.bio?.trim() || 'This barber has not added a bio yet.'}
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
            Portfolio
          </Text>
          <View style={[styles.placeholderCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text
              style={[styles.placeholderText, { color: colors.textSecondary, fontFamily: fonts.body }]}
              testID="barber-profile-portfolio-placeholder"
            >
              Portfolio coming soon.
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
            Services
          </Text>
          {servicesError ? (
            <Text
              style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}
              accessibilityRole="alert"
              testID="barber-profile-services-error"
            >
              {servicesError}
            </Text>
          ) : services.length === 0 ? (
            <Text
              style={[styles.emptyServicesText, { color: colors.textSecondary, fontFamily: fonts.body }]}
              testID="barber-profile-services-empty"
            >
              This barber has not added any services yet.
            </Text>
          ) : (
            services.map((service) => (
              <View
                key={service.id}
                style={[styles.serviceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                testID={`barber-profile-service-${service.id}`}
              >
                <Text style={[styles.serviceName, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
                  {service.name}
                </Text>
                <Text style={[styles.serviceMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {`${service.price} · ${service.duration_minutes} min`}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 12 },
  backText: { fontSize: 15 },
  spinner: { marginTop: 32 },
  notice: { borderWidth: 0.5, borderRadius: 10, padding: 12, marginTop: 16, marginHorizontal: 24 },
  noticeText: { fontSize: 14 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 32, paddingHorizontal: 24 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  name: { fontSize: 24, marginTop: 8 },
  location: { fontSize: 14, marginTop: 4 },
  rating: { fontSize: 14, marginTop: 8 },
  sectionTitle: { fontSize: 16, marginTop: 24, marginBottom: 8 },
  bio: { fontSize: 14, lineHeight: 20 },
  placeholderCard: { borderWidth: 0.5, borderRadius: 10, padding: 16, alignItems: 'center' },
  placeholderText: { fontSize: 14 },
  errorText: { fontSize: 14 },
  emptyServicesText: { fontSize: 14 },
  serviceRow: { borderWidth: 0.5, borderRadius: 10, padding: 14, marginBottom: 8 },
  serviceName: { fontSize: 15, marginBottom: 2 },
  serviceMeta: { fontSize: 13 },
});
