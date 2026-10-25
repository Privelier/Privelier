/**
 * DEV-ONLY component gallery (web): open the dev server with `?gallery` to
 * see the motion/UX kit with sample data — no login, no network writes.
 * App.tsx only require()s this behind `__DEV__`, so production bundles
 * dead-code-eliminate it entirely.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/spacing';
import BarberCard from '../customer/components/BarberCard';
import { ResponseBadge } from '../shared/components/stats/ResponseBadge';
import { PopularTimesChart } from '../shared/components/stats/PopularTimesChart';
import { StatsInsightCard } from '../barber/components/StatsInsightCard';
import { QuickActions } from '../barber/components/QuickActions';
import { EmptyState } from '../shared/components/EmptyState';
import { TripStatusPanel } from '../shared/components/trip/TripStatusPanel';
import { GlassSurface } from '../shared/components/GlassSurface';
import { AnimatedNumber } from '../shared/motion/AnimatedNumber';
import { SuccessBurst } from '../shared/motion/SuccessBurst';
import { CelebrationOverlay } from '../shared/motion/CelebrationOverlay';
import { formatMoney } from '../shared/format';
import type { BarberStatsRow } from '../shared/barberStats';
import type { BarberDirectoryRow, ServiceRow } from '../types';

const hourCurve = (peak: number, width: number, scale: number) =>
  Array.from({ length: 24 }, (_, h) => Math.round(scale * Math.exp(-((h - peak) ** 2) / (2 * width ** 2)) * 1000) / 1000);
const GRID = [
  hourCurve(18, 2, 0.45), hourCurve(18, 2, 0.4), hourCurve(17, 2.5, 0.55), hourCurve(18, 2, 0.6),
  hourCurve(17, 3, 0.85), hourCurve(14, 3, 1), hourCurve(13, 2.5, 0.5),
];

const BARBER = {
  id: 'gallery-barber', name: 'Marco Lehmann', city: 'Nürnberg', country: 'Deutschland', profile_image: null,
  bio: null, rating: 4.9, verified: true, display_latitude: null, display_longitude: null,
} as unknown as BarberDirectoryRow;
const SERVICES = [
  { id: 's1', barber_id: BARBER.id, name: 'Signature cut', price: 45, duration_minutes: 45 },
  { id: 's2', barber_id: BARBER.id, name: 'Beard sculpt', price: 25, duration_minutes: 30 },
] as unknown as ServiceRow[];
const STATS: BarberStatsRow = {
  barber_id: BARBER.id, median_response_minutes: 12, response_samples: 31, popular_hours: GRID,
  popular_samples: 120, completed_count: 214, repeat_client_rate: 0.42, computed_at: new Date().toISOString(),
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{title}</Text>
      {children}
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, { borderColor: colors.border }]}>
      <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium }}>{label}</Text>
    </Pressable>
  );
}

export default function ComponentGallery() {
  const { colors, fonts } = useTheme();
  const [burstKey, setBurstKey] = useState(0);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [value, setValue] = useState(1840);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} testID="dev-gallery">
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>Component gallery</Text>

        <Section title="Barber card · reply badge">
          <BarberCard barber={BARBER} services={SERVICES} variant="wide" responseMinutes={12} onPress={() => setCelebration('Pressed')} />
          <View style={styles.row}>
            <ResponseBadge minutes={12} />
            <ResponseBadge minutes={95} />
          </View>
        </Section>

        <Section title="Popular times">
          <GlassSurface style={styles.card}>
            <PopularTimesChart grid={GRID} testID="gallery-popular" />
          </GlassSurface>
        </Section>

        <Section title="Barber dashboard">
          <QuickActions onOpen={() => undefined} />
          <View style={{ height: space.md }} />
          <StatsInsightCard stats={STATS} />
        </Section>

        <Section title="Count-up">
          <AnimatedNumber value={value} format={formatMoney} style={[styles.big, { color: colors.textPrimary }]} />
          <Button label="Change value" onPress={() => setValue((v) => (v === 1840 ? 2675 : 1840))} />
        </Section>

        <Section title="Success moments">
          <View style={styles.center}><SuccessBurst key={burstKey} /></View>
          <View style={styles.row}>
            <Button label="Replay burst" onPress={() => setBurstKey((k) => k + 1)} />
            <Button label="Celebration overlay" onPress={() => setCelebration('Booking accepted')} />
          </View>
        </Section>

        <Section title="Live arrival">
          <GlassSurface style={styles.card}>
            <TripStatusPanel phase="en_route" etaS={8 * 60} remainingM={2400} progress={0.62} caption="Marco is on the way to you" />
          </GlassSurface>
        </Section>

        <Section title="Empty state">
          <EmptyState icon="calendar" title="No upcoming appointments yet." body="Book a barber and it will appear here." />
        </Section>
      </ScrollView>
      <CelebrationOverlay message={celebration} onDone={() => setCelebration(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingBottom: 80, gap: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  heading: { fontSize: 30 },
  section: { gap: space.md },
  title: { fontSize: 13 },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  card: { padding: space.lg },
  big: { fontSize: 40 },
  center: { alignItems: 'center' },
  button: { borderWidth: 0.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
});
