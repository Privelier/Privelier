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
 * - 'ok': brief success state, then the customer stack is reset to
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
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { Notice } from '../../shared/components/Notice';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/spacing';
import { insertBooking } from '../bookingCreateData';
import { formatBookingWhen, formatMoney } from '../format';
import { customerDataErrorCopy } from '../errors';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookingConfirm'>;

// Long enough to register as an intentional confirmation, short enough not
// to feel like a stall — matches the "brief success state" spec.
const SUCCESS_PAUSE_MS = 700;

export default function BookingConfirmScreen({ route, navigation }: Props) {
  const { barberId, barberName, service, date, time, location } = route.params;
  const { colors, fonts } = useTheme();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    },
    []
  );

  const onConfirm = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    const result = await insertBooking({ barberId, serviceId: service.id, date, time, location });
    setSubmitting(false);

    if (result.status === 'ok') {
      setSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'CustomerTabs', params: { screen: 'Bookings' } }],
        });
      }, SUCCESS_PAUSE_MS);
      return;
    }
    if (result.status === 'conflict') {
      setError(customerDataErrorCopy.conflict);
      return;
    }
    setError(result.message);
  }, [barberId, service.id, date, time, location, navigation]);

  const onPickAnotherTime = useCallback(() => {
    // Pops exactly Confirm + Location, landing back on the existing
    // BookingDateTime instance and re-focusing it (see that screen's
    // useFocusEffect for the resulting busy-slot refetch).
    navigation.pop(2);
  }, [navigation]);

  if (success) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
        testID="customer-booking-confirm-screen"
      >
        <View style={styles.successWrap} testID="customer-booking-confirm-success">
          <View style={[styles.successIconRing, { backgroundColor: colors.surface }]}>
            <Feather name="check-circle" size={36} color={colors.accent} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            Booking requested
          </Text>
          <Text style={[styles.successHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {`${barberName} will confirm shortly. You'll find it under Bookings.`}
          </Text>
        </View>
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
        right={
          <View style={styles.stepIndicator}>
            <View style={styles.stepDots}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={[styles.stepDot, { backgroundColor: colors.accent }]} />
              ))}
            </View>
            <Text style={[styles.step, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              Step 3 of 3
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Confirm your booking
        </Text>

        {error ? (
          <Notice
            message={error}
            testID="customer-booking-confirm-error"
            variant="error"
            style={styles.noticeSpacing}
          >
            <Pressable
              onPress={onPickAnotherTime}
              accessibilityRole="button"
              accessibilityLabel="Choose another time"
              testID="customer-booking-confirm-pick-another-time"
              style={styles.noticeLink}
            >
              <Text style={[styles.noticeLinkText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                Choose another time
              </Text>
            </Pressable>
          </Notice>
        ) : null}

        <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <SummaryRow label="Barber" value={barberName} />
          <SummaryRow label="Service" value={service.name} />
          <SummaryRow label="When" value={formatBookingWhen(date, time)} />
          <SummaryRow label="Location" value={location} last />
        </View>

        <View style={[styles.priceRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            Estimated total
          </Text>
          <Text style={[styles.priceValue, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {formatMoney(service.price)}
          </Text>
        </View>
        <Text style={[styles.priceHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          This is a summary, not a final charge — Privelier does not process payments yet.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <PrimaryButton
          label="Confirm booking"
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
        numberOfLines={2}
        style={[styles.summaryValue, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDots: { flexDirection: 'row', gap: 4 },
  stepDot: { width: 12, height: 3, borderRadius: 2 },
  step: { fontSize: 12, letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  heading: { fontSize: 24 },

  noticeSpacing: { marginTop: space.lg },
  noticeLink: { marginTop: 8 },
  noticeLinkText: { fontSize: 13 },

  summary: { borderWidth: 0.5, borderRadius: 12, marginTop: 28 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, padding: 14 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 14, flexShrink: 1, textAlign: 'right' },

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
  priceHint: { fontSize: 12, marginTop: 8, lineHeight: 18 },

  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, borderTopWidth: 0.5 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  successIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 22, marginTop: 4 },
  successHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
