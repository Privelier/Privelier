/**
 * Customer discovery using authenticated, approved-directory data only.
 * Data lives in useDiscoverData; the sections are in components/discover.
 *
 * Existing Maestro IDs are preserved:
 * customer-home-screen / -loading / -error / -retry / -empty /
 * -search / -barber-{id}.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { Notice } from '../../shared/components/Notice';
import { useFeatureFlag } from '../../shared/featureFlags';
import { getAppLanguage } from '../../shared/locale';
import { Reveal, ScrollGlassHeader, useScrollGlass } from '../../shared/motion';
import { useTabBarClearance } from '../../shared/navigation/tabBarClearance';
import { useTheme } from '../../theme/useTheme';
import { BrandCarousel } from '../components/discover/BrandCarousel';
import { LooksFeedRail } from '../components/looks/LooksFeedRail';
import { DiscoverBrowse, DiscoverEmpty, DiscoverResults, DiscoverSkeleton } from '../components/discover/DiscoverDirectory';
import { DiscoverGreeting, DiscoverSearch } from '../components/discover/DiscoverIntro';
import { discoverStyles as styles } from '../components/discover/discoverStyles';
import { MapTeaserCard } from '../components/MapTeaserCard';
import { RebookRail } from '../components/RebookRail';
import { UpNextCard } from '../components/UpNextCard';
import {
  buildDiscoverPresentation,
  deriveServiceFilters,
  groupServicesByBarber,
  selectMappableBarbers,
  selectRebookBarbers,
  selectTopRated,
  selectUpNext,
} from '../discoverPresentation';
import { useDiscoverData } from '../hooks/useDiscoverData';
import type { CustomerTabParamList } from '../CustomerTabs';
import type { CustomerStackParamList } from '../CustomerNavigator';

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
  const [query, setQuery] = useState('');
  const onFocus = useCallback((listener: () => void) => navigation.addListener('focus', listener), [navigation]);
  const data = useDiscoverData({ de, onFocus });
  const looksOn = useFeatureFlag('looks');
  const { barbers, services, activeService, setActiveService, ownBookings, cityName, loading, hasSnapshot, error, missingCity, load } = data;

  const servicesByBarber = useMemo(() => groupServicesByBarber(services ?? []), [services]);
  const serviceFilters = useMemo(() => deriveServiceFilters(services), [services]);
  const presentation = useMemo(
    () => buildDiscoverPresentation({ barbers, servicesByBarber, servicesAvailable: services !== null, query, activeService }),
    [barbers, servicesByBarber, services, query, activeService]
  );
  const upNext = useMemo(
    () => (ownBookings ? selectUpNext(ownBookings.bookings, ownBookings.barbersById, ownBookings.servicesById) : null),
    [ownBookings]
  );
  const rebookBarbers = useMemo(
    () => (ownBookings ? selectRebookBarbers(ownBookings.bookings, ownBookings.barbersById) : []),
    [ownBookings]
  );
  const mappableBarbers = useMemo(() => selectMappableBarbers(barbers), [barbers]);
  const topRated = useMemo(() => selectTopRated(barbers), [barbers]);

  const openProfile = useCallback((barberId: string) => navigation.navigate('BarberProfile', { barberId }), [navigation]);
  const clearFilters = useCallback(() => {
    setQuery('');
    setActiveService(null);
  }, [setActiveService]);

  const filtering = presentation.hasActiveFilter;
  const hasResults = Boolean(presentation.spotlight) || presentation.directory.length > 0;
  // First-time customers (nothing upcoming, nobody to rebook) get the
  // three-step explainer; returning customers already know the flow.
  const showHowItWorks = ownBookings !== null && !upNext && rebookBarbers.length === 0;

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

  let listing;
  if (loading && !hasSnapshot) {
    listing = <DiscoverSkeleton />;
  } else if (error && !hasSnapshot) {
    listing = errorNotice;
  } else if (!hasResults) {
    listing = (
      <DiscoverEmpty
        noBarbersInCity={barbers.length === 0}
        cityName={cityName}
        de={de}
        onChangeCity={() => navigation.navigate('EditProfile')}
        onClearFilters={clearFilters}
      />
    );
  } else if (filtering) {
    listing = (
      <DiscoverResults barbers={presentation.directory} servicesByBarber={servicesByBarber} de={de} onClearFilters={clearFilters} onOpenProfile={openProfile} />
    );
  } else {
    listing = (
      <DiscoverBrowse
        spotlight={presentation.spotlight}
        directory={presentation.directory}
        topRated={topRated}
        showHowItWorks={showHowItWorks}
        servicesByBarber={servicesByBarber}
        statsById={data.statsById}
        cityName={cityName}
        de={de}
        onOpenProfile={openProfile}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-home-screen">
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
        <DiscoverGreeting
          ownName={data.ownName}
          showNameSkeleton={loading && !hasSnapshot && !data.ownName}
          serviceArea={data.serviceArea}
          de={de}
          onOpenNotifications={() => navigation.navigate('NotificationCenter')}
        />

        {upNext ? (
          <Reveal index={0}>
            <View style={[styles.pad, styles.upNextWrap]}>
              <UpNextCard upNext={upNext} onPress={() => navigation.navigate('Bookings')} />
            </View>
          </Reveal>
        ) : null}

        <DiscoverSearch
          query={query}
          onQueryChange={setQuery}
          serviceFilters={serviceFilters}
          activeService={activeService}
          onServiceChange={setActiveService}
          de={de}
        />

        {!filtering ? (
          <Reveal index={1}>
            <BrandCarousel />
          </Reveal>
        ) : null}

        {!filtering && mappableBarbers.length > 0 ? (
          <Reveal index={1}>
            <View style={[styles.pad, styles.teaserWrap]}>
              <MapTeaserCard barbers={mappableBarbers} cityName={cityName} onOpenMap={() => navigation.navigate('Explore')} />
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

        {looksOn && !filtering && hasSnapshot ? (
          <Reveal index={2}>
            <View style={styles.section}>
              <LooksFeedRail
                barbers={barbers}
                cityName={cityName}
                de={de}
                onOpenLook={(lookId) => navigation.navigate('LookDetail', { lookId })}
                onOpenBarber={openProfile}
                onSearch={(style) => navigation.navigate('LookSearch', style ? { style } : undefined)}
                onOpenPass={() => navigation.navigate('LookPass')}
              />
            </View>
          </Reveal>
        ) : null}

        {hasSnapshot ? errorNotice : null}
        {listing}
      </Animated.ScrollView>
      <ScrollGlassHeader title={de ? 'Entdecken' : 'Discover'} scrollY={scrollY} start={64} testID="customer-home-glass-header" />
    </SafeAreaView>
  );
}
