/**
 * Booking flow — screen 2 of 3: where the barber should come to.
 *
 * A single free-text field (matches bookings.location, a plain text
 * column) — this product is 100% barber-travels-to-customer, so there is no
 * in-studio/house-call toggle. Prefilled with the signed-in customer's own
 * `city` (fetchOwnProfile, the same pattern StudioScreen uses) as a
 * starting hint only; the field stays fully editable so the customer can
 * expand it to a real address, and city alone is never treated as
 * sufficient on its own.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, space } from '../../theme/spacing';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { BookingStepIndicator } from '../components/BookingStepIndicator';
import { fetchOwnProfile } from '../../auth/authService';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BookingLocation'>;

export default function BookingLocationScreen({ route, navigation }: Props) {
  const { barberId, barberName, service, date, time } = route.params;
  const { colors, fonts } = useTheme();

  const [location, setLocation] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    let active = true;
    // Best-effort city prefill only — never blocks the field from being
    // used, and never overwrites anything the customer has already typed
    // (the functional update below only fills an still-empty field).
    fetchOwnProfile().then((result) => {
      if (!active || result.status !== 'ok' || !result.profile?.city) return;
      const city = result.profile.city;
      setLocation((current) => (current.trim().length === 0 ? city : current));
    });
    return () => {
      active = false;
    };
  }, []);

  const trimmed = location.trim();
  const canContinue = trimmed.length > 0;

  const onContinue = useCallback(() => {
    if (!canContinue) return;
    navigation.navigate('BookingConfirm', {
      barberId,
      barberName,
      service,
      date,
      time,
      location: trimmed,
    });
  }, [navigation, barberId, barberName, service, date, time, trimmed, canContinue]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-booking-location-screen"
    >
      <ScreenBackHeader
        onPress={() => navigation.goBack()}
        backTestID="customer-booking-location-back"
        right={<BookingStepIndicator current={2} />}
      />

      <View style={styles.content}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Where should the barber come to?
        </Text>
        <Text style={[styles.subheading, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          Add the full address so your barber can find you.
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
          Location
        </Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Street, number, city"
          placeholderTextColor={colors.textSecondary}
          multiline
          accessibilityLabel="Location"
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          keyboardAppearance={colors.background === '#121214' ? 'dark' : 'light'}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              borderBottomColor: focused ? colors.accent : colors.border,
              fontFamily: fonts.body,
            },
          ]}
          testID="customer-booking-location-input"
        />
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!canContinue}
          testID="customer-booking-location-continue"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  content: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.base },
  heading: { fontSize: 24 },
  subheading: { fontSize: 13, marginTop: 6, lineHeight: 19 },

  label: { fontSize: 12, marginTop: space['2xl'], marginBottom: 6, letterSpacing: 0.2 },
  input: {
    borderBottomWidth: HAIRLINE,
    paddingVertical: space.md,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 88,
    textAlignVertical: 'top',
  },

  footer: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: space.lg, borderTopWidth: HAIRLINE },
});
