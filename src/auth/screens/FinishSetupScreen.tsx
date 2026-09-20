/**
 * PROVISIONING 'needs_setup_form' view (Contract A state 4): the session
 * exists but signup metadata was missing or unusable, so we collect the
 * profile fields and submit via ensureProfileFromForm (through the shell's
 * submitSetupForm). Prefilled from the recovered metadata prefill — a hint
 * only, never authorization.
 *
 * Fields: name (required), role limited to customer/barber (required),
 * phone optional, bio optional and shown only when role = barber. The current
 * Nuremberg service area is checked by the root before this form is mounted.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Role } from '../../types';
import type { EnsureProfileResult, ProfilePrefill, SetupFormFields } from '../types';
import { useTheme } from '../../theme/useTheme';
import { radius } from '../../theme/spacing';
import { optionalText, requiredText } from './validation';
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
}

export default function FinishSetupScreen({ prefill, onSubmit, onSignOut }: Props) {
  const [role, setRole] = useState<Role | null>(prefill.role ?? null);
  const [name, setName] = useState(prefill.name ?? '');
  const [phone, setPhone] = useState(prefill.phone ?? '');
  const [bio, setBio] = useState(prefill.bio ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    const errors: FieldErrors = {
      role: role === null ? 'Choose whether you are a customer or a barber.' : undefined,
      name: requiredText(name, 'Enter your name.'),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.role || errors.name || role === null) return;

    setSubmitting(true);
    const result = await onSubmit({
      role,
      name: name.trim(),
      phone: optionalText(phone),
      bio: role === 'barber' ? optionalText(bio) : undefined,
    });
    setSubmitting(false);

    // 'ready' and 'signed_out' unmount this screen via the root switch.
    if (result.status === 'error') {
      setFormError(result.message);
    } else if (result.status === 'needs_setup_form') {
      // Should not occur on the form path; keep the user's input and ask again.
      setFormError('We could not save that. Check the fields and try again.');
    }
  }, [role, name, phone, bio, onSubmit]);

  return (
    <AuthScreenShell testID="setup-screen">
      <ScreenHeading
        title="Finish setting up"
        subtitle="Your location is confirmed in Nuremberg. Add the remaining details to continue."
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
        label="Phone"
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
          helper="A few lines about your craft. You can edit this later."
          testID="setup-bio"
        />
      ) : null}
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

  return (
    <View style={styles.roleField}>
      <Text style={[styles.roleLabel, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
        I am a
      </Text>
      <View style={styles.roleRow}>
        <RoleOption
          label="Customer"
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
