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
 * - 'conflict' / 'slot_unavailable': the slot is gone — another customer
 *   took an overlapping time (validate_booking_slot's overlap check or the
 *   uq_bookings_barber_slot_active index), or the time passed / the barber
 *   changed availability while the customer was on this screen. Shown inline
 *   (never silently retried), with an explicit "choose another time" action
 *   that pops back to BookingDateTimeScreen; that screen's useFocusEffect
 *   re-fetches busy slots on regaining focus, so the dead slot cannot be
 *   retried blindly.
 * - a generic CustomerDataFailure: its own `.message` is shown inline.
 */
import { useCallback, useRef, useState } from 'react';
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
import { fetchRoomForBooking } from '../inboxData';
import { StatusTimeline } from '../../shared/components/BookingDetails';
import { useToast } from '../../shared/components/ToastProvider';
import { Reveal } from '../../shared/motion';
import type { BookingRow } from '../../types';
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
  // The authoritative inserted row: its price snapshot, id and status drive
  // the success state, so nothing on it is a client-side guess.
  const [created, setCreated] = useState<BookingRow | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const openingChatRef = useRef(false);
  const { showToast } = useToast();
  const [conflict, setConflict] = useState(false);
  // Same-tick double-tap guard: `submitting` only disables the button after
  // the next commit, and a second insert would race the first one.
  const submittingRef = useRef(false);

  const onConfirm = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    void haptics.confirm();
    setSubmitting(true);
    setError(null);
    setConflict(false);
    const result = await insertBooking({ barberId, serviceId: service.id, date, time, location });
    submittingRef.current = false;
    setSubmitting(false);

    if (result.status === 'ok') {
      setCreated(result.booking);
      void haptics.success();
      return;
    }
    if (result.status === 'conflict') {
      void haptics.warning();
      setConflict(true);
      setError(de ? 'Diese Uhrzeit wurde gerade von jemand anderem gebucht. Wähle eine andere Uhrzeit.' : customerDataErrorCopy.conflict);
      return;
    }
    if (result.status === 'slot_unavailable') {
      void haptics.warning();
      setConflict(true);
      setError(de ? 'Diese Uhrzeit ist nicht mehr verfügbar. Wähle eine andere Uhrzeit.' : 'That time is no longer available. Pick another time.');
      return;
    }
    setError(result.message);
  }, [barberId, service.id, date, time, location, de]);

  const onPickAnotherTime = useCallback(() => {
    // Pops exactly Confirm + Location, landing back on the existing
    // BookingDateTime instance and re-focusing it (see that screen's
    // useFocusEffect for the resulting busy-slot refetch).
    navigation.pop(2);
  }, [navigation]);

  const onMessageBarber = useCallback(async () => {
    if (!created || openingChatRef.current) return;
    openingChatRef.current = true;
    setOpeningChat(true);
    const result = await fetchRoomForBooking(created.id);
    openingChatRef.current = false;
    setOpeningChat(false);
    if (result.status !== 'ok' || !result.room) {
      showToast({
        message: result.status === 'ok'
          ? de ? 'Der Chat zu diesem Termin ist nicht verfügbar.' : 'The chat for this appointment is not available.'
          : result.message,
      });
      return;
    }
    // Replace the finished booking flow with Bookings underneath the chat, so
    // Back from the conversation can never re-enter the confirm screen.
    navigation.reset({
      index: 1,
      routes: [
        { name: 'CustomerTabs', params: { screen: 'Bookings' } },
        {
          name: 'Conversation',
          params: {
            room: result.room,
            title: barberName,
            subtitle: [service.name, formatBookingWhen(date, time)].join(' · '),
          },
        },
      ],
    });
  }, [created, navigation, showToast, de, barberName, service.name, date, time]);

  const onViewBookings = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'CustomerTabs', params: { screen: 'Bookings' } }],
    });
  }, [navigation]);

  if (created !== null) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        edges={['top', 'left', 'right']}
        testID="customer-booking-confirm-screen"
      >
        <ScrollView contentContainerStyle={styles.successWrap} testID="customer-booking-confirm-success">
          <Reveal index={0}>
            <View style={[styles.successIconRing, { backgroundColor: colors.surface }]}>
              <Feather name="check-circle" size={36} color={colors.accent} />
            </View>
          </Reveal>
          <Text style={[styles.successTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {de ? 'Termin angefragt' : 'Booking requested'}
          </Text>
          <Text style={[styles.successHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? `Deine Anfrage wurde an ${barberName} gesendet. Dein Barber muss den Termin noch bestätigen.` : `Your request was sent to ${barberName}. Your barber still needs to accept the appointment.`}
          </Text>
          <Reveal index={2}>
            <View style={[styles.summary, styles.successSummary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <SummaryRow label="Barber" value={barberName} />
              <SummaryRow label={de ? 'Leistung' : 'Service'} value={service.name} />
              <SummaryRow label={de ? 'Termin' : 'When'} value={formatBookingWhen(date, time)} />
              <SummaryRow label={de ? 'Adresse' : 'Location'} value={location} />
              <SummaryRow label={de ? 'Preis' : 'Price'} value={formatMoney(created.price)} last />
            </View>
          </Reveal>
          <Reveal index={3}>
            <View style={styles.successTimeline}>
              <StatusTimeline status={created.status} role="customer" />
            </View>
          </Reveal>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={de ? 'Barber schreiben' : 'Message barber'}
            accessibilityState={{ busy: openingChat, disabled: openingChat }}
            disabled={openingChat}
            onPress={() => void onMessageBarber()}
            testID="customer-booking-confirm-message"
            style={({ pressed }) => [styles.secondaryAction, { borderColor: colors.border }, pressed ? { opacity: pressOpacity.soft } : null]}
          >
            <Feather name="message-circle" size={16} color={colors.textPrimary} />
            <Text style={[styles.secondaryActionText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
              {de ? 'Barber schreiben' : 'Message barber'}
            </Text>
          </Pressable>
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
      style={[styles.container, { backgroundColor: 'transparent' }]}
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
          disabled={conflict}
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
