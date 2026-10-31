/**
 * Customer entry points into live arrival tracking. Both subscribe to the
 * booking's trip row and render NOTHING until the barber actually starts
 * sharing — no empty "tracking unavailable" chrome on every booking.
 *
 *  - LiveTripBanner: the glass "Marco is on the way · 8 min" strip at the top
 *    of Bookings — the first thing a customer sees after a push.
 *  - TrackLiveButton: the same entry inside the booking details sheet.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { numericText, typeScale } from '../../theme/typography';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { getAppLanguage } from '../../shared/locale';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { formatEta } from '../../shared/tracking/eta';
import { useLiveTrip, useTripView } from '../../shared/tracking/tripData';

function useLiveLabel(bookingId: string, barberName: string) {
  const { trip } = useLiveTrip(bookingId);
  const view = useTripView(trip, 15_000);
  const de = getAppLanguage() === 'de';
  if (!view || view.status === 'ended') return null;
  const first = barberName.split(' ')[0] || barberName;
  if (view.status === 'arrived') {
    return { title: de ? `${first} ist da` : `${first} has arrived`, eta: null };
  }
  return {
    title: view.stale ? (de ? `${first} · Signal verloren` : `${first} · signal lost`) : de ? `${first} ist unterwegs` : `${first} is on the way`,
    eta: view.etaS != null && !view.stale ? formatEta(view.etaS, de) : null,
  };
}

export function LiveTripBanner({ bookingId, barberName, onOpen }: { bookingId: string; barberName: string; onOpen: () => void }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const label = useLiveLabel(bookingId, barberName);
  if (!label) return null;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${label.title}${label.eta ? `, ${label.eta}` : ''}. ${de ? 'Live verfolgen' : 'Track live'}`}
      testID={`customer-live-trip-banner-${bookingId}`}
      style={({ pressed }) => [styles.bannerPress, { opacity: pressed ? 0.9 : 1 }]}
    >
      <GlassSurface tone="brass" style={styles.banner}>
        <View style={[styles.iconDisc, { borderColor: colors.accent }]}>
          <Feather name="navigation" size={16} color={colors.accent} />
        </View>
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]} numberOfLines={1}>
            {label.title}
          </Text>
          <Text style={[styles.bannerSub, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? 'Tippen, um live zu verfolgen' : 'Tap to follow live'}
          </Text>
        </View>
        {label.eta ? (
          <Text style={[styles.eta, numericText, { color: colors.accentText, fontFamily: fonts.headingMedium }]}>{label.eta}</Text>
        ) : (
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        )}
      </GlassSurface>
    </Pressable>
  );
}

export function TrackLiveButton({ bookingId, barberName, onOpen }: { bookingId: string; barberName: string; onOpen: () => void }) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const label = useLiveLabel(bookingId, barberName);
  if (!label) return null;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${de ? 'Live verfolgen' : 'Track live'}${label.eta ? `, ${label.eta}` : ''}`}
      testID={`booking-track-live-${bookingId}`}
      style={({ pressed }) => [styles.button, { borderColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
    >
      <Feather name="navigation" size={16} color={colors.accentText} />
      <Text style={[styles.buttonText, { color: colors.accentText, fontFamily: fonts.bodySemiBold }]}>
        {de ? 'Live verfolgen' : 'Track live'}
        {label.eta ? ` · ${label.eta}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bannerPress: { marginBottom: space.md },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg },
  iconDisc: { width: 36, height: 36, borderRadius: 18, borderWidth: HAIRLINE, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1, minWidth: 0 },
  bannerTitle: { fontSize: 15, lineHeight: 21 },
  bannerSub: { ...typeScale.caption },
  eta: { fontSize: 22, lineHeight: 28 },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    marginTop: space.md,
  },
  buttonText: { fontSize: 15 },
});
