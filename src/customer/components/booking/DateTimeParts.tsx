/**
 * Pieces of the date-and-time booking step: the inline retry link, the
 * loading skeleton, the "next available" shortcut and the time grid grouped
 * by part of day (chunked choice) with selectable slot chips.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Skeleton } from '../../../shared/components/Skeleton';
import { formatBookingWhen } from '../../../shared/format';
import { haptics } from '../../../shared/haptics';
import { getAppLanguage } from '../../../shared/locale';
import { pressOpacity } from '../../../theme/motion';
import { radius, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';
import type { PeriodKey } from '../../hooks/useBookingSlots';

const PERIOD_LABELS: Record<PeriodKey, { en: string; de: string }> = {
  morning: { en: 'Morning', de: 'Vormittag' },
  afternoon: { en: 'Afternoon', de: 'Nachmittag' },
  evening: { en: 'Evening', de: 'Abend' },
};

export function RetryAvailability({ onPress }: { onPress: () => void }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={de ? 'Verfügbarkeit erneut laden' : 'Retry availability'}
      testID="customer-booking-datetime-retry-inline"
      style={({ pressed }) => [styles.retryLink, pressed ? { opacity: pressOpacity.soft } : null]}
    >
      <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>{de ? 'Erneut versuchen' : 'Try again'}</Text>
    </Pressable>
  );
}

export function DateTimeSkeleton() {
  const de = getAppLanguage() === 'de';
  return (
    <View
      testID="customer-booking-datetime-loading"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={de ? 'Verfügbarkeit wird geladen' : 'Loading availability'}
      style={styles.skeletonWrap}
    >
      <Skeleton style={styles.skeletonLabel} />
      <View style={styles.skeletonDates}>
        {[0, 1, 2, 3].map((index) => <Skeleton key={index} style={styles.skeletonDay} />)}
      </View>
      <Skeleton style={styles.skeletonTimeLabel} />
      <View style={styles.skeletonSlots}>
        {[0, 1, 2, 3, 4, 5].map((index) => <Skeleton key={index} style={styles.skeletonSlot} />)}
      </View>
    </View>
  );
}

export function NextAvailableChip({ date, time, de, onPress }: { date: string; time: string; de: boolean; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  const label = `${de ? 'Nächster freier Termin' : 'Next available'}`;
  return (
    <Pressable
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${formatBookingWhen(date, time)}`}
      testID="customer-booking-datetime-next-available"
      style={({ pressed }) => [styles.nextAvailable, { borderColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={[styles.nextAvailableText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
        {label} · {formatBookingWhen(date, time)}
      </Text>
    </Pressable>
  );
}

function SlotChip({ time, active, onPress }: { time: string; active: boolean; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={time.slice(0, 5)}
      testID={`customer-booking-datetime-slot-${time}`}
      style={({ pressed }) => [
        styles.slotChip,
        {
          borderWidth: active ? 0 : 0.5,
          borderColor: colors.border,
          backgroundColor: active ? colors.accent : colors.surface,
          opacity: pressed && !active ? pressOpacity.soft : 1,
          transform: [{ scale: pressed && !active ? 0.97 : 1 }],
        },
      ]}
    >
      <Text style={[styles.slotText, { color: active ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{time.slice(0, 5)}</Text>
    </Pressable>
  );
}

export function TimeSlotGroups({ groups, selectedTime, de, onSelect }: {
  groups: { key: PeriodKey; slots: string[] }[];
  selectedTime: string | null;
  de: boolean;
  onSelect: (time: string) => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <>
      {groups.map((group) => (
        <View key={group.key} style={styles.timeGroup}>
          <Text style={[styles.periodLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? PERIOD_LABELS[group.key].de : PERIOD_LABELS[group.key].en}
          </Text>
          <View style={styles.slotGrid}>
            {group.slots.map((time) => (
              <SlotChip key={time} time={time} active={selectedTime === time} onPress={() => onSelect(time)} />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  retryLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  skeletonWrap: { marginTop: 28 },
  skeletonLabel: { width: 88, height: 13, marginBottom: 16 },
  skeletonDates: { flexDirection: 'row', gap: 10 },
  skeletonDay: { width: 60, height: 72, borderRadius: radius.lg },
  skeletonTimeLabel: { width: 70, height: 13, marginTop: space['3xl'], marginBottom: 16 },
  skeletonSlots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  skeletonSlot: { width: 72, height: 42, borderRadius: radius.lg },
  nextAvailable: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', borderWidth: 0.5, borderRadius: 999, paddingHorizontal: 14, marginBottom: 14 },
  nextAvailableText: { fontSize: 13 },
  timeGroup: { marginBottom: space.lg },
  periodLabel: { fontSize: 14, lineHeight: 21, marginBottom: 10 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: space.md, minWidth: 80, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  slotText: { fontSize: 16, fontVariant: ['tabular-nums'] },
});
