/**
 * Customer Explore tab (design: docs/design/explore-location-design-approval.md):
 * filter chips (All / Saved / Hours today / Under €100), a list/map toggle
 * and the barber list. Data and chip availability live in useExploreData.
 *
 * Map view: free MapLibre + OpenFreeMap everywhere — native in app builds,
 * the MapLibre GL web renderer in Expo Go and on web — drawn from safe
 * display coordinates only. Chips govern map and list alike.
 */
import { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GlassChip } from '../../shared/components/GlassChip';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { CardListSkeleton } from '../../shared/components/ScreenSkeletons';
import { listPerformance } from '../../shared/listPerformance';
import { getAppLanguage } from '../../shared/locale';
import { RevealItem } from '../../shared/motion/Reveal';
import { useTabBarClearance } from '../../shared/navigation/tabBarClearance';
import { useTheme } from '../../theme/useTheme';
import BarberCard from '../components/BarberCard';
import ExploreMapView from '../components/ExploreMapView';
import { MapEmptyCard, ViewModeToggle, type ViewMode } from '../components/explore/ExploreParts';
import type { ExploreFilterKey } from '../exploreData';
import { useExploreData } from '../hooks/useExploreData';
import type { CustomerTabParamList } from '../CustomerTabs';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Explore'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export default function ExploreScreen({ navigation }: Props) {
  // Scroll the last row clear of the floating glass tab bar.
  const tabClearance = useTabBarClearance(32);
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  // "Today" only means working hours cover today; busy slots are not
  // checked, so the label must not promise a free appointment.
  const chipLabels: Record<ExploreFilterKey, string> = de
    ? { all: 'Alle', saved: 'Gespeichert', today: 'Arbeitszeit heute', under100: 'Unter 100 €' }
    : { all: 'All', saved: 'Saved', today: 'Hours today', under100: 'Under €100' };
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const addFocusListener = useCallback((listener: () => void) => navigation.addListener('focus', listener), [navigation]);
  const data = useExploreData(de, addFocusListener);
  const { city, barbers, filtered, servicesByBarber } = data;
  const openProfile = useCallback((barberId: string) => navigation.navigate('BarberProfile', { barberId }), [navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-explore-screen">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Entdecken' : 'Explore'}</Text>
          <Text style={[styles.subheading, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {city ? (de ? `Barber in ${city}` : `Masters around ${city}`) : (de ? 'Barber in deiner Nähe' : 'Masters around you')}
          </Text>
        </View>
        <ViewModeToggle viewMode={viewMode} de={de} onChange={setViewMode} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
        {data.availableChips.map((key) => (
          <GlassChip
            key={key}
            size="compact"
            label={chipLabels[key]}
            selected={data.filter === key}
            onPress={() => data.selectChip(key)}
            testID={`customer-explore-chip-${key}`}
          />
        ))}
      </ScrollView>

      {data.loading ? (
        <CardListSkeleton testID="customer-explore-loading" label={de ? 'Barber werden geladen' : 'Loading barbers'} />
      ) : data.error ? (
        <RetryNotice testID="customer-explore-error" message={data.error} onRetry={() => void data.load()} style={styles.noticeMargins} />
      ) : viewMode === 'map' ? (
        <View style={styles.mapArea} testID="customer-explore-map-area">
          {data.pins.length === 0 ? (
            <MapEmptyCard hasBarbers={filtered.length > 0} de={de} onShowList={() => setViewMode('list')} />
          ) : (
            <ExploreMapView pins={data.pins} barbersById={data.barbersById} servicesByBarber={servicesByBarber} onOpenProfile={openProfile} />
          )}
        </View>
      ) : filtered.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="customer-explore-empty">
          {barbers.length === 0
            ? de ? `Noch keine Barber in ${city ?? 'deiner Stadt'}.` : `No barbers found in ${city ?? 'your city'} yet.`
            : de ? 'Keine Barber passen zu diesem Filter.' : 'No barbers match this filter.'}
        </Text>
      ) : (
        <FlatList
          {...listPerformance}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabClearance }]}
          renderItem={({ item, index }) => (
            <RevealItem index={index} testID={`customer-explore-barber-${item.id}`}>
              <BarberCard barber={item} services={servicesByBarber.get(item.id) ?? []} variant="wide" onPress={() => openProfile(item.id)} />
            </RevealItem>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 24 },
  headerText: { flex: 1 },
  heading: { fontSize: 30 },
  subheading: { fontSize: 13, marginTop: 4 },
  chipsScroll: { marginTop: 18, flexGrow: 0 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 2 },
  noticeMargins: { marginTop: 32, marginHorizontal: 24 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },
  mapArea: { flex: 1, marginTop: 16 },
  listContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32, gap: 16 },
});
