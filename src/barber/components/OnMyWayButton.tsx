/**
 * The barber's entry into live arrival sharing, shown on accepted bookings
 * around the appointment time. While a trip for this booking is running it
 * turns into a live status ("Sharing live · 8 min") that reopens the trip.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { radius, space } from '../../theme/spacing';
import { getAppLanguage } from '../../shared/locale';
import { formatEta } from '../../shared/tracking/eta';
import { subscribeToTrip, type LiveTripState } from '../trip/tripService';

export function OnMyWayButton({ bookingId, onPress }: { bookingId: string; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const [live, setLive] = useState<LiveTripState | null>(null);
  useEffect(() => subscribeToTrip((state) => setLive(state?.bookingId === bookingId ? state : null)), [bookingId]);

  const label = !live
    ? de ? 'Ich bin unterwegs' : "I'm on my way"
    : live.arrived
      ? de ? 'Angekommen' : 'Arrived'
      : `${de ? 'Live geteilt' : 'Sharing live'}${live.snapshot ? ` · ${formatEta(live.snapshot.etaS, de)}` : ''}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={de ? 'Teilt deine Ankunft live mit dem Kunden.' : 'Shares your live arrival with the customer.'}
      testID={`barber-on-my-way-${bookingId}`}
      style={({ pressed }) => [
        styles.button,
        live ? { borderColor: colors.accent, borderWidth: 1 } : { backgroundColor: colors.accent },
        { opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <Feather name="navigation" size={16} color={live ? colors.accentText : colors.onAccent} />
      <Text style={[styles.text, { color: live ? colors.accentText : colors.onAccent, fontFamily: fonts.bodySemiBold }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    marginTop: space.md,
  },
  text: { fontSize: 15 },
});
