/**
 * Booking flow — screen 3 of 3: itemized summary + the real booking write.
 *
 * service.price is a client-side preview only — the authoritative price is
 * stamped server-side by a BEFORE INSERT trigger that reads services.price
 * at insert time (see docs/design/step-11-12-booking-flow-design-approval.md,
 * Section 0), so this reads as a summary, not a guaranteed-final total
 * (in practice the two always match, since the trigger reads the same row).
 *
 * insertBooking's three-arm result is handled distinctly:
 * - 'ok': persistent request summary; the user resets the customer stack to
 *   CustomerTabs → Bookings so back-navigation can never return into a
 *   completed booking flow.
 * - 'conflict': the uq_bookings_barber_slot_active index rejected the
 *   insert — a different customer just took this exact slot. Shown inline
 *   (never silently retried), with an explicit "choose another time" action
 *   that pops back to BookingDateTimeScreen; that screen's useFocusEffect
 *   re-fetches busy slots on regaining focus, so the dead slot cannot be
 *   retried blindly.
 * - a generic CustomerDataFailure: its own `.message` is shown inline.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { Notice } from '../../shared/components/Notice';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { getAppLanguage } from '../../shared/locale';
import { haptics } from '../../shared/haptics';
import { useTheme } from '../../theme/useTheme';
import { numericText } from '../../theme/typography';
import { radius, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { BookingStepIndicator } from '../components/BookingStepIndicator';
import { insertBooking } from '../bookingCreateData';
import { formatBookingWhen, formatMoney } from '../format';
import { customerDataErrorCopy } from '../errors';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookingConfirm'>;

// Long enough to register as an intentional confirmation, short enough not
// to feel like a stall — matches the "brief success state" spec.
export default function BookingConfirmScreen({ route, navigation }: Props) {
  const { barberId, barberName, service, date, time, location } = route.params;
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedPrice, setConfirmedPrice] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);

  const onConfirm = useCallback(async () => {
    void haptics.confirm();
    setSubmitting(true);
    setError(null);
    setConflict(false);
    const result = await insertBooking({ barberId, serviceId: service.id, date, time, location });
    setSubmitting(false);

    if (result.status === 'ok') {
      setConfirmedPrice(result.booking.price);
      void haptics.success();
      return;
    }
    if (result.status === 'conflict') {
      setConflict(true);
      setError(customerDataErrorCopy.conflict);
      return;
    }
    setError(result.message);
  }, [barberId, service.id, date, time, location]);

  const onPickAnotherTime = useCallback(() => {
    // Pops exactly Confirm + Location, landing back on the existing
    // BookingDateTime instance and re-focusing it (see that screen's
    // useFocusEffect for the resulting busy-slot refetch).
    navigation.pop(2);
  }, [navigation]);

  const onViewBookings = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CustomerTabs', params: { screen: 'Bookings' } }],
    });
  }, [navigation]);

  if (confirmedPrice !== null) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
        testID="customer-booking-confirm-screen"
      >
        <ScrollView contentContainerStyle={styles.successWrap} testID="customer-booking-confirm-success">
          <View style={[styles.successIconRing, { backgroundColor: colors.surface }]}>
            <Feather name="check-circle" size={36} color={colors.accent} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {de ? 'Termin angefragt' : 'Booking requested'}
          </Text>
          <Text style={[styles.successHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? `Deine Anfrage wurde an ${barberName} gesendet. Dein Barber muss den Termin noch bestätigen.` : `Your request was sent to ${barberName}. Your barber still needs to accept the appointment.`}
          </Text>
          <View style={[styles.summary, styles.successSummary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <SummaryRow label="Barber" value={barberName} />
            <SummaryRow label={de ? 'Leistung' : 'Service'} value={service.name} />
            <SummaryRow label={de ? 'Termin' : 'When'} value={formatBookingWhen(date, time)} />
            <SummaryRow label={de ? 'Adresse' : 'Location'} value={location} />
            <SummaryRow label={de ? 'Preis' : 'Price'} value={formatMoney(confirmedPrice)} last />
          </View>
          <PrimaryButton
            label={de ? 'Meine Buchungen' : 'View bookings'}
            onPress={onViewBookings}
            testID="customer-booking-confirm-view-bookings"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-booking-confirm-screen"
    >
      <ScreenBackHeader
        onPress={() => navigation.goBack()}
        backTestID="customer-booking-confirm-back"
        backDisabled={submitting}
        right={<BookingStepIndicator current={3} />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {de ? 'Deine Anfrage prüfen' : 'Review your request'}
        </Text>

        {error ? (
          <Notice
            message={error}
            testID="customer-booking-confirm-error"
            variant="error"
            style={styles.noticeSpacing}
          >
            {conflict ? (
              <Pressable
                onPress={onPickAnotherTime}
                accessibilityRole="button"
                accessibilityLabel={de ? 'Andere Uhrzeit wählen' : 'Choose another time'}
                testID="customer-booking-confirm-pick-another-time"
                style={({ pressed }) => [styles.noticeLink, pressed ? { opacity: pressOpacity.soft } : null]}
              >
                <Text style={[styles.noticeLinkText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                  {de ? 'Andere Uhrzeit wählen' : 'Choose another time'}
                </Text>
              </Pressable>
            ) : null}
          </Notice>
        ) : null}

        <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <SummaryRow label="Barber" value={barberName} />
          <SummaryRow label={de ? 'Leistung' : 'Service'} value={service.name} />
          <SummaryRow label={de ? 'Termin' : 'When'} value={formatBookingWhen(date, time)} />
          <SummaryRow label={de ? 'Adresse' : 'Location'} value={location} last />
        </View>

        <View style={[styles.priceRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? 'Servicepreis' : 'Service price'}
          </Text>
          <Text style={[styles.priceValue, numericText, { color: colors.textPrimary }]}>
            {formatMoney(service.price)}
          </Text>
        </View>
        <Text style={[styles.priceHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {de ? 'Bezahlung direkt beim Barber. Der Preis wird beim Senden der Anfrage bestätigt.' : 'Pay your barber directly. The price is confirmed when your request is sent.'}
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <PrimaryButton
          label={de ? 'Termin anfragen' : 'Request booking'}
          onPress={onConfirm}
          loading={submitting}
          testID="customer-booking-confirm-submit"
        />
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[styles.summaryRow, last ? null : { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>{label}</Text>
      <Text
        style={[styles.summaryValue, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  heading: { fontSize: 30, lineHeight: 38 },

  noticeSpacing: { marginTop: space.lg },
  noticeLink: { marginTop: space.sm, minHeight: 44, justifyContent: 'center' },
  noticeLinkText: { fontSize: 13 },

  summary: { borderWidth: 0.5, borderRadius: radius.lg, marginTop: 28 },
  summaryRow: { gap: space.xs, padding: 16 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 16, lineHeight: 24 },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 0.5,
  },
  priceLabel: { fontSize: 13 },
  priceValue: { fontSize: 22 },
  priceHint: { fontSize: 14, marginTop: 8, lineHeight: 21 },

  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, borderTopWidth: 0.5 },

  successWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  successSummary: { alignSelf: 'stretch', marginTop: 8 },
  successIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 30, lineHeight: 38, textAlign: 'center', marginTop: 4 },
  successHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
