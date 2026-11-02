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
import { typeScale } from '../../../theme/typography';

interface SummaryDetails {
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  location: string;
  durationMinutes?: number;
}

/** Review-only "Change" links back to the step that owns the value. */
interface SummaryEdits {
  onEditWhen: () => void;
  onEditLocation: () => void;
}

function SummaryRow({ label, value, last = false, onEdit, editText, editLabel, editTestID }: {
  label: string;
  value: string;
  last?: boolean;
  onEdit?: () => void;
  /** Visible link text; editLabel is the fuller screen-reader label. */
  editText?: string;
  editLabel?: string;
  editTestID?: string;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={[styles.row, last ? null : { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.body }]}>{label}</Text>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={editLabel}
            hitSlop={12}
            testID={editTestID}
            style={({ pressed }) => (pressed ? { opacity: pressOpacity.soft } : null)}
          >
            <Text style={[styles.label, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{editText}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.value, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{value}</Text>
    </View>
  );
}

/** Barber, service, time and address; the price row only once it is the server's snapshot. */
export function BookingSummary({ details, price, de, success = false, edits }: {
  details: SummaryDetails;
  price?: number;
  de: boolean;
  success?: boolean;
  edits?: SummaryEdits;
}) {
  const { colors } = useTheme();
  const when = formatBookingWhen(details.date, details.time);
  return (
    <View style={[styles.summary, success && styles.successSummary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <SummaryRow label="Barber" value={details.barberName} />
      <SummaryRow label={de ? 'Leistung' : 'Service'} value={details.serviceName} />
      <SummaryRow
        label={de ? 'Termin' : 'When'}
        value={details.durationMinutes ? `${when} · ${details.durationMinutes} min` : when}
        onEdit={edits?.onEditWhen}
        editText={de ? 'Ändern' : 'Change'}
        editLabel={de ? 'Termin ändern' : 'Change date and time'}
        editTestID="customer-booking-confirm-edit-when"
      />
      <SummaryRow
        label={de ? 'Adresse' : 'Location'}
        value={details.location}
        last={price === undefined}
        onEdit={edits?.onEditLocation}
        editText={de ? 'Ändern' : 'Change'}
        editLabel={de ? 'Adresse ändern' : 'Change address'}
        editTestID="customer-booking-confirm-edit-location"
      />
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13 },
  value: { ...typeScale.bodyLarge },
  successWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  successTitle: { ...typeScale.title1, textAlign: 'center', marginTop: 4 },
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
