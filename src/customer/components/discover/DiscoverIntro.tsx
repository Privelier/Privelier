/**
 * The top of Discover: greeting, notification bell, service area, then the
 * search field and service filter chips.
 */
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassChip } from '../../../shared/components/GlassChip';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { NotificationBell } from '../../../shared/components/NotificationBell';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Reveal } from '../../../shared/motion';
import { useTheme } from '../../../theme/useTheme';
import { firstName, timeOfDayGreeting } from '../../format';
import { discoverStyles as styles } from './discoverStyles';

export function DiscoverGreeting({
  ownName,
  showNameSkeleton,
  serviceArea,
  de,
  onOpenNotifications,
}: {
  ownName: string | null;
  showNameSkeleton: boolean;
  serviceArea: string | null;
  de: boolean;
  onOpenNotifications: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.pad}>
      <View style={styles.introRow}>
        <View style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {timeOfDayGreeting()},
          </Text>
          {showNameSkeleton ? (
            <Skeleton style={styles.skeletonPersonalName} />
          ) : (
            <Text accessibilityRole="header" style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
              {firstName(ownName)}.
            </Text>
          )}
        </View>
        <NotificationBell onPress={onOpenNotifications} testID="customer-home-notifications" />
      </View>
      <View style={styles.serviceAreaRow}>
        <Feather name="map-pin" size={13} color={colors.accentText} />
        <Text style={[styles.serviceArea, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {serviceArea ?? (de ? 'Deine Stadt' : 'Your city')}
        </Text>
      </View>
    </View>
  );
}

export function DiscoverSearch({
  query,
  onQueryChange,
  serviceFilters,
  activeService,
  onServiceChange,
  de,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  serviceFilters: readonly string[];
  activeService: string | null;
  onServiceChange: (service: string | null) => void;
  de: boolean;
}) {
  const { colors, fonts } = useTheme();
  return (
    <>
      <Reveal index={0}>
        <View style={[styles.pad, styles.searchWrap]}>
          <GlassSurface testID="customer-home-search-surface" style={styles.searchBox}>
            <Feather name="search" size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={onQueryChange}
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
                onPress={() => onQueryChange('')}
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
                onPress={() => onServiceChange(selected ? null : service)}
                accessibilityLabel={de ? `Nach ${service} filtern` : `Filter by ${service}`}
              />
            );
          })}
        </ScrollView>
      ) : null}
    </>
  );
}
