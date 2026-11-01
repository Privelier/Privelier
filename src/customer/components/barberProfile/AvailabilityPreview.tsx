/**
 * "Available this week" on the barber profile: the next seven days with real
 * open-slot density, read through the same engine as the booking flow
 * (useBookingSlots) for the barber's shortest service. Tapping a day hands it
 * to the profile, which asks for a service and preselects that day in the
 * booking flow; times are always re-checked there for the chosen service.
 * Nothing renders until availability has loaded, and a failed read stays
 * silent here because the booking flow owns the retry.
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
  const { colors, fonts } = useTheme();
  const slots = useBookingSlots(barberId, durationMinutes);
  if (slots.loading || slots.error || !slots.hasData) return null;

  const dates = slots.dates.slice(0, PREVIEW_DAYS);
  const next = slots.nextAvailable;
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
          disabledDates={slots.disabledDates}
          selectedDate={selectedDate}
          onSelectDate={onPickDate}
          slotCounts={slots.slotCounts}
          testIDPrefix="barber-profile-availability"
        />
      </GlassSurface>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingBottom: 24 },
  card: { paddingVertical: 18, gap: 12 },
  header: { paddingHorizontal: 18, gap: 4 },
});
