/**
 * Barber profile detail — visual rebuild of the prototype's
 * customer.barber.$id route: full-bleed hero (profile image under the status
 * bar, name + verified badge + meta overlaid on a flat scrim), bio with
 * service-name chips, and a Services / Portfolio / Reviews tab strip.
 *
 * Same step 9-10 data layer as before (getBarberProfile +
 * listServicesForBarber); rendering differences from the prototype are all
 * data-honesty ones:
 * - services have no description column → name + "N min · €X" only;
 * - the per-row Book button now navigates into the step 11-12 booking flow
 *   (BookingDateTime -> BookingLocation -> BookingConfirm), carrying
 *   barberId/barberName/the full service row forward so those screens never
 *   need to re-fetch what is already loaded here;
 * - Portfolio (step 17) and Reviews (step 18) tabs render honest empty
 *   states, not the prototype's mock grids/distribution bars;
 * - no distance/years-experience lines (no such data).
 *
 * Maestro contract preserved: barber-profile-screen / -back / -loading /
 * -error / -not-found / -rating / -services-error / -services-empty /
 * -service-{id} / -portfolio-placeholder. Services is the default tab, so
 * the flow's service assertions hold without extra taps.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PortfolioGrid } from '../../shared/components/PortfolioGrid';
import { PortfolioTile } from '../../shared/components/PortfolioTile';
import { useTheme } from '../../theme/useTheme';
import type { BarberDirectoryRow, PortfolioRow, ServiceRow } from '../../types';
import { getBarberProfile, listPortfolioForBarber, listServicesForBarber } from '../discoveryData';
import { formatMoney } from '../format';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BarberProfile'>;

type TabKey = 'services' | 'portfolio' | 'reviews';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'services', label: 'Services' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'reviews', label: 'Reviews' },
];

// Text overlaid on the hero image sits on a flat dark scrim, so its color is
// fixed regardless of theme (same approach as the Discover trending tiles).
const HERO_TEXT = '#F5F1E8';
const HERO_TEXT_DIM = 'rgba(245,241,232,0.72)';
const HERO_SCRIM = 'rgba(18,18,20,0.72)';

export default function BarberProfileScreen({ route, navigation }: Props) {
  const { barberId } = route.params;
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();

  const [barber, setBarber] = useState<BarberDirectoryRow | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('services');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setServicesError(null);
    setPortfolioError(null);

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

    // Services and portfolio are independent secondary reads — fetch in
    // parallel; a failure in either is a tab-local error, never a whole-screen
    // one (the profile already loaded).
    const [servicesResult, portfolioResult] = await Promise.all([
      listServicesForBarber(barberId),
      listPortfolioForBarber(barberId),
    ]);
    setLoading(false);
    if (servicesResult.status === 'ok') {
      setServices(servicesResult.services);
    } else {
      setServicesError(servicesResult.message);
    }
    if (portfolioResult.status === 'ok') {
      setPortfolio(portfolioResult.images);
    } else {
      setPortfolioError(portfolioResult.message);
    }
  }, [barberId]);

  useEffect(() => {
    let active = true;
    // Deferred via .then() (not called directly) for the same
    // react-hooks/set-state-in-effect reason as DiscoverScreen.
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const onBook = useCallback(
    (service: ServiceRow) => {
      if (!barber) return;
      navigation.navigate('BookingDateTime', { barberId: barber.id, barberName: barber.name, service });
    },
    [navigation, barber]
  );

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  // Loading / error / not-found render without the hero, with a plain header
  // that keeps the back affordance and its testID.
  if (loading || error || notFound) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
        testID="barber-profile-screen"
      >
        <View style={styles.plainHeader}>
          <BackButton onPress={goBack} background={colors.surface} color={colors.textPrimary} />
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
        ) : (
          <Text
            style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
            testID="barber-profile-not-found"
          >
            This barber is no longer available.
          </Text>
        )}
      </SafeAreaView>
    );
  }

  if (!barber) return null;

  const chips = services.slice(0, 4).map((s) => s.name);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['left', 'right']}
      testID="barber-profile-screen"
    >
      {/* The hero image bleeds under the status bar; light icons read best
          over photography. The no-image fallback keeps the global "auto". */}
      {barber.profile_image ? <StatusBar style="light" /> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Hero — image bleeds under the status bar like the prototype. */}
        <View style={[styles.hero, { backgroundColor: colors.surface }]}>
          {barber.profile_image ? (
            <Image source={{ uri: barber.profile_image }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={[styles.heroInitial, { color: colors.textSecondary, fontFamily: fonts.headingMedium }]}>
                {barber.name.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={[styles.heroTitleBlock, { backgroundColor: HERO_SCRIM }]}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={[styles.heroName, { fontFamily: fonts.headingMedium }]}>
                {barber.name}
              </Text>
              <MaterialCommunityIcons name="check-decagram" size={18} color={colors.accent} />
            </View>
            <View style={styles.heroMetaRow}>
              <Feather name="map-pin" size={11} color={HERO_TEXT_DIM} />
              <Text style={[styles.heroMeta, { fontFamily: fonts.body }]}>
                {[barber.city, barber.country].filter(Boolean).join(', ') || 'Location not set'}
              </Text>
              <Text style={[styles.heroMeta, { fontFamily: fonts.body }]}>·</Text>
              {barber.rating > 0 ? (
                <View
                  style={styles.heroRating}
                  testID="barber-profile-rating"
                  accessibilityLabel={`Rating ${barber.rating.toFixed(1)} out of 5`}
                >
                  <Ionicons name="star" size={11} color={colors.accent} />
                  <Text style={[styles.heroMeta, { fontFamily: fonts.body }]}>
                    {barber.rating.toFixed(1)}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.heroMeta, { fontFamily: fonts.body }]}
                  testID="barber-profile-rating"
                  accessibilityLabel="No ratings yet"
                >
                  No ratings yet
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Bio + specialty chips (chips are this barber's service names). */}
        <View style={styles.bioBlock}>
          <Text style={[styles.bio, { color: colors.textPrimary, fontFamily: fonts.body }]}>
            {barber.bio?.trim() || 'This barber has not added a bio yet.'}
          </Text>
          {chips.length > 0 ? (
            <View style={styles.chipsRow}>
              {chips.map((chip) => (
                <View key={chip} style={[styles.chip, { borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {chip}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Tab strip. */}
        <View style={[styles.tabStrip, { borderBottomColor: colors.border }]}>
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                testID={`barber-profile-tab-${key}`}
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

        <View style={styles.tabContent}>
          {tab === 'services' ? (
            servicesError ? (
              <Text
                style={[styles.stateText, { color: colors.errorText, fontFamily: fonts.body }]}
                accessibilityRole="alert"
                testID="barber-profile-services-error"
              >
                {servicesError}
              </Text>
            ) : services.length === 0 ? (
              <Text
                style={[styles.stateText, { color: colors.textSecondary, fontFamily: fonts.body }]}
                testID="barber-profile-services-empty"
              >
                This barber has not added any services yet.
              </Text>
            ) : (
              services.map((service, index) => (
                <View
                  key={service.id}
                  style={[styles.serviceRow, index > 0 ? { borderTopWidth: 0.5, borderTopColor: colors.border } : null]}
                  testID={`barber-profile-service-${service.id}`}
                >
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                      {service.name}
                    </Text>
                    <Text style={[styles.serviceMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                      {`${service.duration_minutes} min · ${formatMoney(service.price)}`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onBook(service)}
                    accessibilityRole="button"
                    accessibilityLabel={`Book ${service.name}`}
                    testID={`barber-profile-book-${service.id}`}
                    style={[styles.bookButton, { backgroundColor: colors.accent }]}
                  >
                    <Text style={[styles.bookButtonText, { color: colors.onAccent, fontFamily: fonts.bodyMedium }]}>
                      Book
                    </Text>
                  </Pressable>
                </View>
              ))
            )
          ) : tab === 'portfolio' ? (
            portfolioError ? (
              <Text
                style={[styles.stateText, { color: colors.errorText, fontFamily: fonts.body }]}
                accessibilityRole="alert"
                testID="barber-profile-portfolio-error"
              >
                {portfolioError}
              </Text>
            ) : portfolio.length === 0 ? (
              <View style={styles.portfolioEmpty} testID="barber-profile-portfolio-placeholder">
                {/* Muted, never brass — an empty portfolio is a calm state,
                    not a call to action on someone else's profile. */}
                <Feather name="image" size={22} color={colors.border} />
                <Text style={[styles.portfolioEmptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  No portfolio to show yet.
                </Text>
              </View>
            ) : (
              <PortfolioGrid style={styles.portfolioGridSpacing}>
                {portfolio.map((img) => (
                  <PortfolioTile
                    key={img.id}
                    imagePath={img.image_url}
                    testID={`barber-profile-portfolio-image-${img.id}`}
                  />
                ))}
              </PortfolioGrid>
            )
          ) : (
            <View>
              <Text style={[styles.reviewsRating, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                {barber.rating > 0 ? barber.rating.toFixed(1) : 'New'}
              </Text>
              <Text style={[styles.stateText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Reviews arrive after the first completed bookings.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Back button floats over the hero, clear of the status bar. */}
      <View style={[styles.backWrap, { top: insets.top + 8 }]}>
        <BackButton onPress={goBack} background={HERO_SCRIM} color={HERO_TEXT} />
      </View>
    </SafeAreaView>
  );
}

function BackButton({
  onPress,
  background,
  color,
}: {
  onPress: () => void;
  background: string;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      testID="barber-profile-back"
      style={[styles.backButton, { backgroundColor: background }]}
    >
      <Feather name="arrow-left" size={16} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  plainHeader: { paddingHorizontal: 24, paddingTop: 12 },
  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 24, marginHorizontal: 24 },
  noticeText: { fontSize: 14 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },

  hero: { height: 320 },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroInitial: { fontSize: 64 },
  heroTitleBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroName: { fontSize: 28, color: HERO_TEXT, flexShrink: 1 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  heroMeta: { fontSize: 12, color: HERO_TEXT_DIM },
  heroRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  backWrap: { position: 'absolute', left: 24 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bioBlock: { paddingHorizontal: 24, paddingVertical: 24 },
  bio: { fontSize: 14, lineHeight: 22 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { borderWidth: 0.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12 },

  tabStrip: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 0.5,
  },
  tabButton: {
    paddingBottom: 12,
    marginBottom: -0.5,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 12, letterSpacing: 1.5 },

  tabContent: { paddingHorizontal: 24, paddingVertical: 8 },
  stateText: { fontSize: 13, paddingVertical: 16 },

  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  serviceInfo: { flex: 1, minWidth: 0 },
  serviceName: { fontSize: 18 },
  serviceMeta: { fontSize: 12, marginTop: 6 },
  bookButton: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  bookButtonText: { fontSize: 12 },

  reviewsRating: { fontSize: 40, marginTop: 8 },

  portfolioGridSpacing: { paddingVertical: 16 },
  portfolioEmpty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  portfolioEmptyText: { fontSize: 13 },
});
