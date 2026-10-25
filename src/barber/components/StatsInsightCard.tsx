/**
 * "Your rhythm" — the barber's own nightly stats (barber_stats, computed by
 * tools/automation/compute_barber_stats.py), turned into three plain facts
 * and one chart:
 *   - how fast they usually reply (and a nudge when it is slow — reply time
 *     is what customers see on their profile),
 *   - their busiest window, so they can open more hours there,
 *   - the share of clients who come back.
 * Hidden entirely until the first nightly run has data.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/spacing';
import { getAppLanguage } from '../../shared/locale';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { AnimatedNumber } from '../../shared/motion/AnimatedNumber';
import { PopularTimesChart, clockLabel } from '../../shared/components/stats/PopularTimesChart';
import { busiestWindow, isFastResponder, WEEKDAYS, type BarberStatsRow } from '../../shared/barberStats';

export function StatsInsightCard({ stats }: { stats: BarberStatsRow }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const window = stats.popular_hours ? busiestWindow(stats.popular_hours) : null;
  const minutes = stats.median_response_minutes;
  const hasAnything = minutes != null || window != null || stats.repeat_client_rate != null;
  if (!hasAnything) return null;

  const days = de ? ['Montags', 'Dienstags', 'Mittwochs', 'Donnerstags', 'Freitags', 'Samstags', 'Sonntags'] : WEEKDAYS.en.map((d) => `${d}s`);

  return (
    <GlassSurface style={styles.card} testID="barber-dashboard-insights">
      <View style={styles.heading}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{de ? 'Dein Rhythmus' : 'Your rhythm'}</Text>
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Was Kunden sehen' : 'What clients notice'}</Text>
        </View>
        <Feather name="trending-up" size={18} color={colors.accentText} />
      </View>

      <View style={styles.facts}>
        {minutes != null ? (
          <Fact
            label={de ? 'Antwortzeit' : 'Reply time'}
            value={<AnimatedNumber value={minutes} format={(v) => `${Math.round(v)} min`} style={[styles.value, { color: colors.textPrimary }]} />}
            note={isFastResponder(minutes)
              ? (de ? 'Schnell — als Badge sichtbar' : 'Fast — shown as a badge')
              : (de ? 'Unter 30 Min. bringt ein Badge' : 'Under 30 min earns a badge')}
            good={isFastResponder(minutes)}
          />
        ) : null}
        {stats.repeat_client_rate != null ? (
          <Fact
            label={de ? 'Stammkunden' : 'Repeat clients'}
            value={<AnimatedNumber value={stats.repeat_client_rate * 100} format={(v) => `${Math.round(v)}%`} style={[styles.value, { color: colors.textPrimary }]} />}
            note={de ? 'kommen wieder' : 'come back'}
          />
        ) : null}
      </View>

      {window && stats.popular_hours ? (
        <View style={[styles.chartBlock, { borderTopColor: colors.border }]}>
          <Text style={[styles.window, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
            {de
              ? `Am gefragtesten: ${days[window.day]}, ${clockLabel(window.start, true)}–${clockLabel(window.end, true)}`
              : `Busiest: ${days[window.day]}, ${clockLabel(window.start, false)}–${clockLabel(window.end, false)}`}
          </Text>
          <Text style={[styles.note, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? 'Öffne dort mehr Zeiten, um mehr Anfragen zu bekommen.' : 'Open more hours there to catch more requests.'}
          </Text>
          <PopularTimesChart grid={stats.popular_hours} testID="barber-dashboard-popular" />
        </View>
      ) : null}
    </GlassSurface>
  );
}

function Fact({ label, value, note, good = false }: { label: string; value: ReactNode; note: string; good?: boolean }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.body }]}>{label}</Text>
      {value}
      <Text style={[styles.note, { color: good ? colors.successText : colors.textSecondary, fontFamily: fonts.body }]}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.base },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: 12, marginBottom: 2 },
  title: { fontSize: 20, lineHeight: 26 },
  facts: { flexDirection: 'row', gap: space.lg },
  fact: { flex: 1, gap: 2 },
  label: { fontSize: 12 },
  value: { fontSize: 26, lineHeight: 32 },
  note: { fontSize: 12, lineHeight: 17 },
  chartBlock: { borderTopWidth: 0.5, paddingTop: space.base, gap: space.xs },
  window: { fontSize: 15, lineHeight: 21 },
});
