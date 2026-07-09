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
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
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
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          testID="customer-booking-location-back"
          style={[styles.backButton, { backgroundColor: colors.surface }]}
        >
          <Feather name="arrow-left" size={16} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.stepIndicator}>
          <View style={styles.stepDots}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[styles.stepDot, { backgroundColor: n <= 2 ? colors.accent : colors.border }]}
              />
            ))}
          </View>
          <Text style={[styles.step, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            Step 2 of 3
          </Text>
        </View>
      </View>

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
        <Pressable
          onPress={onContinue}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !canContinue }}
          testID="customer-booking-location-continue"
          style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: canContinue ? 1 : 0.5 }]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
            Continue
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDots: { flexDirection: 'row', gap: 4 },
  stepDot: { width: 12, height: 3, borderRadius: 2 },
  step: { fontSize: 12, letterSpacing: 0.5 },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  heading: { fontSize: 24 },
  subheading: { fontSize: 13, marginTop: 6, lineHeight: 19 },

  label: { fontSize: 12, marginTop: 32, marginBottom: 6, letterSpacing: 0.2 },
  input: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 88,
    textAlignVertical: 'top',
  },

  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, borderTopWidth: 0.5 },
  primaryButton: { borderRadius: 10, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 16 },
});
