/**
 * Customer Discover screen — visual rebuild of the web prototype's
 * customer.discover route (greeting header, search field, service chips,
 * featured editorial card, horizontal "Nearby masters" rail, static
 * "Trending this week" grid) on top of the existing step 9-10 data layer.
 *
 * Data binding is real end to end: the signed-in customer's own city via
 * fetchOwnProfile (Contract B), approved barbers via listBarbersByCity, and
 * one batched services read (listServicesForBarberIds) that feeds both the
 * "from €X" price lines and the service-name filter chips. The services read
 * is decorative — if it fails, cards render without prices and the chip row
 * hides, rather than failing the whole screen.
 *
 * "Trending this week" is static editorial content carried over from the
 * prototype (curated style imagery, no backing table) — swap the entries in
 * TRENDING_STYLES to re-curate.
 *
 * Maestro contract preserved from the previous CustomerHomeScreen:
 * customer-home-screen / -loading / -error / -empty / -barber-{id} testIDs.
 * (customer-home-logout moved to the Account tab as customer-account-logout;
 * the two flows referencing it were updated in the same change.)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import type { BarberDirectoryRow, ServiceRow } from '../../types';
import { listBarbersByCity, listServicesForBarberIds } from '../discoveryData';
import { firstName, timeOfDayGreeting } from '../format';
import BarberCard from '../components/BarberCard';
import type { CustomerTabParamList } from '../CustomerTabs';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Discover'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

/** Static editorial content (see file header). */
const TRENDING_STYLES = [
  { name: 'Textured crop', image: 'https://images.unsplash.com/photo-1584316712724-f5d4b188fee2?w=600&q=80' },
  { name: 'Sharp fade', image: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&q=80' },
  { name: 'Soft layered', image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80' },
  { name: 'Classic side part', image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80' },
] as const;

const MAX_CHIPS = 6;

export default function DiscoverScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();

  const [ownName, setOwnName] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberDirectoryRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error') {
      setLoading(false);
      setError(profileResult.message);
      return;
    }
    setOwnName(profileResult.profile?.name ?? null);

    const ownCity = profileResult.profile?.city?.trim();
    if (!ownCity) {
      setLoading(false);
      setError('Add your city to your profile to see barbers near you.');
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

    // Decorative enrichment: prices + chips. Silent graceful degrade on error.
    const servicesResult = await listServicesForBarberIds(
      barbersResult.barbers.map((b) => b.id)
    );
    setServices(servicesResult.status === 'ok' ? servicesResult.services : []);
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

  const servicesByBarber = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const s of services) {
      const list = map.get(s.barber_id);
      if (list) list.push(s);
      else map.set(s.barber_id, [s]);
    }
    return map;
  }, [services]);

  // Chips are the distinct service names actually offered in this city,
  // most-offered first — the prototype's hardcoded category list, made real.
  const chips = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const s of services) {
      const key = s.name.trim().toLowerCase();
      if (!key) continue;
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label: s.name.trim(), count: 1 });
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, MAX_CHIPS)
      .map((e) => e.label);
  }, [services]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return barbers.filter((b) => {
      const own = servicesByBarber.get(b.id) ?? [];
      if (activeChip && !own.some((s) => s.name.trim().toLowerCase() === activeChip.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        own.some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [barbers, servicesByBarber, query, activeChip]);

  const featured = filtered[0];
  const rail = filtered.slice(1);

  const openProfile = useCallback(
    (barberId: string) => navigation.navigate('BarberProfile', { barberId }),
    [navigation]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-home-screen"
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.pad}>
          <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {timeOfDayGreeting()},
          </Text>
          <Text style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {firstName(ownName)}.
          </Text>
        </View>

        <View style={[styles.pad, styles.searchWrap]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a barber, a service, a style"
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.textPrimary, fontFamily: fonts.body }]}
              autoCapitalize="none"
              autoCorrect={false}
              testID="customer-home-search"
            />
          </View>
        </View>

        {chips.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {chips.map((chip) => {
              const active = activeChip?.toLowerCase() === chip.toLowerCase();
              return (
                <Pressable
                  key={chip}
                  onPress={() => setActiveChip(active ? null : chip)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.accent, borderColor: colors.accent }
                      : { borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { fontFamily: fonts.body },
                      active ? { color: colors.onAccent } : { color: colors.textSecondary },
                    ]}
                  >
                    {chip}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="customer-home-loading"
          />
        ) : error ? (
          <View
            testID="customer-home-error"
            accessibilityRole="alert"
            style={[styles.pad, styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
              {error}
            </Text>
          </View>
        ) : !featured ? (
          <Text
            style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
            testID="customer-home-empty"
          >
            {barbers.length === 0
              ? `No barbers found in ${city ?? 'your city'} yet.`
              : 'No barbers match your search.'}
          </Text>
        ) : (
          <>
            <View style={[styles.pad, styles.featured]}>
              <BarberCard
                barber={featured}
                services={servicesByBarber.get(featured.id) ?? []}
                variant="wide"
                featured
                onPress={() => openProfile(featured.id)}
              />
            </View>

            {rail.length > 0 ? (
              <View style={styles.section}>
                <View style={[styles.pad, styles.sectionHeader]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                    Nearby masters
                  </Text>
                  <Text style={[styles.sectionMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {rail.length} within reach
                  </Text>
                </View>
                <FlatList
                  horizontal
                  style={styles.rail}
                  data={rail}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.railContent}
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

        <View style={[styles.pad, styles.section]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            Trending this week
          </Text>
          <View style={styles.trendingGrid}>
            {TRENDING_STYLES.map((style) => (
              <View key={style.name} style={[styles.trendingTile, { backgroundColor: colors.surface }]}>
                <Image source={{ uri: style.image }} style={styles.trendingImage} resizeMode="cover" />
                <View style={styles.trendingScrim}>
                  <Text style={[styles.trendingLabel, { fontFamily: fonts.headingMedium }]}>
                    {style.name}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: 24, paddingBottom: 32 },
  pad: { paddingHorizontal: 24 },

  greeting: { fontSize: 13 },
  name: { fontSize: 30, marginTop: 4 },

  searchWrap: { marginTop: 24 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

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
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 32, marginHorizontal: 24 },
  noticeText: { fontSize: 14 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },

  featured: { marginTop: 30 },
  section: { marginTop: 38 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 21 },
  sectionMeta: { fontSize: 12 },
  rail: { marginTop: 16 },
  railContent: { gap: 16, paddingHorizontal: 24, paddingBottom: 2 },

  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  trendingTile: {
    width: '48%',
    flexGrow: 1,
    aspectRatio: 4 / 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  trendingImage: { width: '100%', height: '100%' },
  trendingScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trendingLabel: { color: '#F5F1E8', fontSize: 16 },
});
