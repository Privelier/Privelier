import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { BookingRow } from '../../types';
import { useTheme } from '../../theme/useTheme';
import { numericText } from '../../theme/typography';
import { formatBookingWhen, formatMoney } from '../format';
import { getAppLanguage } from '../locale';
import { useReducedMotionPreference } from '../motion/useReducedMotionPreference';
import { GlassSurface } from './GlassSurface';
import { StatusPill } from './StatusPill';

type Props = {
  booking: BookingRow;
  /** Whose app is showing the detail — hint copy differs per role. */
  role: 'customer' | 'barber';
  person: string;
  service: string;
  onClose: () => void;
  children: ReactNode;
};

/** Display stays connected to the parent's realtime row and existing actor-aware actions. */
export function BookingDetails({ booking, role, person, service, onClose, children }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const reduceMotion = useReducedMotionPreference();
  return (
    <Modal visible onRequestClose={onClose} presentationStyle="pageSheet" animationType={reduceMotion ? 'fade' : 'slide'}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {de ? 'Dein Termin' : 'Appointment'}
          </Text>
          <Pressable testID="booking-details-close" accessibilityRole="button" accessibilityLabel={de ? 'Details schließen' : 'Close appointment details'} onPress={onClose} style={styles.close}>
            <Feather name="x" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <ScrollView testID="booking-details" contentContainerStyle={styles.content}>
          <StatusPill status={booking.status} testID="booking-details-status" />
          <Text style={[styles.person, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{person}</Text>
          <Text style={[styles.service, { color: colors.textSecondary, fontFamily: fonts.body }]}>{service}</Text>
          <GlassSurface style={styles.summary}>
            <View style={styles.row}>
              <Feather name="calendar" size={20} color={colors.accentText} />
              <Text style={[styles.value, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{formatBookingWhen(booking.date, booking.time)}</Text>
            </View>
            <View style={styles.row}>
              <Feather name="clock" size={20} color={colors.textSecondary} />
              <Text style={[styles.value, numericText, { color: colors.textPrimary }]}>{booking.duration_minutes} min</Text>
            </View>
            <View style={styles.row}>
              <Feather name="map-pin" size={20} color={colors.textSecondary} />
              <Text selectable style={[styles.value, { color: colors.textPrimary, fontFamily: fonts.body }]}>{booking.location}</Text>
            </View>
            <View style={[styles.total, { borderColor: colors.border }]}>
              <Text style={[styles.value, { color: colors.textSecondary, fontFamily: fonts.body }]}>{de ? 'Servicepreis' : 'Service price'}</Text>
              <Text style={[styles.price, numericText, { color: colors.textPrimary }]}>{formatMoney(booking.price)}</Text>
            </View>
          </GlassSurface>
          <StatusTimeline status={booking.status} role={role} />
          <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="booking-details-hint">
            {bookingHint(booking.status, role, de)}
          </Text>
          <View style={styles.actions}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** One truthful next-step line per status and role. */
export function bookingHint(status: BookingRow['status'], role: 'customer' | 'barber', de: boolean): string {
  if (status === 'cancelled' || status === 'rejected') {
    return de ? 'Dieser Termin findet nicht statt.' : 'This appointment will not take place.';
  }
  if (role === 'barber') {
    if (status === 'pending') return de ? 'Nimm die Anfrage an oder lehne sie ab.' : 'Accept or decline this request.';
    return de ? 'Der Kunde bezahlt dich direkt.' : 'The customer pays you directly.';
  }
  if (status === 'pending') return de ? 'Dein Barber muss die Anfrage noch bestätigen.' : 'Your barber still needs to accept this request.';
  return de ? 'Bezahlung direkt beim Barber.' : 'Pay your barber directly.';
}

type Step = { key: string; label: string; state: 'done' | 'current' | 'upcoming' | 'stopped' };

/**
 * Steps derived from the stored status alone. Bookings keep no transition
 * history, so a cancelled booking shows only "Requested → Cancelled": whether
 * it had been accepted first is unknown and is never implied.
 */
export function timelineSteps(status: BookingRow['status'], role: 'customer' | 'barber', de: boolean): Step[] {
  const requested = { key: 'requested', label: de ? 'Angefragt' : 'Requested' };
  const accepted = { key: 'accepted', label: de ? 'Bestätigt' : 'Accepted' };
  const completed = { key: 'completed', label: de ? 'Abgeschlossen' : 'Completed' };
  switch (status) {
    case 'pending':
      return [
        { ...requested, state: 'done' },
        { ...accepted, label: role === 'barber' ? (de ? 'Deine Antwort' : 'Your answer') : accepted.label, state: 'current' },
        { ...completed, state: 'upcoming' },
      ];
    case 'accepted':
      return [{ ...requested, state: 'done' }, { ...accepted, state: 'done' }, { ...completed, state: 'upcoming' }];
    case 'completed':
      return [{ ...requested, state: 'done' }, { ...accepted, state: 'done' }, { ...completed, state: 'done' }];
    case 'rejected':
      return [{ ...requested, state: 'done' }, { key: 'rejected', label: de ? 'Abgelehnt' : 'Declined', state: 'stopped' }];
    case 'cancelled':
      return [{ ...requested, state: 'done' }, { key: 'cancelled', label: de ? 'Storniert' : 'Cancelled', state: 'stopped' }];
  }
}

function StatusTimeline({ status, role }: { status: BookingRow['status']; role: 'customer' | 'barber' }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const steps = timelineSteps(status, role, de);
  const stateLabel: Record<Step['state'], string> = de
    ? { done: 'erledigt', current: 'ausstehend', upcoming: 'noch offen', stopped: 'beendet' }
    : { done: 'done', current: 'waiting', upcoming: 'not yet', stopped: 'ended' };
  return (
    <View
      testID="booking-details-timeline"
      accessible
      accessibilityLabel={steps.map((step) => `${step.label}, ${stateLabel[step.state]}`).join('; ')}
      style={styles.timeline}
    >
      {steps.map((step, index) => {
        const toneOf = (item: Step) =>
          item.state === 'done' ? colors.accent : item.state === 'stopped' ? colors.error : colors.border;
        const tone = toneOf(step);
        const next = steps[index + 1];
        return (
          <View key={step.key} style={styles.step}>
            <View style={styles.stepTrack}>
              <View style={[styles.stepLine, { backgroundColor: index > 0 ? tone : 'transparent' }]} />
              <View
                style={[
                  styles.stepDot,
                  { borderColor: tone, backgroundColor: step.state === 'done' || step.state === 'stopped' ? tone : 'transparent' },
                ]}
              />
              <View style={[styles.stepLine, { backgroundColor: next ? toneOf(next) : 'transparent' }]} />
            </View>
            <Text
              numberOfLines={2}
              style={[
                styles.stepLabel,
                {
                  color: step.state === 'upcoming' ? colors.textSecondary : step.state === 'stopped' ? colors.errorText : colors.textPrimary,
                  fontFamily: step.state === 'current' ? fonts.bodySemiBold : fonts.body,
                },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 24, paddingRight: 12, paddingVertical: 12, gap: 12 },
  title: { fontSize: 26, flex: 1 },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingBottom: 40 },
  person: { fontSize: 32, lineHeight: 40, marginTop: 24 },
  service: { fontSize: 16, lineHeight: 24, marginTop: 8 },
  summary: { padding: 20, marginTop: 28, gap: 22 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  value: { flex: 1, fontSize: 16, lineHeight: 24 },
  total: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderTopWidth: 0.5, paddingTop: 20, alignItems: 'center' },
  price: { fontSize: 24 },
  hint: { fontSize: 14, lineHeight: 21, marginTop: 18 },
  actions: { marginTop: 12 },
  timeline: { flexDirection: 'row', marginTop: 24 },
  step: { flex: 1, minWidth: 0, gap: 8, alignItems: 'center' },
  stepTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: 12 },
  stepLine: { flex: 1, height: 1 },
  stepDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  stepLabel: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 4 },
});
