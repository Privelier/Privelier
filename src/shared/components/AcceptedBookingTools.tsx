/**
 * Calendar and directions actions shown in the booking detail once a booking
 * is accepted. Each app decides which tools apply: customers get
 * "Add to calendar"; barbers also get "Directions" to the customer address.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { BookingRow } from '../../types';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { addBookingToCalendar, openDirections } from '../bookingActions';
import { getAppLanguage } from '../locale';
import { useToast } from './ToastProvider';

type Props = {
  booking: BookingRow;
  calendarTitle: string;
  showDirections?: boolean;
  testIDPrefix: string;
};

export function AcceptedBookingTools({ booking, calendarTitle, showDirections = false, testIDPrefix }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  if (booking.status !== 'accepted') return null;

  const onCalendar = async () => {
    const result = await addBookingToCalendar(booking, calendarTitle);
    if (result === 'done') showToast({ message: de ? 'Zum Kalender hinzugefügt.' : 'Added to your calendar.' });
    if (result === 'unavailable') showToast({ message: de ? 'Der Kalender ist auf diesem Gerät nicht verfügbar.' : 'The calendar is not available on this device.' });
  };
  const onDirections = async () => {
    const result = await openDirections(booking.location);
    if (result === 'unavailable') showToast({ message: de ? 'Keine Karten-App gefunden.' : 'No maps app is available.' });
  };

  return (
    <View style={styles.row}>
      <ToolButton icon="calendar" label={de ? 'Zum Kalender' : 'Add to calendar'} onPress={() => void onCalendar()} testID={`${testIDPrefix}-calendar`} colors={colors} fonts={fonts} />
      {showDirections ? (
        <ToolButton icon="navigation" label={de ? 'Route' : 'Directions'} onPress={() => void onDirections()} testID={`${testIDPrefix}-directions`} colors={colors} fonts={fonts} />
      ) : null}
    </View>
  );
}

function ToolButton({ icon, label, onPress, testID, colors, fonts }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  testID: string;
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.button, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <Feather name={icon} size={16} color={colors.textPrimary} />
      <Text style={[styles.label, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  button: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: HAIRLINE,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
  },
  label: { fontSize: 14 },
});
