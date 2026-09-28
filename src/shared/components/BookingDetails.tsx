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
  person: string;
  service: string;
  onClose: () => void;
  children: ReactNode;
};

/** Display stays connected to the parent's realtime row and existing actor-aware actions. */
export function BookingDetails({ booking, person, service, onClose, children }: Props) {
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
          <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {booking.status === 'pending'
              ? de ? 'Dein Barber muss die Anfrage noch bestätigen.' : 'Your barber still needs to accept this request.'
              : booking.status === 'cancelled' || booking.status === 'rejected'
                ? de ? 'Dieser Termin findet nicht statt.' : 'This appointment will not take place.'
                : de ? 'Bezahlung direkt beim Barber.' : 'Pay your barber directly.'}
          </Text>
          <View style={styles.actions}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
});
