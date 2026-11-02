/**
 * "Available this week" on the barber profile: the next seven days with real
 * open-slot density, read through the same engine as the booking flow
 * (useBookingSlots) for the barber's shortest service. Tapping a day hands it
 * to the profile, which asks for a service and preselects that day in the
 * booking flow; times are always re-checked there for the chosen service.
 * Nothing renders until availability has loaded, and a failed read stays
 * silent here because the booking flow owns the retry. The view is separate
 * so the dev gallery can show it with sample data.
 */
import { StyleSheet, Text, View } from 'react-native';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { formatBookingWhen } from '../../../shared/format';
import { Reveal } from '../../../shared/motion';
import { typeScale } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import CalendarDateStrip from '../CalendarDateStrip';
import { useBookingSlots } from '../../hooks/useBookingSlots';

const PREVIEW_DAYS = 7;
const CARD_INSET = 18;

export function AvailabilityPreview({
  barberId,
  durationMinutes,
  selectedDate,
  german,
  onPickDate,
}: {
  barberId: string;
  /** The shortest service's duration, so every highlighted day fits at least one service. */
  durationMinutes: number;
  selectedDate: string | null;
  german: boolean;
  onPickDate: (date: string) => void;
}) {
  const slots = useBookingSlots(barberId, durationMinutes);
  if (slots.loading || slots.error || !slots.hasData) return null;
  return (
    <AvailabilityPreviewView
      dates={slots.dates}
      disabledDates={slots.disabledDates}
      slotCounts={slots.slotCounts}
      nextAvailable={slots.nextAvailable}
      selectedDate={selectedDate}
      german={german}
      onPickDate={onPickDate}
    />
  );
}

export function AvailabilityPreviewView({
  dates: lookahead,
  disabledDates,
  slotCounts,
  nextAvailable: next,
  selectedDate,
  german,
  onPickDate,
}: {
  dates: readonly string[];
  disabledDates: ReadonlySet<string>;
  slotCounts: ReadonlyMap<string, number>;
  nextAvailable: { date: string; time: string } | null;
  selectedDate: string | null;
  german: boolean;
  onPickDate: (date: string) => void;
}) {
  const { colors, fonts } = useTheme();
  const dates = lookahead.slice(0, PREVIEW_DAYS);
  const nextLine = next
    ? `${german ? 'Nächster freier Termin' : 'Next free'} · ${formatBookingWhen(next.date, next.time)}`
    : german ? 'In den nächsten zwei Wochen ist nichts frei.' : 'Nothing free in the next two weeks.';

  return (
    <Reveal index={2} style={styles.wrap}>
      <GlassSurface style={styles.card} testID="barber-profile-availability">
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[typeScale.headline, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {german ? 'Diese Woche frei' : 'Available this week'}
          </Text>
          <Text
            style={[typeScale.secondary, { color: next ? colors.accentText : colors.textSecondary, fontFamily: fonts.bodyMedium }]}
            testID="barber-profile-availability-next"
          >
            {nextLine}
          </Text>
        </View>
        <CalendarDateStrip
          dates={dates}
          disabledDates={disabledDates}
          selectedDate={selectedDate}
          onSelectDate={onPickDate}
          slotCounts={slotCounts}
          testIDPrefix="barber-profile-availability"
          inset={CARD_INSET}
        />
      </GlassSurface>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingBottom: 24 },
  card: { paddingVertical: 18, gap: 12 },
  header: { paddingHorizontal: CARD_INSET, gap: 4 },
});
