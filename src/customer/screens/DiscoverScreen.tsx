/**
 * Customer discovery using authenticated, approved-directory data only.
 * Service data is optional enrichment: if its read fails, the directory and
 * barber-name search remain available while service filters and prices hide.
 *
 * Existing Maestro IDs are preserved:
 * customer-home-screen / -loading / -error / -retry / -empty /
 * -search / -barber-{id}.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchOwnProfile } from '../../auth/authService';
import { useTheme } from '../../theme/useTheme';
import { pressOpacity } from '../../theme/motion';
import { Notice } from '../../shared/components/Notice';
import { Skeleton } from '../../shared/components/Skeleton';
import type { BarberDirectoryRow, ServiceRow } from '../../types';
import { listBarbersByCity, listServicesForBarberIds } from '../discoveryData';
import {
  buildDiscoverPresentation,
  deriveServiceFilters,
  groupServicesByBarber,
} from '../discoverPresentation';
import { firstName, timeOfDayGreeting } from '../format';
import BarberCard from '../components/BarberCard';
import type { CustomerTabParamList } from '../CustomerTabs';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Discover'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export default function DiscoverScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const [ownName, setOwnName] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [serviceArea, setServiceArea] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberDirectoryRow[]>([]);
  const [services, setServices] = useState<ServiceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingCity, setMissingCity] = useState(false);
  const [query, setQuery] = useState('');
  const [activeService, setActiveService] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissingCity(false);
    setCityName(null);
    setServiceArea(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error') {
      setLoading(false);
      setError(profileResult.message);
      return;
    }
    setOwnName(profileResult.profile?.name ?? null);

    const city = profileResult.profile?.city?.trim();
    if (!city) {
      setLoading(false);
      setMissingCity(true);
      setError('Add your city to discover verified barbers near you.');
      return;
    }
    const country = profileResult.profile?.country?.trim();
    setCityName(city);
    setServiceArea(country ? `${city}, ${country}` : city);

    const barbersResult = await listBarbersByCity(city);
    if (barbersResult.status !== 'ok') {
      setLoading(false);
      setError(barbersResult.message);
      return;
    }
    setBarbers(barbersResult.barbers);

    const servicesResult = await listServicesForBarberIds(
      barbersResult.barbers.map((barber) => barber.id)
    );
    if (servicesResult.status === 'ok') {
      setServices(servicesResult.services);
      setActiveService((current) => {
        if (!current) return null;
        const stillAvailable = servicesResult.services.some(
          (service) => service.name.trim().toLowerCase() === current.toLowerCase()
        );
        return stillAvailable ? current : null;
      });
    } else {
      setServices(null);
      setActiveService(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const servicesByBarber = useMemo(
    () => groupServicesByBarber(services ?? []),
    [services]
  );
  const serviceFilters = useMemo(() => deriveServiceFilters(services), [services]);
  const presentation = useMemo(
    () =>
      buildDiscoverPresentation({
        barbers,
        servicesByBarber,
        servicesAvailable: services !== null,
        query,
        activeService,
      }),
    [barbers, servicesByBarber, services, query, activeService]
  );

  const openProfile = useCallback(
    (barberId: string) => navigation.navigate('BarberProfile', { barberId }),
    [navigation]
  );

  const spotlight = presentation.spotlight;
  const hasResults = Boolean(spotlight) || presentation.directory.length > 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-home-screen"
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pad}>
          <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {timeOfDayGreeting()},
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
          >
            {firstName(ownName)}.
          </Text>
          <View style={styles.serviceAreaRow}>
            <Feather name="map-pin" size={13} color={colors.accentText} />
            <Text
              style={[
                styles.serviceArea,
                { color: colors.textSecondary, fontFamily: fonts.body },
              ]}
            >
              {serviceArea ?? 'Your city'}
            </Text>
          </View>
        </View>

        <View style={[styles.pad, styles.searchWrap]}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a barber or service"
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.textPrimary, fontFamily: fonts.body }]}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search barbers or services"
              testID="customer-home-search"
            />
          </View>
        </View>

        {serviceFilters.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersRow}
            accessibilityLabel="Filter by service"
          >
            {serviceFilters.map((service) => {
              const selected = activeService?.toLowerCase() === service.toLowerCase();
              return (
                <Pressable
                  key={service}
                  onPress={() => setActiveService(selected ? null : service)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${service}`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.filter,
                    selected
                      ? { backgroundColor: colors.accent, borderColor: colors.accent }
                      : { borderColor: colors.border },
                    pressed ? { opacity: pressOpacity.soft } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { fontFamily: fonts.body },
                      selected
                        ? { color: colors.onAccent }
                        : { color: colors.textSecondary },
                    ]}
                  >
                    {service}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loading ? (
          <DiscoverSkeleton />
        ) : error ? (
          <Notice testID="customer-home-error" message={error} style={styles.noticeMargins}>
            <Pressable
              onPress={() => {
                if (missingCity) navigation.navigate('EditProfile');
                else void load();
              }}
              accessibilityRole="button"
              accessibilityLabel={missingCity ? 'Add city to profile' : 'Retry discovery'}
              testID={missingCity ? 'customer-home-add-city' : 'customer-home-retry'}
              style={styles.noticeAction}
            >
              <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>
                {missingCity ? 'Add city' : 'Try again'}
              </Text>
            </Pressable>
          </Notice>
        ) : !hasResults ? (
          <Text
            style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
            testID="customer-home-empty"
          >
            {barbers.length === 0
              ? `No verified barbers are available in ${cityName ?? 'your city'} yet.`
              : 'No verified barbers match your search.'}
          </Text>
        ) : (
          <>
            {spotlight ? (
              <View style={[styles.pad, styles.section]} testID="customer-home-spotlight">
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.sectionTitle,
                    { color: colors.textPrimary, fontFamily: fonts.headingMedium },
                  ]}
                >
                  Barber spotlight
                </Text>
                <View style={styles.spotlightCard}>
                  <BarberCard
                    barber={spotlight}
                    services={servicesByBarber.get(spotlight.id) ?? []}
                    variant="wide"
                    onPress={() => openProfile(spotlight.id)}
                  />
                </View>
              </View>
            ) : null}

            {presentation.directory.length > 0 ? (
              <View style={styles.section} testID="customer-home-directory">
                <View style={[styles.pad, styles.sectionHeader]}>
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.sectionTitle,
                      { color: colors.textPrimary, fontFamily: fonts.headingMedium },
                    ]}
                  >
                    {`Verified barbers in ${cityName ?? 'your city'}`}
                  </Text>
                  <Text
                    style={[
                      styles.sectionMeta,
                      { color: colors.textSecondary, fontFamily: fonts.body },
                    ]}
                  >
                    {`${presentation.directory.length} ${
                      presentation.directory.length === 1 ? 'barber' : 'barbers'
                    }`}
                  </Text>
                </View>
                <FlatList
                  horizontal
                  style={styles.directory}
                  data={presentation.directory}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.directoryContent}
                  accessibilityLabel={`Verified barbers in ${cityName ?? 'your city'}`}
                  renderItem={({ item }) => (
                    <BarberCard
                      barber={item}
                      services={servicesByBarber.get(item.id) ?? []}
                      variant="compact"
                      onPress={() => openProfile(item.id)}
                    />
                  )}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DiscoverSkeleton() {
  return (
    <View testID="customer-home-loading">
      <View style={[styles.pad, styles.section]}>
        <Skeleton style={styles.skeletonLineTitle} />
        <Skeleton style={styles.skeletonImageWide} />
        <View style={styles.skeletonTextGroup}>
          <Skeleton style={styles.skeletonLineWide} />
          <Skeleton style={styles.skeletonLineNarrow} />
        </View>
      </View>
      <View style={styles.section}>
        <View style={styles.pad}>
          <Skeleton style={styles.skeletonDirectoryTitle} />
        </View>
        <View style={[styles.pad, styles.skeletonDirectoryRow]}>
          <View style={styles.skeletonDirectoryItem}>
            <Skeleton style={styles.skeletonImageCompact} />
            <Skeleton style={styles.skeletonLineCompact} />
          </View>
          <View style={styles.skeletonDirectoryItem}>
            <Skeleton style={styles.skeletonImageCompact} />
            <Skeleton style={styles.skeletonLineCompact} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: 24, paddingBottom: 40 },
  pad: { paddingHorizontal: 24 },
  greeting: { fontSize: 13 },
  name: { fontSize: 30, marginTop: 4 },
  serviceAreaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  serviceArea: { fontSize: 13, lineHeight: 18 },
  searchWrap: { marginTop: 24 },
  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 10 },
  filtersScroll: { marginTop: 16, flexGrow: 0 },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 2 },
  filter: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  filterText: { fontSize: 12 },
  noticeMargins: { marginTop: 32, marginHorizontal: 24 },
  noticeAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
  },
  section: { marginTop: 34 },
  sectionHeader: { gap: 8 },
  sectionTitle: { fontSize: 21, lineHeight: 28 },
  sectionMeta: { fontSize: 12, lineHeight: 18 },
  spotlightCard: { marginTop: 16 },
  directory: { marginTop: 16 },
  directoryContent: { gap: 16, paddingHorizontal: 24, paddingBottom: 2 },
  skeletonTextGroup: { marginTop: 12, gap: 8 },
  skeletonLineTitle: { width: 136, height: 18, marginBottom: 16 },
  skeletonImageWide: { width: '100%', aspectRatio: 16 / 10 },
  skeletonLineWide: { height: 18, width: '55%' },
  skeletonLineNarrow: { height: 12, width: '35%' },
  skeletonDirectoryTitle: { width: 220, height: 18, marginBottom: 16 },
  skeletonDirectoryRow: { flexDirection: 'row', gap: 16 },
  skeletonDirectoryItem: { width: 256, gap: 8 },
  skeletonImageCompact: { width: 256, aspectRatio: 4 / 5 },
  skeletonLineCompact: { height: 14, width: '60%' },
});
