/**
 * The itemized booking summary card and the post-request success view.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { StatusTimeline } from '../../../shared/components/BookingDetails';
import { PrimaryButton } from '../../../shared/components/PrimaryButton';
import { Reveal } from '../../../shared/motion';
import { SuccessBurst } from '../../../shared/motion/SuccessBurst';
import { pressOpacity } from '../../../theme/motion';
import { radius, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';
import type { BookingRow } from '../../../types';
import { formatBookingWhen, formatMoney } from '../../format';

interface SummaryDetails {
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  location: string;
}

function SummaryRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[styles.row, last ? null : { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.body }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{value}</Text>
    </View>
  );
}

/** Barber, service, time and address; the price row only once it is the server's snapshot. */
export function BookingSummary({ details, price, de, success = false }: { details: SummaryDetails; price?: number; de: boolean; success?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.summary, success && styles.successSummary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <SummaryRow label="Barber" value={details.barberName} />
      <SummaryRow label={de ? 'Leistung' : 'Service'} value={details.serviceName} />
      <SummaryRow label={de ? 'Termin' : 'When'} value={formatBookingWhen(details.date, details.time)} />
      <SummaryRow label={de ? 'Adresse' : 'Location'} value={details.location} last={price === undefined} />
      {price !== undefined ? <SummaryRow label={de ? 'Preis' : 'Price'} value={formatMoney(price)} last /> : null}
    </View>
  );
}

export function BookingSuccess({ booking, details, de, openingChat, onMessage, onViewBookings }: {
  booking: BookingRow;
  details: SummaryDetails;
  de: boolean;
  openingChat: boolean;
  onMessage: () => void;
  onViewBookings: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.successWrap} testID="customer-booking-confirm-success">
      <Reveal index={0}>
        <SuccessBurst testID="customer-booking-confirm-burst" />
      </Reveal>
      <Text style={[styles.successTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Termin angefragt' : 'Booking requested'}</Text>
      <Text style={[styles.successHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {de
          ? `Deine Anfrage wurde an ${details.barberName} gesendet. Dein Barber muss den Termin noch bestätigen.`
          : `Your request was sent to ${details.barberName}. Your barber still needs to accept the appointment.`}
      </Text>
      <Reveal index={2}>
        <BookingSummary details={details} price={booking.price} de={de} success />
      </Reveal>
      <Reveal index={3}>
        <View style={styles.successTimeline}>
          <StatusTimeline status={booking.status} role="customer" />
        </View>
      </Reveal>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de ? 'Barber schreiben' : 'Message barber'}
        accessibilityState={{ busy: openingChat, disabled: openingChat }}
        disabled={openingChat}
        onPress={onMessage}
        testID="customer-booking-confirm-message"
        style={({ pressed }) => [styles.secondaryAction, { borderColor: colors.border }, pressed ? { opacity: pressOpacity.soft } : null]}
      >
        <Feather name="message-circle" size={16} color={colors.textPrimary} />
        <Text style={[styles.secondaryActionText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Barber schreiben' : 'Message barber'}</Text>
      </Pressable>
      <PrimaryButton label={de ? 'Meine Buchungen' : 'View bookings'} onPress={onViewBookings} testID="customer-booking-confirm-view-bookings" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summary: { borderWidth: 0.5, borderRadius: radius.lg, marginTop: 28 },
  successSummary: { alignSelf: 'stretch', marginTop: 8 },
  row: { gap: space.xs, padding: 16 },
  label: { fontSize: 13 },
  value: { fontSize: 16, lineHeight: 24 },
  successWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  successTitle: { fontSize: 30, lineHeight: 38, textAlign: 'center', marginTop: 4 },
  successHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  successTimeline: { alignSelf: 'stretch', marginBottom: space.lg },
  secondaryAction: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 52,
    borderWidth: 0.5,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  secondaryActionText: { fontSize: 15 },
});
