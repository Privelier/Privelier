/**
 * Customer discovery using authenticated, approved-directory data only.
 * Service data is optional enrichment: if its read fails, the directory and
 * barber-name search remain available while service filters and prices hide.
 *
 * Existing Maestro IDs are preserved:
 * customer-home-screen / -loading / -error / -retry / -empty /
 * -search / -barber-{id}.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchOwnProfile } from '../../auth/authService';
import { useTheme } from '../../theme/useTheme';
import { Notice } from '../../shared/components/Notice';
import { Skeleton } from '../../shared/components/Skeleton';
import { getAppLanguage } from '../../shared/locale';
import Animated from 'react-native-reanimated';
import { Reveal, ScrollGlassHeader, useScrollGlass } from '../../shared/motion';
import { GlassSurface } from '../../shared/components/GlassSurface';
import type { BarberDirectoryRow, ServiceRow } from '../../types';
import { listBarbersByCity, listServicesForBarberIds } from '../discoveryData';
import { fetchBarberStats, type BarberStatsRow } from '../../shared/barberStats';
import {
  buildDiscoverPresentation,
  deriveServiceFilters,
  getDiscoverBrandMessages,
  groupServicesByBarber,
  selectRebookBarbers,
  selectUpNext,
} from '../discoverPresentation';
import { firstName, timeOfDayGreeting } from '../format';
import { fetchOwnBookingsView } from '../bookingsData';
import type { OwnBookingsViewResult } from '../types';
import { UpNextCard } from '../components/UpNextCard';
import { RebookRail } from '../components/RebookRail';
import { EmptyState } from '../../shared/components/EmptyState';
import { typeScale } from '../../theme/typography';
import { space } from '../../theme/spacing';
import BarberCard from '../components/BarberCard';
import { NotificationBell } from '../../shared/components/NotificationBell';
import type { CustomerTabParamList } from '../CustomerTabs';
import type { CustomerStackParamList } from '../CustomerNavigator';
import { GlassChip } from '../../shared/components/GlassChip';
import { useTabBarClearance } from '../../shared/navigation/tabBarClearance';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Discover'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export default function DiscoverScreen({ navigation }: Props) {
  // Scroll the last row clear of the floating glass tab bar.
  const tabClearance = useTabBarClearance(40);
  const { colors, fonts } = useTheme();
  const { scrollY, onScroll } = useScrollGlass();
  const de = getAppLanguage() === 'de';
  const { width: viewportWidth } = useWindowDimensions();
  const [ownName, setOwnName] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [serviceArea, setServiceArea] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberDirectoryRow[]>([]);
  const [statsById, setStatsById] = useState<Map<string, BarberStatsRow>>(new Map());
  const [services, setServices] = useState<ServiceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingCity, setMissingCity] = useState(false);
  const [query, setQuery] = useState('');
  const [activeService, setActiveService] = useState<string | null>(null);
  const [activeBrandMessage, setActiveBrandMessage] = useState(0);
  const brandMessages = getDiscoverBrandMessages(Intl.DateTimeFormat().resolvedOptions().locale);
  // The customer's own bookings feed "Up next" and "Book again". Optional
  // enrichment: a failed read hides both sections and never blocks discovery.
  const [ownBookings, setOwnBookings] = useState<Extract<OwnBookingsViewResult, { status: 'ok' }> | null>(null);

  const loadOwnBookings = useCallback(async () => {
    try {
      const result = await fetchOwnBookingsView();
      if (result.status === 'ok') setOwnBookings(result);
    } catch {
      // Keep the last good snapshot; the directory does not depend on it.
    }
  }, []);

  const load = useCallback(async () => {
    void loadOwnBookings();
    setLoading(true);
    setError(null);
    setMissingCity(false);

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
      setHasSnapshot(false);
      setCityName(null);
      setServiceArea(null);
      setBarbers([]);
      setServices(null);
      setError(de ? 'Füge deine Stadt hinzu, um verifizierte Barber in deiner Nähe zu finden.' : 'Add your city to discover verified barbers near you.');
      return;
    }
    const country = profileResult.profile?.country?.trim();
    const barbersResult = await listBarbersByCity(city);
    if (barbersResult.status !== 'ok') {
      setLoading(false);
      setError(barbersResult.message);
      return;
    }
    setCityName(city);
    setServiceArea(country ? `${city}, ${country}` : city);
    setBarbers(barbersResult.barbers);
    setHasSnapshot(true);

    const barberIds = barbersResult.barbers.map((barber) => barber.id);
    // Stats ride alongside services in parallel; they only decorate cards.
    const [servicesResult, stats] = await Promise.all([
      listServicesForBarberIds(barberIds),
      fetchBarberStats(barberIds),
    ]);
    setStatsById(stats);
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
  }, [de, loadOwnBookings]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  // The directory is keyed by the profile city, which the customer can change
  // in Edit profile (including from this screen's missing-city action). On
  // refocus, one profile read decides whether the city changed; only then is
  // the directory reloaded, so ordinary tab switches cost no list requests.
  const loadedCityRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Recorded only once a load has settled on a city (or on "no city").
    if (hasSnapshot || missingCity) loadedCityRef.current = missingCity ? null : cityName;
  }, [cityName, missingCity, hasSnapshot]);
  useEffect(() => {
    return navigation.addListener('focus', () => {
      if (loadedCityRef.current === undefined) return; // first load still owns this
      // A booking made or answered elsewhere shows up here on return.
      void loadOwnBookings();
      void fetchOwnProfile().then((result) => {
        if (result.status !== 'ok') return;
        const city = result.profile?.city?.trim() || null;
        const loaded = loadedCityRef.current?.trim() || null;
        if ((city ?? '').toLocaleLowerCase() !== (loaded ?? '').toLocaleLowerCase()) void load();
      });
    });
  }, [navigation, load, loadOwnBookings]);

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

  const upNext = useMemo(
    () => (ownBookings ? selectUpNext(ownBookings.bookings, ownBookings.barbersById, ownBookings.servicesById) : null),
    [ownBookings]
  );
  const rebookBarbers = useMemo(
    () => (ownBookings ? selectRebookBarbers(ownBookings.bookings, ownBookings.barbersById) : []),
    [ownBookings]
  );
  const clearFilters = useCallback(() => {
    setQuery('');
    setActiveService(null);
  }, []);
  const filtering = presentation.hasActiveFilter;
  const resultCount = presentation.directory.length;

  const spotlight = presentation.spotlight;
  const hasResults = Boolean(spotlight) || presentation.directory.length > 0;
  const errorNotice = error ? (
    <Notice testID="customer-home-error" message={error} style={styles.noticeMargins}>
      <Pressable
        onPress={() => {
          if (missingCity) navigation.navigate('EditProfile');
          else void load();
        }}
        accessibilityRole="button"
        accessibilityLabel={missingCity ? (de ? 'Stadt zum Profil hinzufügen' : 'Add city to profile') : (de ? 'Erneut laden' : 'Retry discovery')}
        testID={missingCity ? 'customer-home-add-city' : 'customer-home-retry'}
        style={styles.noticeAction}
      >
        <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>
          {missingCity ? (de ? 'Stadt hinzufügen' : 'Add city') : (de ? 'Erneut versuchen' : 'Try again')}
        </Text>
      </Pressable>
    </Notice>
  ) : null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-home-screen"
    >
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        testID="customer-home-scroll"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabClearance }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading && hasSnapshot}
            onRefresh={() => void load()}
            progressViewOffset={12}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <View style={styles.pad}>
          <View style={styles.introRow}>
            <View style={styles.greetingBlock}>
              <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {timeOfDayGreeting()},
              </Text>
              {loading && !hasSnapshot && !ownName ? (
                <Skeleton style={styles.skeletonPersonalName} />
              ) : (
                <Text
                  accessibilityRole="header"
                  style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
                >
                  {firstName(ownName)}.
                </Text>
              )}
            </View>
            <NotificationBell onPress={() => navigation.navigate('NotificationCenter')} testID="customer-home-notifications" />
          </View>
          <View style={styles.serviceAreaRow}>
            <Feather name="map-pin" size={13} color={colors.accentText} />
            <Text
              style={[
                styles.serviceArea,
                { color: colors.textSecondary, fontFamily: fonts.body },
              ]}
            >
              {serviceArea ?? (de ? 'Deine Stadt' : 'Your city')}
            </Text>
          </View>
        </View>

        {upNext ? (
          <Reveal index={0}>
            <View style={[styles.pad, styles.upNextWrap]}>
              <UpNextCard upNext={upNext} onPress={() => navigation.navigate('Bookings')} />
            </View>
          </Reveal>
        ) : null}

        <Reveal index={0}>
          <View style={[styles.pad, styles.searchWrap]}>
            <GlassSurface
              testID="customer-home-search-surface"
              style={[
                styles.searchBox,
              ]}
            >
              <Feather name="search" size={16} color={colors.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={de ? 'Barber oder Leistung suchen' : 'Search a barber or service'}
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.textPrimary, fontFamily: fonts.body }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={de ? 'Barber oder Leistungen suchen' : 'Search barbers or services'}
                testID="customer-home-search"
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel={de ? 'Suche löschen' : 'Clear search'}
                  hitSlop={8}
                  testID="customer-home-search-clear"
                  style={styles.searchClear}
                >
                  <Feather name="x-circle" size={16} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </GlassSurface>
          </View>
        </Reveal>

        {serviceFilters.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersRow}
            accessibilityLabel={de ? 'Nach Leistung filtern' : 'Filter by service'}
          >
            {serviceFilters.map((service) => {
              const selected = activeService?.toLowerCase() === service.toLowerCase();
              return (
                <GlassChip
                  key={service}
                  label={service}
                  selected={selected}
                  onPress={() => setActiveService(selected ? null : service)}
                  accessibilityLabel={de ? `Nach ${service} filtern` : `Filter by ${service}`}
                />
              );
            })}
          </ScrollView>
        ) : null}

        {!filtering ? (
          <Reveal index={1}>
            <View style={styles.messageCarousel} testID="customer-home-brand-carousel">
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                accessibilityLabel={`Privelier inspiration, ${activeBrandMessage + 1} of ${brandMessages.length}`}
                onMomentumScrollEnd={({ nativeEvent }) =>
                  setActiveBrandMessage(Math.max(0, Math.min(brandMessages.length - 1, Math.round(nativeEvent.contentOffset.x / viewportWidth))))
                }
              >
                {brandMessages.map((message, index) => (
                  <View key={message} style={[styles.messagePage, { width: viewportWidth }]}>
                    <GlassSurface style={styles.messageCard} testID={`customer-home-brand-message-${index + 1}`}>
                      <Feather name={(['scissors', 'clock', 'home', 'sun'] as const)[index]} size={20} color={colors.accentText} />
                      <Text style={[styles.messageCopy, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                        {message}
                      </Text>
                    </GlassSurface>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.messageDots} accessible accessibilityLabel={`Slide ${activeBrandMessage + 1} of ${brandMessages.length}`}>
                {brandMessages.map((message, index) => (
                  <View
                    key={message}
                    style={[styles.messageDot, { backgroundColor: index === activeBrandMessage ? colors.accent : colors.border }]}
                  />
                ))}
              </View>
            </View>
          </Reveal>
        ) : null}

        {!filtering && rebookBarbers.length > 0 ? (
          <Reveal index={2}>
            <View style={styles.section}>
              <RebookRail barbers={rebookBarbers} onOpen={openProfile} />
            </View>
          </Reveal>
        ) : null}

        {hasSnapshot ? errorNotice : null}
        {loading && !hasSnapshot ? (
          <DiscoverSkeleton />
        ) : error && !hasSnapshot ? (
          errorNotice
        ) : !hasResults ? (
          barbers.length === 0 ? (
            <EmptyState
              icon="map-pin"
              testID="customer-home-empty"
              title={de ? `Noch keine Barber in ${cityName ?? 'deiner Stadt'}` : `No barbers in ${cityName ?? 'your city'} yet`}
              body={
                de
                  ? 'Wir prüfen jeden Barber persönlich, bevor er hier erscheint. Schau bald wieder vorbei oder ändere deine Stadt.'
                  : 'We check every barber by hand before they appear here. Check back soon, or change your city.'
              }
              action={{ label: de ? 'Stadt ändern' : 'Change city', onPress: () => navigation.navigate('EditProfile'), testID: 'customer-home-empty-change-city' }}
            />
          ) : (
            <EmptyState
              icon="search"
              testID="customer-home-empty"
              title={de ? 'Keine Treffer' : 'No matches'}
              body={de ? 'Kein verifizierter Barber passt zu deiner Suche. Versuch einen anderen Namen oder eine andere Leistung.' : 'No verified barber matches your search. Try another name or service.'}
              action={{ label: de ? 'Suche zurücksetzen' : 'Clear search', onPress: clearFilters, testID: 'customer-home-empty-clear' }}
            />
          )
        ) : filtering ? (
          <View style={[styles.pad, styles.resultsSection]} testID="customer-home-directory">
            <View style={styles.resultsHeader}>
              <Text
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
                style={[typeScale.secondary, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}
                testID="customer-home-result-count"
              >
                {de ? `${resultCount} Treffer` : `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`}
              </Text>
              <Pressable
                onPress={clearFilters}
                accessibilityRole="button"
                accessibilityLabel={de ? 'Suche und Filter zurücksetzen' : 'Clear search and filters'}
                hitSlop={8}
                testID="customer-home-clear-filters"
                style={styles.clearAction}
              >
                <Text style={[typeScale.secondary, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                  {de ? 'Zurücksetzen' : 'Clear'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.resultsList}>
              {presentation.directory.map((barber) => (
                <BarberCard
                  key={barber.id}
                  barber={barber}
                  services={servicesByBarber.get(barber.id) ?? []}
                  variant="row"
                  onPress={() => openProfile(barber.id)}
                />
              ))}
            </View>
          </View>
        ) : (
          <>
            {spotlight ? (
              <Reveal index={3}>
                <View style={[styles.pad, styles.section]} testID="customer-home-spotlight">
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.sectionTitle,
                      { color: colors.textPrimary, fontFamily: fonts.headingMedium },
                    ]}
                  >
                    {de ? 'Ein Barber zum Kennenlernen' : 'A barber to meet'}
                  </Text>
                  {/* The lead card rotates daily by a stable order; it is not a
                      ranking or an editorial endorsement, and says so. */}
                  <Text
                    style={[styles.spotlightNote, { color: colors.textSecondary, fontFamily: fonts.body }]}
                    testID="customer-home-spotlight-note"
                  >
                    {de ? 'Wechselt täglich · keine Rangliste' : 'Rotates daily · not a ranking'}
                  </Text>
                  <View style={styles.spotlightCard}>
                    <BarberCard
                      barber={spotlight}
                      services={servicesByBarber.get(spotlight.id) ?? []}
                      variant="wide"
                      responseMinutes={statsById.get(spotlight.id)?.median_response_minutes ?? null}
                      onPress={() => openProfile(spotlight.id)}
                    />
                  </View>
                </View>
              </Reveal>
            ) : null}

            {presentation.directory.length > 0 ? (
              <Reveal index={4}>
                <View style={styles.section} testID="customer-home-directory">
                  <View style={[styles.pad, styles.sectionHeader]}>
                    <Text
                      accessibilityRole="header"
                      style={[
                        styles.sectionTitle,
                        { color: colors.textPrimary, fontFamily: fonts.headingMedium },
                      ]}
                    >
                      {de ? `Verifizierte Barber in ${cityName ?? 'deiner Stadt'}` : `Verified barbers in ${cityName ?? 'your city'}`}
                    </Text>
                    <Text
                      style={[
                        styles.sectionMeta,
                        { color: colors.textSecondary, fontFamily: fonts.body },
                      ]}
                    >
                      {de ? `${resultCount} Barber` : `${resultCount} ${resultCount === 1 ? 'barber' : 'barbers'}`}
                    </Text>
                  </View>
                  <FlatList
                    horizontal
                    style={styles.directory}
                    data={presentation.directory}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.directoryContent}
                    accessibilityLabel={de ? `Verifizierte Barber in ${cityName ?? 'deiner Stadt'}` : `Verified barbers in ${cityName ?? 'your city'}`}
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
              </Reveal>
            ) : null}
          </>
        )}
      </Animated.ScrollView>
      <ScrollGlassHeader title={de ? 'Entdecken' : 'Discover'} scrollY={scrollY} start={64} testID="customer-home-glass-header" />
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
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  greetingBlock: { flex: 1, minWidth: 0 },
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
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  messageCarousel: { marginTop: 16 },
  messagePage: { paddingHorizontal: 24 },
  messageCard: { minHeight: 88, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  messageCopy: { fontSize: 18, lineHeight: 25, flex: 1 },
  messageDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  messageDot: { width: 5, height: 5, borderRadius: 3 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 10 },
  searchClear: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  upNextWrap: { marginTop: space.xl },
  resultsSection: { marginTop: space.xl },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  clearAction: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  resultsList: { gap: space.md, marginTop: space.xs },
  filtersScroll: { marginTop: 16, flexGrow: 0 },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 2 },
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
  spotlightNote: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  directory: { marginTop: 16 },
  directoryContent: { gap: 16, paddingHorizontal: 24, paddingBottom: 2 },
  skeletonTextGroup: { marginTop: 12, gap: 8 },
  skeletonLineTitle: { width: 136, height: 18, marginBottom: 16 },
  skeletonPersonalName: { width: 140, height: 30, marginTop: 4 },
  skeletonImageWide: { width: '100%', aspectRatio: 16 / 10 },
  skeletonLineWide: { height: 18, width: '55%' },
  skeletonLineNarrow: { height: 12, width: '35%' },
  skeletonDirectoryTitle: { width: 220, height: 18, marginBottom: 16 },
  skeletonDirectoryRow: { flexDirection: 'row', gap: 16 },
  skeletonDirectoryItem: { width: 256, gap: 8 },
  skeletonImageCompact: { width: 256, aspectRatio: 4 / 5 },
  skeletonLineCompact: { height: 14, width: '60%' },
});
