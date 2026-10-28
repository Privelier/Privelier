/**
 * Booking flow — screen 1 of 3: pick a date, then a time.
 *
 * Slot loading, refetch-on-focus and selection reconciliation live in
 * useBookingSlots. Every date in the lookahead is always shown; a date with
 * no open slot is disabled, never hidden. Times are grouped by part of day
 * to chunk choice, and the selection is echoed above the Continue bar so
 * the customer never has to hold it in their head.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Notice } from '../../shared/components/Notice';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { formatBookingWhen } from '../../shared/format';
import { getAppLanguage } from '../../shared/locale';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { BookingStepIndicator } from '../components/BookingStepIndicator';
import CalendarDateStrip from '../components/CalendarDateStrip';
import { DateTimeSkeleton, NextAvailableChip, RetryAvailability, TimeSlotGroups } from '../components/booking/DateTimeParts';
import { useBookingSlots } from '../hooks/useBookingSlots';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookingDateTime'>;

export default function BookingDateTimeScreen({ route, navigation }: Props) {
  const { barberId, barberName, barberImage, service, lookReference } = route.params;
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const slots = useBookingSlots(barberId, service.duration_minutes);
  const { selection, setSelection, unverifiedDates, nextAvailable, error, load } = slots;
  const retry = () => void load();
  const hintStyle = [styles.hintText, { color: colors.textSecondary, fontFamily: fonts.body }];
  const labelStyle = [styles.sectionLabel, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }];

  const onContinue = () => {
    if (!selection.date || !selection.time) return;
    navigation.navigate('BookingLocation', { barberId, barberName, barberImage, service, date: selection.date, time: selection.time, lookReference });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-booking-datetime-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="customer-booking-datetime-back" right={<BookingStepIndicator current={1} />} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {de ? 'Datum und Uhrzeit wählen' : 'Choose a date and time'}
        </Text>
        <Text style={[styles.subheading, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {`${service.name} ${de ? 'bei' : 'with'} ${barberName}`}
        </Text>

        {slots.loading && !slots.hasData ? (
          <DateTimeSkeleton />
        ) : error && !slots.hasData ? (
          <Notice message={error} testID="customer-booking-datetime-error" variant="error" style={styles.noticeSpacing}>
            <RetryAvailability onPress={retry} />
          </Notice>
        ) : slots.allEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="customer-booking-datetime-empty">
              {unverifiedDates.size > 0
                ? de ? 'Verfügbarkeit konnte nicht geprüft werden. Bitte versuche es erneut.' : 'We could not verify availability. Try again before choosing a time.'
                : de ? 'Aktuell keine freien Termine. Schau bald wieder vorbei.' : 'No upcoming availability. Check back soon.'}
            </Text>
            {unverifiedDates.size > 0 ? (
              <PrimaryButton label={de ? 'Erneut versuchen' : 'Try again'} onPress={retry} testID="customer-booking-datetime-retry" />
            ) : null}
          </View>
        ) : (
          <>
            {error ? (
              <Notice message={error} testID="customer-booking-datetime-error" variant="error" style={styles.noticeSpacing}>
                <RetryAvailability onPress={retry} />
              </Notice>
            ) : null}
            {slots.loading ? <Text style={hintStyle} accessibilityLiveRegion="polite">{de ? 'Verfügbarkeit wird geprüft…' : 'Checking availability…'}</Text> : null}
            {unverifiedDates.size > 0 ? (
              <Notice
                message={de ? 'Einige Tage konnten nicht geprüft werden und sind vorübergehend nicht verfügbar.' : 'Some dates could not be verified and are temporarily unavailable.'}
                testID="customer-booking-datetime-partial-error"
                variant="info"
                style={styles.noticeSpacing}
              >
                <RetryAvailability onPress={retry} />
              </Notice>
            ) : null}
            <Text style={labelStyle}>{de ? 'Datum' : 'Date'}</Text>
            {nextAvailable && selection.date !== nextAvailable.date ? (
              <NextAvailableChip date={nextAvailable.date} time={nextAvailable.time} de={de} onPress={() => setSelection(nextAvailable)} />
            ) : null}
            <CalendarDateStrip
              dates={slots.dates}
              disabledDates={slots.disabledDates}
              selectedDate={selection.date}
              onSelectDate={(date) => setSelection({ date, time: null })}
              testIDPrefix="customer-booking-datetime"
              slotCounts={slots.slotCounts}
            />

            <Text style={[labelStyle, styles.timeLabel]}>{de ? 'Uhrzeit' : 'Time'}</Text>
            {!selection.date ? (
              <Text style={hintStyle}>{de ? 'Wähle einen Tag, um freie Uhrzeiten zu sehen.' : 'Pick a date to see available times.'}</Text>
            ) : slots.selectedSlots.length === 0 ? (
              <Text style={hintStyle} testID="customer-booking-datetime-no-times">
                {de ? 'An diesem Tag sind keine Uhrzeiten mehr frei.' : 'No times left on this date.'}
              </Text>
            ) : (
              <TimeSlotGroups
                groups={slots.slotGroups}
                selectedTime={selection.time}
                de={de}
                onSelect={(time) => setSelection((current) => ({ ...current, time }))}
              />
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {slots.canContinue && selection.date && selection.time ? (
          <Text style={[styles.summary, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="customer-booking-datetime-summary">
            {formatBookingWhen(selection.date, selection.time)}
          </Text>
        ) : null}
        <PrimaryButton
          label={de ? 'Adresse angeben' : 'Add your address'}
          onPress={onContinue}
          disabled={!slots.canContinue}
          testID="customer-booking-datetime-continue"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space.xl },
  heading: { fontSize: 30, lineHeight: 38 },
  subheading: { fontSize: 15, lineHeight: 23, marginTop: 8 },
  noticeSpacing: { marginTop: space.xl },
  emptyWrap: { gap: space.base, paddingVertical: space['3xl'] },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  hintText: { fontSize: 13, marginTop: space.base },
  sectionLabel: { fontSize: 14, lineHeight: 21, marginTop: 28, marginBottom: 14 },
  timeLabel: { marginTop: space['2xl'] },
  footer: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: space.lg, borderTopWidth: 0.5 },
  summary: { fontSize: 13, textAlign: 'center', marginBottom: space.md },
});
