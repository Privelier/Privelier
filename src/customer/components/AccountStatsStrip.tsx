/**
 * Three quiet numbers under the Account profile row. Hidden until the
 * customer has a completed booking: an all-zero strip is noise, not
 * information.
 */
import { StyleSheet, Text, View } from 'react-native';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { numericText, typeScale } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import type { AccountStats } from '../accountStatsData';

function Stat({ value, label, testID }: { value: string; label: string; testID: string }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`} testID={testID}>
      <Text style={[styles.value, { color: colors.textPrimary }, numericText]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.body }]}>{label}</Text>
    </View>
  );
}

export function AccountStatsStrip({ stats, de }: { stats: AccountStats | null; de: boolean }) {
  const { colors } = useTheme();
  if (!stats || stats.cuts === 0) return null;
  const rating = stats.averageRating === null ? '–' : stats.averageRating.toFixed(1).replace('.', de ? ',' : '.');
  return (
    <View style={[styles.strip, { borderColor: colors.border, backgroundColor: colors.surface }]} testID="customer-account-stats">
      <Stat value={String(stats.cuts)} label={de ? (stats.cuts === 1 ? 'Termin' : 'Termine') : stats.cuts === 1 ? 'cut' : 'cuts'} testID="customer-account-stats-cuts" />
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Stat value={String(stats.barbers)} label={stats.barbers === 1 ? 'Barber' : de ? 'Barber' : 'barbers'} testID="customer-account-stats-barbers" />
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Stat value={rating} label={de ? 'Ø Bewertung' : 'avg rating'} testID="customer-account-stats-rating" />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', borderWidth: HAIRLINE, borderRadius: radius.lg, paddingVertical: space.md, marginTop: space.lg },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  value: { ...typeScale.title3 },
  label: { ...typeScale.caption },
  divider: { width: HAIRLINE, alignSelf: 'stretch' },
});
