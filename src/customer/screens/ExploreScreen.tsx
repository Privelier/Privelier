/**
 * Customer Explore tab (Run B — design: docs/design/explore-location-
 * design-approval.md) — replaces the placeholder. Prototype layout: filter
 * chips (All / Available today / Under €100 / Verified), a map/list view
 * toggle, and the barber list; the docked-card-on-pin-tap half arrives with
 * the map integration follow-up.
 *
 * Data is real end to end and reuses the Discover read chain (condition C9):
 * own city via fetchOwnProfile → listBarbersByCity → one batched services
 * read + one batched availability read. The two enrichment reads are
 * decorative-degrade with a twist the chips demand: a chip whose backing
 * read failed is HIDDEN rather than silently filtering everyone out — a
 * failed availability read must not render as "no one is available today".
 *
 * Map view: the native SDK provides the interactive view in development
 * builds; Expo Go uses a cached Mapbox Static Images preview from safe display
 * coordinates. Empty and failed states stay explicit, and chips govern both
 * map and list alike.
 *
 * Mount-load pattern mirrors DiscoverScreen (deferred plain useEffect —
 * component-testable, same set-state-in-effect rationale).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchOwnProfile } from '../../auth/authService';
import { useTheme } from '../../theme/useTheme';
import { pressOpacity } from '../../theme/motion';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { GlassSurface } from '../../shared/components/GlassSurface';
import type { AvailabilityRow, BarberDirectoryRow, ServiceRow } from '../../types';
import { listBarbersByCity, listServicesForBarberIds } from '../discoveryData';
import { listAvailabilityForBarberIds } from '../availabilityData';
import { applyExploreFilter, toMapPin, type ExploreFilterKey } from '../exploreData';
import { buildStaticMapUrl, hasMapboxPublicToken, isMapNativeAvailable } from '../mapRuntime';
import { getAppLanguage } from '../../shared/locale';
import BarberCard from '../components/BarberCard';
import type ExploreMapViewType from '../components/ExploreMapView';
import type { CustomerTabParamList } from '../CustomerTabs';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Explore'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

type ViewMode = 'list' | 'map';

export default function ExploreScreen({ navigation }: Props) {
  const { colors, fonts, isDark } = useTheme();
  const isGerman = getAppLanguage() === 'de';
  const chipLabels: Record<ExploreFilterKey, string> = isGerman
    ? { all: 'Alle', today: 'Heute verfügbar', under100: 'Unter 100 €', verified: 'Verifiziert' }
    : { all: 'All', today: 'Works today', under100: 'Under €100', verified: 'Verified' };
  const listActionLabel = isGerman ? 'Zur Liste wechseln' : 'Switch to list view';

  const [city, setCity] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberDirectoryRow[]>([]);
  const [services, setServices] = useState<ServiceRow[] | null>(null);
  const [windows, setWindows] = useState<AvailabilityRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExploreFilterKey>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [failedStaticMapUrl, setFailedStaticMapUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error') {
      setLoading(false);
      setError(profileResult.message);
      return;
    }
    const ownCity = profileResult.profile?.city?.trim();
    if (!ownCity) {
      setLoading(false);
      setError('We could not confirm your service area. Try again.');
      return;
    }
    setCity(ownCity);

    const barbersResult = await listBarbersByCity(ownCity);
    if (barbersResult.status !== 'ok') {
      setLoading(false);
      setError(barbersResult.message);
      return;
    }
    setBarbers(barbersResult.barbers);

    // Enrichment reads back the chips: null = read failed = that chip hides
    // (a failed read must never masquerade as "nobody matches").
    const ids = barbersResult.barbers.map((b) => b.id);
    const [servicesResult, windowsResult] = await Promise.all([
      listServicesForBarberIds(ids),
      listAvailabilityForBarberIds(ids),
    ]);
    setServices(servicesResult.status === 'ok' ? servicesResult.services : null);
    setWindows(windowsResult.status === 'ok' ? windowsResult.windows : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    // Deferred via .then() (not called directly) — same
    // react-hooks/set-state-in-effect rationale as DiscoverScreen.
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const servicesByBarber = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const s of services ?? []) {
      const list = map.get(s.barber_id);
      if (list) list.push(s);
      else map.set(s.barber_id, [s]);
    }
    return map;
  }, [services]);

  const windowsByBarber = useMemo(() => {
    const map = new Map<string, AvailabilityRow[]>();
    for (const w of windows ?? []) {
      const list = map.get(w.barber_id);
      if (list) list.push(w);
      else map.set(w.barber_id, [w]);
    }
    return map;
  }, [windows]);

  // Chips whose backing data actually loaded. 'all' and 'verified' need
  // nothing beyond the directory row itself.
  const availableChips = useMemo(() => {
    const chips: ExploreFilterKey[] = ['all'];
    if (windows !== null) chips.push('today');
    if (services !== null) chips.push('under100');
    chips.push('verified');
    return chips;
  }, [services, windows]);

  const filtered = useMemo(
    () =>
      applyExploreFilter(barbers, filter, {
        servicesByBarber,
        windowsByBarber,
        now: new Date(),
      }),
    [barbers, filter, servicesByBarber, windowsByBarber]
  );

  const openProfile = useCallback(
    (barberId: string) => navigation.navigate('BarberProfile', { barberId }),
    [navigation]
  );

  // Map pins: OFFSET display coordinates only; a barber without location
  // data yields null and simply has no pin (D4). Derived from the FILTERED
  // list so the chips govern the map exactly like the list.
  const pins = useMemo(
    () =>
      filtered
        .map((b) => toMapPin(b, servicesByBarber.get(b.id) ?? []))
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [filtered, servicesByBarber]
  );

  const barbersById = useMemo(() => new Map(barbers.map((b) => [b.id, b])), [barbers]);

  // The @rnmapbox/maps JS package THROWS at import time when its native side
  // is absent (pre-Mapbox dev client, jest) — so the map pane is require()d
  // lazily, and only when the native module reports present.
  const mapAvailable = useMemo(() => isMapNativeAvailable(), []);
  const mapTokenAvailable = hasMapboxPublicToken();
  const staticMapUrl = useMemo(
    () => buildStaticMapUrl(pins, isDark),
    [pins, isDark]
  );
  const staticMapFailed = staticMapUrl !== null && failedStaticMapUrl === staticMapUrl;
  const ExploreMapView = useMemo<typeof ExploreMapViewType | null>(() => {
    if (!mapAvailable) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('../components/ExploreMapView') as { default: typeof ExploreMapViewType })
      .default;
  }, [mapAvailable]);

  const baseMapFallback = ExploreMapView === null
    ? {
        testID: 'customer-explore-map-soon',
        icon: 'map' as const,
        title: isGerman ? 'Nutze die Privelier Testversion für die Karte' : 'Open the Privelier test build to use the map',
        message: isGerman
          ? 'Expo Go enthält keine native Karte. Installiere die Privelier Testversion oder wechsle zur Liste.'
          : 'Expo Go does not include the native map. Install the Privelier development build, or switch to list view.',
      }
    : !mapTokenAvailable
      ? {
          testID: 'customer-explore-map-not-configured',
          icon: 'map' as const,
          title: isGerman ? 'Karte nicht verfügbar' : 'Mapbox is not configured',
          message: isGerman
            ? 'Die Karte ist in dieser Version nicht eingerichtet. Du kannst stattdessen die Liste öffnen.'
            : 'The map is not configured in this build. You can use the list view instead.',
        }
      : pins.length === 0
        ? {
            testID: 'customer-explore-map-empty',
            icon: 'map-pin' as const,
            title: isGerman ? 'Noch keine Barber auf der Karte' : 'No barbers on the map yet',
            message: filtered.length > 0
              ? isGerman
                ? 'Sobald Barber ihren Standort hinterlegen, erscheinen sie hier. Bis dahin kannst du die Liste nutzen.'
                : 'Barbers appear here once they set their location. Use the list view meanwhile.'
              : isGerman ? 'Keine Barber passen zu diesem Filter.' : 'No barbers match this filter.',
          }
        : null;

  const mapFallback = baseMapFallback?.testID === 'customer-explore-map-soon'
    ? {
        ...baseMapFallback,
        title: !mapTokenAvailable
          ? isGerman ? 'Mapbox ist nicht eingerichtet' : 'Mapbox is not configured'
          : pins.length === 0
            ? isGerman ? 'Noch keine Barber auf der Karte' : 'No barbers on the map yet'
            : isGerman ? 'Mapbox Kartenvorschau' : 'Mapbox map preview',
        message: !mapTokenAvailable
          ? isGerman ? 'Diese Version enthält noch keinen Mapbox-Schlüssel. Du kannst stattdessen die Liste nutzen.' : 'Mapbox is not configured in this build. You can use the list instead.'
          : pins.length === 0
            ? filtered.length > 0
              ? isGerman ? 'Barber erscheinen hier, sobald ihr Standort hinterlegt ist. Nutze bis dahin die Liste.' : 'Barbers appear here once they add a location. Use the list meanwhile.'
              : isGerman ? 'Keine Barber passen zu diesem Filter.' : 'No barbers match this filter.'
            : staticMapFailed
          ? isGerman ? 'Die Karte konnte nicht geladen werden. Versuch es erneut oder öffne die Liste.' : 'The map could not load. Try again or switch to the list.'
          : staticMapUrl
            ? isGerman ? 'Die Vorschau zeigt Barber in deiner Umgebung. Zum Verschieben und Zoomen nutze die Privelier Testversion.' : 'This preview shows barbers nearby. Use the Privelier development build to pan and zoom.'
            : isGerman ? 'Die Kartenvorschau ist nicht verfügbar. Du kannst stattdessen die Liste nutzen.' : 'The map preview is unavailable. You can use the list instead.',
      }
    : baseMapFallback;

  const selectChip = useCallback((key: ExploreFilterKey) => {
    setFilter((prev) => (prev === key && key !== 'all' ? 'all' : key));
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-explore-screen"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {isGerman ? 'Entdecken' : 'Explore'}
          </Text>
          <Text style={[styles.subheading, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {city ? (isGerman ? `Barber in ${city}` : `Masters around ${city}`) : (isGerman ? 'Barber in deiner Nähe' : 'Masters around you')}
          </Text>
        </View>

        {/* List | Map toggle */}
        <View style={[styles.toggle, { borderColor: colors.border }]}>
          {(['list', 'map'] as ViewMode[]).map((mode) => {
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={mode === 'list'
                  ? (isGerman ? 'Listenansicht' : 'List view')
                  : (isGerman ? 'Kartenansicht' : 'Map view')}
                testID={`customer-explore-toggle-${mode}`}
                style={({ pressed }) => [
                  styles.toggleButton,
                  active && { backgroundColor: colors.surface },
                  pressed ? { opacity: pressOpacity.soft } : null,
                ]}
              >
                <Feather
                  name={mode === 'list' ? 'list' : 'map'}
                  size={14}
                  color={active ? colors.accentText : colors.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {availableChips.map((key) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => selectChip(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`customer-explore-chip-${key}`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.chip,
                active
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { borderColor: colors.border },
                pressed ? { opacity: pressOpacity.soft } : null,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { fontFamily: fonts.body },
                  active ? { color: colors.onAccent } : { color: colors.textSecondary },
                ]}
              >
                {chipLabels[key]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="customer-explore-loading"
        />
      ) : error ? (
        <RetryNotice testID="customer-explore-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} />
      ) : viewMode === 'map' ? (
        <View style={styles.mapArea} testID="customer-explore-map-area">
          {mapFallback ? (
            <View style={styles.mapFallbackArea} testID={mapFallback.testID}>
              {staticMapUrl && !staticMapFailed ? (
                <Image
                  key={staticMapUrl}
                  source={{ uri: staticMapUrl }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  accessibilityLabel={isGerman ? `Mapbox Karte mit ${pins.length} Barber-Standorten` : `Mapbox map with ${pins.length} barber locations`}
                  testID="customer-explore-static-map"
                  onError={() => setFailedStaticMapUrl(staticMapUrl)}
                  style={styles.staticMapImage}
                />
              ) : null}
              <GlassSurface style={styles.mapSoon} testID="customer-explore-map-preview-card">
              <Feather name={mapFallback.icon} size={22} color={colors.textSecondary} />
              <Text style={[styles.mapSoonTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                {mapFallback.title}
              </Text>
              <Text style={[styles.mapSoonBlurb, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {mapFallback.message}
              </Text>
              {staticMapFailed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isGerman ? 'Karte erneut laden' : 'Retry map'}
                  testID="customer-explore-map-retry"
                  onPress={() => setFailedStaticMapUrl(null)}
                  style={({ pressed }) => [
                    styles.mapListAction,
                    { borderColor: colors.border },
                    pressed ? { opacity: pressOpacity.soft } : null,
                  ]}
                >
                  <Text style={[styles.mapListActionText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                    {isGerman ? 'Erneut laden' : 'Retry map'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={listActionLabel}
                testID="customer-explore-map-switch-to-list"
                onPress={() => setViewMode('list')}
                style={({ pressed }) => [
                  styles.mapListAction,
                  { borderColor: colors.border },
                  pressed ? { opacity: pressOpacity.soft } : null,
                ]}
              >
                <Text style={[styles.mapListActionText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                  {isGerman ? 'Zur Liste' : 'Show list'}
                </Text>
              </Pressable>
              </GlassSurface>
            </View>
          ) : ExploreMapView ? (
            <ExploreMapView
              pins={pins}
              barbersById={barbersById}
              servicesByBarber={servicesByBarber}
              onOpenProfile={openProfile}
            />
          ) : null}
        </View>
      ) : filtered.length === 0 ? (
        <Text
          style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
          testID="customer-explore-empty"
        >
          {barbers.length === 0
            ? `No barbers found in ${city ?? 'your city'} yet.`
            : 'No barbers match this filter.'}
        </Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.listItem} testID={`customer-explore-barber-${item.id}`}>
              <BarberCard
                barber={item}
                services={servicesByBarber.get(item.id) ?? []}
                variant="wide"
                onPress={() => openProfile(item.id)}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  headerText: { flex: 1 },
  heading: { fontSize: 30 },
  subheading: { fontSize: 13, marginTop: 4 },

  toggle: {
    flexDirection: 'row',
    borderWidth: 0.5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  chipsScroll: { marginTop: 18, flexGrow: 0 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 2 },
  chip: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12 },

  spinner: { marginTop: 48 },
  noticeMargins: { marginTop: 32, marginHorizontal: 24 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },

  mapArea: { flex: 1, marginTop: 16 },
  mapFallbackArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 },
  staticMapImage: { flex: 1, width: '100%', minHeight: 120 },
  mapSoon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 10,
  },
  mapSoonTitle: { fontSize: 18, textAlign: 'center' },
  mapSoonBlurb: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  mapListAction: {
    minHeight: 44,
    paddingHorizontal: 18,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapListActionText: { fontSize: 14 },

  listContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32, gap: 16 },
  listItem: {},
});
