/**
 * "Up next" on Discover: the customer's soonest live booking, so the home
 * screen answers "when is my barber coming?" before anything else.
 *
 * Every value is server truth from the last bookings read: the status line
 * names the state exactly ("Waiting for {barber}" for pending, "Confirmed"
 * for accepted) and never promises more. The price is the booking's own
 * snapshot, not the live service price. The countdown re-renders on a
 * one-minute tick only while the slot is within a day.
 *
 * Accepted bookings use brass glass (the user's own, settled surface);
 * pending stays neutral so the two never read alike, and each also carries
 * an icon and words so state never rests on colour alone.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { numericText, typeScale } from '../../theme/typography';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { Avatar } from '../../shared/components/Avatar';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { haptics } from '../../shared/haptics';
import { getAppLanguage } from '../../shared/locale';
import { formatMoney } from '../format';
import { formatStartsIn, formatUpNextWhen, type UpNextBooking } from '../discoverPresentation';

type Props = {
  upNext: UpNextBooking;
  onPress: () => void;
};

const MINUTE = 60_000;

/** A clock that ticks once a minute, aligned to the minute boundary. */
function useMinuteClock(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), MINUTE);
    }, MINUTE - (Date.now() % MINUTE));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [active]);
  return now;
}

export function UpNextCard({ upNext, onPress }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { booking, barber, service, laterCount } = upNext;
  const accepted = booking.status === 'accepted';
  const withinADay = formatStartsIn(booking, new Date(), de) !== null;
  const now = useMinuteClock(withinADay);

  const when = formatUpNextWhen(booking, now, de);
  const startsIn = formatStartsIn(booking, now, de);
  const barberName = barber?.name?.trim() || (de ? 'Dein Barber' : 'Your barber');
  const serviceName = service?.name?.trim() || null;
  const status = accepted
    ? de ? 'Bestätigt' : 'Confirmed'
    : de ? `Wartet auf ${barberName}` : `Waiting for ${barberName}`;
  const later =
    laterCount > 0
      ? de
        ? `+${laterCount} weitere${laterCount === 1 ? 'r Termin' : ' Termine'}`
        : `+${laterCount} more ${laterCount === 1 ? 'booking' : 'bookings'}`
      : null;

  const label = [
    de ? 'Nächster Termin' : 'Up next',
    when,
    startsIn,
    serviceName,
    barberName,
    status,
    formatMoney(booking.price),
    later,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={de ? 'Öffnet deine Termine' : 'Opens your bookings'}
      testID="customer-home-up-next"
      style={({ pressed }) => ({ opacity: pressed ? pressOpacity.soft : 1 })}
    >
      <GlassSurface tone={accepted ? 'brass' : 'neutral'} style={styles.card}>
        <View style={styles.topRow}>
          <Text style={[typeScale.caption, styles.eyebrow, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
            {de ? 'Nächster Termin' : 'Up next'}
          </Text>
          {startsIn ? (
            <Text
              style={[typeScale.caption, numericText, { color: colors.textPrimary }]}
              testID="customer-home-up-next-countdown"
            >
              {startsIn}
            </Text>
          ) : null}
        </View>

        <Text
          style={[typeScale.title3, styles.when, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
          testID="customer-home-up-next-when"
        >
          {when}
        </Text>

        <View style={styles.personRow}>
          <Avatar id={booking.barber_id ?? booking.id} name={barberName} imageUrl={barber?.profile_image} size={40} accessible={false} />
          <View style={styles.personText}>
            <Text numberOfLines={1} style={[typeScale.body, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
              {serviceName ?? barberName}
            </Text>
            <Text numberOfLines={1} style={[typeScale.secondary, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              {[serviceName ? barberName : null, `${booking.duration_minutes} min`].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Text style={[typeScale.body, numericText, { color: colors.textPrimary }]}>{formatMoney(booking.price)}</Text>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.status} testID="customer-home-up-next-status">
            <Feather
              name={accepted ? 'check-circle' : 'clock'}
              size={14}
              color={accepted ? colors.successText : colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={[typeScale.secondary, styles.statusText, { color: accepted ? colors.successText : colors.textSecondary, fontFamily: fonts.bodyMedium }]}
            >
              {status}
            </Text>
          </View>
          <View style={styles.status}>
            {later ? (
              <Text style={[typeScale.secondary, { color: colors.textSecondary, fontFamily: fonts.body }]}>{later}</Text>
            ) : null}
            <Feather name="chevron-right" size={16} color={colors.textSecondary} />
          </View>
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, paddingHorizontal: space.base, paddingTop: space.base },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  eyebrow: { letterSpacing: 0.2 },
  when: { marginTop: space.xs },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  personText: { flex: 1, minWidth: 0 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.base,
    minHeight: 44,
    borderTopWidth: HAIRLINE,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  statusText: { flexShrink: 1 },
});
