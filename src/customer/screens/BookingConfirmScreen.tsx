/**
 * Booking flow — screen 3 of 3: itemized summary + the real booking write.
 *
 * service.price is a client-side preview only — the authoritative price is
 * stamped server-side at insert time (docs/design/step-11-12-booking-flow-
 * design-approval.md, Section 0). The write and its result arms live in
 * useBookingRequest.
 *
 * On success the customer resets the stack to CustomerTabs → Bookings so
 * back-navigation can never return into a completed booking flow. On a
 * conflict, "choose another time" pops back to BookingDateTime, whose focus
 * effect re-fetches busy slots so the dead slot cannot be retried blindly.
 */
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Notice } from '../../shared/components/Notice';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { useToast } from '../../shared/components/ToastProvider';
import { getAppLanguage } from '../../shared/locale';
import { pressOpacity } from '../../theme/motion';
import { space } from '../../theme/spacing';
import { numericText } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';
import { AddressPinPreview } from '../components/AddressPinPreview';
import { BookingStepIndicator } from '../components/BookingStepIndicator';
import { BookingSuccess, BookingSummary } from '../components/booking/BookingSummary';
import { formatBookingWhen, formatMoney } from '../format';
import { useBookingRequest } from '../hooks/useBookingRequest';
import { useAttachLookReference } from '../hooks/useAttachLookReference';
import { fetchRoomForBooking } from '../inboxData';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookingConfirm'>;

export default function BookingConfirmScreen({ route, navigation }: Props) {
  const { barberId, barberName, barberImage, service, date, time, location, geocodeQuery, lookReference } = route.params;
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const request = useBookingRequest({ serviceId: service.id, date, time, location, geocodeQuery }, de);
  const { created, submitting, error, conflict } = request;
  // Looks S3: a booking made from a look carries it as a reference.
  useAttachLookReference(created, lookReference);
  const [openingChat, setOpeningChat] = useState(false);
  const openingChatRef = useRef(false);
  const details = { barberName, serviceName: service.name, date, time, location };

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
            counterpart: { id: barberId, name: barberName, profile_image: barberImage ?? null },
          },
        },
      ],
    });
  }, [created, navigation, showToast, de, barberId, barberName, barberImage, service.name, date, time]);

  if (created !== null) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-booking-confirm-screen">
        <BookingSuccess
          booking={created}
          details={details}
          de={de}
          openingChat={openingChat}
          onMessage={() => void onMessageBarber()}
          onViewBookings={() => navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs', params: { screen: 'Bookings' } }] })}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-booking-confirm-screen">
      <ScreenBackHeader
        onPress={() => navigation.goBack()}
        backTestID="customer-booking-confirm-back"
        backDisabled={submitting}
        right={<BookingStepIndicator current={3} />}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Deine Anfrage prüfen' : 'Review your request'}</Text>

        {error ? (
          <Notice message={error} testID="customer-booking-confirm-error" variant="error" style={styles.noticeSpacing}>
            {conflict ? (
              <Pressable
                // Pops Confirm + Location, landing back on BookingDateTime.
                onPress={() => navigation.pop(2)}
                accessibilityRole="button"
                accessibilityLabel={de ? 'Andere Uhrzeit wählen' : 'Choose another time'}
                testID="customer-booking-confirm-pick-another-time"
                style={({ pressed }) => [styles.noticeLink, pressed ? { opacity: pressOpacity.soft } : null]}
              >
                <Text style={[styles.noticeLinkText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{de ? 'Andere Uhrzeit wählen' : 'Choose another time'}</Text>
              </Pressable>
            ) : null}
          </Notice>
        ) : null}

        <BookingSummary details={details} de={de} />
        <AddressPinPreview state={request.pin} />

        <View style={[styles.priceRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>{de ? 'Servicepreis' : 'Service price'}</Text>
          <Text style={[styles.priceValue, numericText, { color: colors.textPrimary }]}>{formatMoney(service.price)}</Text>
        </View>
        <Text style={[styles.priceHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {de ? 'Bezahlung direkt beim Barber. Der Preis wird beim Senden der Anfrage bestätigt.' : 'Pay your barber directly. The price is confirmed when your request is sent.'}
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <PrimaryButton
          label={de ? 'Termin anfragen' : 'Request booking'}
          onPress={request.submit}
          loading={submitting}
          disabled={conflict}
          testID="customer-booking-confirm-submit"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  heading: { fontSize: 30, lineHeight: 38 },
  noticeSpacing: { marginTop: space.lg },
  noticeLink: { marginTop: space.sm, minHeight: 44, justifyContent: 'center' },
  noticeLinkText: { fontSize: 13 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTopWidth: 0.5 },
  priceLabel: { fontSize: 13 },
  priceValue: { fontSize: 22 },
  priceHint: { fontSize: 14, marginTop: 8, lineHeight: 21 },
  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, borderTopWidth: 0.5 },
});
