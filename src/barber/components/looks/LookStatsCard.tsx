/**
 * "Your looks" in the Studio (Looks, flag-gated; LOOKS.md section 6, Screens
 * Barber): per style how many looks clients confirmed and, once enough
 * clients rated, how often the barber hit exactly what was asked (L6, L7).
 * The same numbers clients see on a look; nothing else. Hidden until it
 * loaded, and on failure.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../../../lib/supabase';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { fetchBarberLookStats } from '../../../looks/looksData';
import type { BarberLookStat } from '../../../looks/types';
import { HAIRLINE, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

export function LookStatsCard({ de }: { de: boolean }) {
  const { colors, fonts } = useTheme();
  const [stats, setStats] = useState<BarberLookStat[] | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const barberId = data.session?.user.id;
      if (!barberId) return;
      const result = await fetchBarberLookStats(barberId);
      if (active && result.status === 'ok') setStats(result.value);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!stats) return null;
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };

  return (
    <GlassSurface style={styles.card} testID="barber-dashboard-looks">
      <View style={styles.heading}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{de ? 'Deine Looks' : 'Your looks'}</Text>
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Bewiesen bei echten Kunden' : 'Proven with real clients'}</Text>
        </View>
        <Feather name="scissors" size={18} color={colors.accentText} />
      </View>
      {stats.length === 0 ? (
        <Text style={[styles.note, muted]}>
          {de
            ? 'Halte nach einem abgeschlossenen Termin das Ergebnis fest. Bestätigte Looks bringen dich in Suche und Feed nach oben.'
            : 'Capture the result after a completed appointment. Confirmed looks move you up in search and the feed.'}
        </Text>
      ) : (
        stats.map((stat) => (
          <View key={stat.style} style={[styles.row, { borderTopColor: colors.border }]} testID={`barber-dashboard-looks-${stat.style}`}>
            <View style={styles.flex}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 15 }}>{de ? stat.label_de : stat.label_en}</Text>
              <Text style={[styles.note, muted]}>{de ? `${stat.proof_count} bestätigt` : `${stat.proof_count} confirmed`}</Text>
            </View>
            <Text style={[styles.rate, { color: stat.hit_rate === null ? colors.textSecondary : colors.textPrimary, fontFamily: stat.hit_rate === null ? fonts.body : fonts.bodySemiBold }]}>
              {stat.hit_rate === null
                ? (de ? 'Quote folgt' : 'Rate to come')
                : (de ? `${Math.round(stat.hit_rate * 100)} % genau (${stat.feedback_count})` : `${Math.round(stat.hit_rate * 100)}% exact (${stat.feedback_count})`)}
            </Text>
          </View>
        ))
      )}
      {stats.some((stat) => stat.hit_rate === null) ? (
        <Text style={[styles.note, muted]}>{de ? 'Die Quote erscheint, sobald genug Kunden bewertet haben.' : 'The rate appears once enough clients have rated.'}</Text>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: 12, marginBottom: 2 },
  title: { fontSize: 20, lineHeight: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: HAIRLINE, paddingTop: space.md },
  flex: { flex: 1 },
  rate: { fontSize: 14 },
  note: { fontSize: 12, lineHeight: 17 },
});
