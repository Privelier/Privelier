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
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [unit, setUnit] = useState('');
  const [instructions, setInstructions] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [touched, setTouched] = useState({ street: false, city: false });

  useEffect(() => {
    let active = true;
    // Best-effort city prefill only — never blocks the field from being
    // used, and never overwrites anything the customer has already typed
    // (the functional update below only fills an still-empty field).
    fetchOwnProfile().then((result) => {
      if (!active || result.status !== 'ok' || !result.profile?.city) return;
      const city = result.profile.city;
      setCity((current) => (current.trim().length === 0 ? city : current));
    });
    return () => {
      active = false;
    };
  }, []);

  const trimmedStreet = street.trim();
  const trimmedCity = city.trim();
  const canContinue = trimmedStreet.length >= 5 && trimmedCity.length >= 2;
  const streetError = touched.street && trimmedStreet.length < 5;
  const cityError = touched.city && trimmedCity.length < 2;
  const location = [trimmedStreet, unit.trim(), trimmedCity, instructions.trim()].filter(Boolean).join(', ');

  const onContinue = useCallback(() => {
    if (!canContinue) return;
    navigation.navigate('BookingConfirm', {
      barberId,
      barberName,
      service,
      date,
      time,
      location,
    });
  }, [navigation, barberId, barberName, service, date, time, location, canContinue]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
      testID="customer-booking-location-screen"
    >
      <ScreenBackHeader
        onPress={() => navigation.goBack()}
        backTestID="customer-booking-location-back"
        right={<BookingStepIndicator current={2} />}
      />

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Where should the barber come to?
        </Text>
        <Text style={[styles.subheading, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          Add the full address so your barber can find you.
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
          Street and building
        </Text>
        <TextInput
          value={street}
          onChangeText={setStreet}
          onFocus={() => setFocused('street')}
          onBlur={() => { setFocused(null); setTouched((current) => ({ ...current, street: true })); }}
          placeholder="Street and building number"
          placeholderTextColor={colors.textSecondary}
          multiline
          accessibilityLabel="Street and building"
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          keyboardAppearance={colors.background === '#121214' ? 'dark' : 'light'}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              borderBottomColor: focused === 'street' ? colors.accent : colors.border,
              fontFamily: fonts.body,
            },
          ]}
          testID="customer-booking-location-input"
        />
          {streetError ? (
            <Text style={[styles.validation, { color: colors.errorText, fontFamily: fonts.body }]} accessibilityRole="alert" testID="customer-booking-location-street-error">
              Add the street and building number.
            </Text>
          ) : null}
          <AddressField label="City" value={city} onChangeText={setCity} focused={focused === 'city'} onFocus={() => setFocused('city')} onBlur={() => { setFocused(null); setTouched((current) => ({ ...current, city: true })); }} testID="customer-booking-location-city" />
          {cityError ? (
            <Text style={[styles.validation, { color: colors.errorText, fontFamily: fonts.body }]} accessibilityRole="alert" testID="customer-booking-location-city-error">
              Add your city.
            </Text>
          ) : null}
          <AddressField label="Apartment or unit (optional)" value={unit} onChangeText={setUnit} focused={focused === 'unit'} onFocus={() => setFocused('unit')} onBlur={() => setFocused(null)} testID="customer-booking-location-unit" />
          <AddressField label="Access instructions (optional)" value={instructions} onChangeText={setInstructions} focused={focused === 'instructions'} onFocus={() => setFocused('instructions')} onBlur={() => setFocused(null)} testID="customer-booking-location-instructions" />
        </ScrollView>
      </KeyboardAvoidingView>

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

function AddressField({ label, value, onChangeText, focused, onFocus, onBlur, testID }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        style={[styles.singleInput, { color: colors.textPrimary, borderBottomColor: focused ? colors.accent : colors.border, fontFamily: fonts.body }]}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  content: { flex: 1 },
  scrollContent: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space.xl },
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
  singleInput: { borderBottomWidth: HAIRLINE, paddingVertical: space.md, fontSize: 16, minHeight: 48 },
  validation: { fontSize: 13, lineHeight: 19, marginTop: space.base },

  footer: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: space.lg, borderTopWidth: HAIRLINE },
});
