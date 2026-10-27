/**
 * Discover's barber listing in its three shapes: search results while a
 * query or service filter is active, the browse sections otherwise
 * (spotlight, the city rail, highest rated, how it works), and the empty
 * states. Plus the first-load skeleton.
 */
import { FlatList, Pressable, Text, View } from 'react-native';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Reveal } from '../../../shared/motion';
import type { BarberStatsRow } from '../../../shared/barberStats';
import { typeScale } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { BarberDirectoryRow, ServiceRow } from '../../../types';
import BarberCard from '../BarberCard';
import { HowItWorksCard } from '../HowItWorksCard';
import { discoverStyles as styles } from './discoverStyles';

type Services = ReadonlyMap<string, ServiceRow[]>;

export function DiscoverEmpty({
  noBarbersInCity,
  cityName,
  de,
  onChangeCity,
  onClearFilters,
}: {
  noBarbersInCity: boolean;
  cityName: string | null;
  de: boolean;
  onChangeCity: () => void;
  onClearFilters: () => void;
}) {
  return noBarbersInCity ? (
    <EmptyState
      icon="map-pin"
      testID="customer-home-empty"
      title={de ? `Noch keine Barber in ${cityName ?? 'deiner Stadt'}` : `No barbers in ${cityName ?? 'your city'} yet`}
      body={de
        ? 'Wir prüfen jeden Barber persönlich, bevor er hier erscheint. Schau bald wieder vorbei oder ändere deine Stadt.'
        : 'We check every barber by hand before they appear here. Check back soon, or change your city.'}
      action={{ label: de ? 'Stadt ändern' : 'Change city', onPress: onChangeCity, testID: 'customer-home-empty-change-city' }}
    />
  ) : (
    <EmptyState
      icon="search"
      testID="customer-home-empty"
      title={de ? 'Keine Treffer' : 'No matches'}
      body={de ? 'Kein verifizierter Barber passt zu deiner Suche. Versuch einen anderen Namen oder eine andere Leistung.' : 'No verified barber matches your search. Try another name or service.'}
      action={{ label: de ? 'Suche zurücksetzen' : 'Clear search', onPress: onClearFilters, testID: 'customer-home-empty-clear' }}
    />
  );
}

export function DiscoverResults({
  barbers,
  servicesByBarber,
  de,
  onClearFilters,
  onOpenProfile,
}: {
  barbers: readonly BarberDirectoryRow[];
  servicesByBarber: Services;
  de: boolean;
  onClearFilters: () => void;
  onOpenProfile: (barberId: string) => void;
}) {
  const { colors, fonts } = useTheme();
  const count = barbers.length;
  return (
    <View style={[styles.pad, styles.resultsSection]} testID="customer-home-directory">
      <View style={styles.resultsHeader}>
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={[typeScale.secondary, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}
          testID="customer-home-result-count"
        >
          {de ? `${count} Treffer` : `${count} ${count === 1 ? 'result' : 'results'}`}
        </Text>
        <Pressable
          onPress={onClearFilters}
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
        {barbers.map((barber) => (
          <BarberCard key={barber.id} barber={barber} services={servicesByBarber.get(barber.id) ?? []} variant="row" onPress={() => onOpenProfile(barber.id)} />
        ))}
      </View>
    </View>
  );
}

export function DiscoverBrowse({
  spotlight,
  directory,
  topRated,
  showHowItWorks,
  servicesByBarber,
  statsById,
  cityName,
  de,
  onOpenProfile,
}: {
  spotlight: BarberDirectoryRow | null;
  directory: readonly BarberDirectoryRow[];
  topRated: readonly BarberDirectoryRow[];
  showHowItWorks: boolean;
  servicesByBarber: Services;
  statsById: ReadonlyMap<string, BarberStatsRow>;
  cityName: string | null;
  de: boolean;
  onOpenProfile: (barberId: string) => void;
}) {
  const { colors, fonts } = useTheme();
  const title = { color: colors.textPrimary, fontFamily: fonts.headingMedium };
  const note = { color: colors.textSecondary, fontFamily: fonts.body };
  const cityLabel = de ? `Verifizierte Barber in ${cityName ?? 'deiner Stadt'}` : `Verified barbers in ${cityName ?? 'your city'}`;
  const count = directory.length;
  return (
    <>
      {spotlight ? (
        <Reveal index={3}>
          <View style={[styles.pad, styles.section]} testID="customer-home-spotlight">
            <Text accessibilityRole="header" style={[styles.sectionTitle, title]}>
              {de ? 'Ein Barber zum Kennenlernen' : 'A barber to meet'}
            </Text>
            {/* The lead card rotates daily by a stable order; it is not a
                ranking or an editorial endorsement, and says so. */}
            <Text style={[styles.spotlightNote, note]} testID="customer-home-spotlight-note">
              {de ? 'Wechselt täglich · keine Rangliste' : 'Rotates daily · not a ranking'}
            </Text>
            <View style={styles.spotlightCard}>
              <BarberCard
                barber={spotlight}
                services={servicesByBarber.get(spotlight.id) ?? []}
                variant="wide"
                responseMinutes={statsById.get(spotlight.id)?.median_response_minutes ?? null}
                onPress={() => onOpenProfile(spotlight.id)}
              />
            </View>
          </View>
        </Reveal>
      ) : null}

      {count > 0 ? (
        <Reveal index={4}>
          <View style={styles.section} testID="customer-home-directory">
            <View style={[styles.pad, styles.sectionHeader]}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, title]}>{cityLabel}</Text>
              <Text style={[styles.sectionMeta, note]}>
                {de ? `${count} Barber` : `${count} ${count === 1 ? 'barber' : 'barbers'}`}
              </Text>
            </View>
            <FlatList
              horizontal
              style={styles.directory}
              data={directory}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.directoryContent}
              accessibilityLabel={cityLabel}
              renderItem={({ item }) => (
                <BarberCard barber={item} services={servicesByBarber.get(item.id) ?? []} variant="compact" onPress={() => onOpenProfile(item.id)} />
              )}
            />
          </View>
        </Reveal>
      ) : null}

      {topRated.length > 0 ? (
        <Reveal index={5}>
          <View style={[styles.pad, styles.section]} testID="customer-home-top-rated">
            <Text accessibilityRole="header" style={[styles.sectionTitle, title]}>
              {de ? 'Am besten bewertet' : 'Highest rated'}
            </Text>
            <Text style={[styles.spotlightNote, note]}>
              {de ? 'Nach echten Kundenbewertungen' : 'By real customer reviews'}
            </Text>
            <View style={styles.resultsList}>
              {topRated.map((barber) => (
                <BarberCard key={barber.id} barber={barber} services={servicesByBarber.get(barber.id) ?? []} variant="row" onPress={() => onOpenProfile(barber.id)} />
              ))}
            </View>
          </View>
        </Reveal>
      ) : null}

      {showHowItWorks ? (
        <Reveal index={6}>
          <View style={[styles.pad, styles.section]}>
            <HowItWorksCard />
          </View>
        </Reveal>
      ) : null}
    </>
  );
}

export function DiscoverSkeleton() {
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
