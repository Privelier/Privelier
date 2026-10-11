/**
 * PROVISIONING 'needs_setup_form' view (Contract A state 4): the session
 * exists but signup metadata was missing or unusable, so we collect the
 * profile fields and submit via ensureProfileFromForm (through the shell's
 * submitSetupForm). Prefilled from the recovered metadata prefill — a hint
 * only, never authorization.
 *
 * Fields: name (required), role limited to customer/barber (required),
 * city (required), country/phone optional, bio optional and shown only when
 * role = barber.
 */
import { getAppLanguage } from '../../shared/locale';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Role } from '../../types';
import type { EnsureProfileResult, ProfilePrefill, SetupFormFields } from '../types';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../theme/spacing';
import { optionalText, requiredText } from './validation';
import { LegalConsentFields, LegalLinks } from '../../legal/LegalComponents';
import {
  AuthScreenShell,
  FormTextField,
  Notice,
  PrimaryButton,
  ScreenHeading,
  TextLink,
} from './ui';

interface Props {
  prefill: ProfilePrefill;
  onSubmit: (fields: SetupFormFields) => Promise<EnsureProfileResult>;
  onSignOut: () => void;
}

interface FieldErrors {
  role?: string;
  name?: string;
  city?: string;
}

export default function FinishSetupScreen({ prefill, onSubmit, onSignOut }: Props) {
  const de = getAppLanguage() === 'de';
  const [role, setRole] = useState<Role | null>(prefill.role ?? null);
  const [name, setName] = useState(prefill.name ?? '');
  const [city, setCity] = useState(prefill.city ?? '');
  const [country, setCountry] = useState(prefill.country ?? '');
  const [phone, setPhone] = useState(prefill.phone ?? '');
  const [bio, setBio] = useState(prefill.bio ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [legalAttempted, setLegalAttempted] = useState(false);

  const submit = useCallback(async () => {
    const errors: FieldErrors = {
      role: role === null ? (de ? 'Wähle, ob du Kunde oder Barber bist.' : 'Choose whether you are a customer or a barber.') : undefined,
      name: requiredText(name, de ? 'Gib deinen Namen ein.' : 'Enter your name.'),
      city: requiredText(city, de ? 'Gib deine Stadt ein.' : 'Enter your city.'),
    };
    setFieldErrors(errors);
    setFormError(null);
    setLegalAttempted(true);
    if (errors.role || errors.name || errors.city || role === null || !termsAccepted || !adultConfirmed) return;

    setSubmitting(true);
    const result = await onSubmit({
      legalConsent: true,
      role,
      name: name.trim(),
      city: city.trim(),
      country: optionalText(country),
      phone: optionalText(phone),
      bio: role === 'barber' ? optionalText(bio) : undefined,
    });
    setSubmitting(false);

    // 'ready' and 'signed_out' unmount this screen via the root switch.
    if (result.status === 'error') {
      setFormError(result.message);
    } else if (result.status === 'needs_setup_form') {
      // Should not occur on the form path; keep the user's input and ask again.
      setFormError(de ? 'Das konnte nicht gespeichert werden. Prüfe die Felder und versuch es erneut.' : 'We could not save that. Check the fields and try again.');
    }
  }, [role, name, city, country, phone, bio, onSubmit, termsAccepted, adultConfirmed, de]);

  return (
    <AuthScreenShell testID="setup-screen">
      <ScreenHeading
        title={de ? 'Einrichtung abschließen' : 'Finish setting up'}
        subtitle={de ? 'Noch ein paar Angaben, bevor es weitergeht.' : 'A couple of details before you continue.'}
      />
      {formError ? <Notice kind="error" message={formError} testID="setup-error" /> : null}
      <RoleChoice value={role} onChange={setRole} error={fieldErrors.role} />
      <FormTextField
        label="Name"
        value={name}
        onChangeText={setName}
        error={fieldErrors.name}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        testID="setup-name"
      />
      <FormTextField
        label={de ? 'Stadt' : 'City'}
        value={city}
        onChangeText={setCity}
        error={fieldErrors.city}
        autoCapitalize="words"
        testID="setup-city"
      />
      <FormTextField
        label={de ? 'Land' : 'Country'}
        value={country}
        onChangeText={setCountry}
        optional
        autoCapitalize="words"
        autoComplete="country"
        textContentType="countryName"
        testID="setup-country"
      />
      <FormTextField
        label={de ? 'Telefon' : 'Phone'}
        value={phone}
        onChangeText={setPhone}
        optional
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        testID="setup-phone"
      />
      {role === 'barber' ? (
        <FormTextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          optional
          multiline
          helper={de ? 'Ein paar Zeilen über dein Handwerk. Du kannst das später ändern.' : 'A few lines about your craft. You can edit this later.'}
          testID="setup-bio"
        />
      ) : null}
      <LegalConsentFields
        role={role}
        termsAccepted={termsAccepted}
        adultConfirmed={adultConfirmed}
        onTermsChange={() => setTermsAccepted((current) => !current)}
        onAdultChange={() => setAdultConfirmed((current) => !current)}
        termsError={legalAttempted && !termsAccepted ? (de ? 'Stimme den Bedingungen zu und bestätige die Datenschutzerklärung.' : 'Accept the terms and acknowledge the privacy policy.') : undefined}
        adultError={legalAttempted && !adultConfirmed ? (de ? 'Bitte bestätige, dass du mindestens 18 bist.' : 'You must confirm that you are at least 18.') : undefined}
        testIDPrefix="setup"
      />
      <LegalLinks role={role} testIDPrefix="setup-legal" />
      <View style={styles.actions}>
        <PrimaryButton label="Continue" onPress={submit} loading={submitting} testID="setup-submit" />
        <TextLink label="Log out" onPress={onSignOut} disabled={submitting} testID="setup-sign-out" />
      </View>
    </AuthScreenShell>
  );
}

function RoleChoice({
  value,
  onChange,
  error,
}: {
  value: Role | null;
  onChange: (role: Role) => void;
  error?: string;
}) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';

  return (
    <View style={styles.roleField}>
      <Text style={[styles.roleLabel, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
        {de ? 'Ich bin' : 'I am a'}
      </Text>
      <View style={styles.roleRow}>
        <RoleOption
          label={de ? 'Kunde' : 'Customer'}
          selected={value === 'customer'}
          onPress={() => onChange('customer')}
          testID="setup-role-customer"
        />
        <RoleOption
          label="Barber"
          selected={value === 'barber'}
          onPress={() => onChange('barber')}
          testID="setup-role-barber"
        />
      </View>
      {error ? (
        <Text
          testID="setup-role-error"
          style={[styles.roleError, { color: colors.errorText, fontFamily: fonts.body }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function RoleOption({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, fonts } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      hitSlop={4}
      testID={testID}
      style={({ pressed }) => [
        styles.roleOption,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.roleOptionLabel,
          {
            color: selected ? colors.accentText : colors.textPrimary,
            fontFamily: selected ? fonts.bodySemiBold : fonts.body,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: 8, gap: 8 },
  roleField: { marginBottom: 20 },
  roleLabel: { fontSize: 13, marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleOption: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  roleOptionLabel: { fontSize: 15 },
  roleError: { fontSize: 13, marginTop: 6 },
});
