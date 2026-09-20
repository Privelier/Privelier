/**
 * Signup (pre-auth shell). One screen for both roles; the role param picks
 * signUpCustomer vs signUpBarber, adds the optional bio field, and adjusts
 * copy (barbers see the manual-verification note).
 *
 * Switches on SignUpResult:
 * - 'confirmation_email_sent' → AwaitEmailConfirmation with the email.
 * - 'email_in_use'            → inline field error + "log in instead" link.
 * - AuthFailure               → weak_password / invalid_email attach to their
 *                               field; everything else is a calm form banner.
 *
 * Password: at least 8 characters enforced client-side (Supabase's default
 * server minimum is 6 — deliberate premium-product decision, see validation.ts).
 */
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signInWithProvider, signUpBarber, signUpCustomer } from '../authService';
import { checkLocationEligibility, type LocationEligibility } from '../../location/locationEligibility';
import { nativeLocationGateway } from '../../location/nativeLocationGateway';
import { LocationAccessNotice } from '../../location/LocationAccessNotice';
import { useTheme } from '../../theme/useTheme';
import type { AuthStackParamList } from './AuthNavigator';
import { emailError, optionalText, requiredText, signupPasswordError, PASSWORD_MIN_LENGTH } from './validation';
import {
  AuthScreenShell,
  BackLink,
  FormTextField,
  Notice,
  OAuthButton,
  PrimaryButton,
  ScreenHeading,
  TextLink,
} from './ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

type BlockedLocation = Exclude<LocationEligibility, { status: 'eligible' }>;

export default function SignupScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const isBarber = role === 'barber';
  const { colors, fonts } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [locationIssue, setLocationIssue] = useState<BlockedLocation | null>(null);
  const [emailInUse, setEmailInUse] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [providerSubmitting, setProviderSubmitting] = useState<'google' | 'apple' | null>(null);
  // Focus chain for the required fields: name → email → password → submit.
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = useCallback(async () => {
    const errors: FieldErrors = {
      name: requiredText(name, 'Enter your name.'),
      email: emailError(email),
      password: signupPasswordError(password),
    };
    setFieldErrors(errors);
    setFormError(null);
    setLocationIssue(null);
    setEmailInUse(false);
    if (errors.name || errors.email || errors.password) return;

    const profileFields = {
      name: name.trim(),
      phone: optionalText(phone),
    };

    setSubmitting(true);
    const location = await checkLocationEligibility(nativeLocationGateway);
    if (location.status !== 'eligible') {
      setLocationIssue(location);
      setSubmitting(false);
      return;
    }
    const result = isBarber
      ? await signUpBarber(email, password, { ...profileFields, bio: optionalText(bio) }, location)
      : await signUpCustomer(email, password, profileFields, location);
    setSubmitting(false);

    switch (result.status) {
      case 'confirmation_email_sent':
        navigation.navigate('AwaitEmailConfirmation', { email: result.email, role });
        break;
      case 'email_in_use':
        setEmailInUse(true);
        setFieldErrors((current) => ({ ...current, email: 'This email is already in use.' }));
        break;
      case 'error':
        if (result.code === 'weak_password') {
          setFieldErrors((current) => ({ ...current, password: result.message }));
        } else if (result.code === 'invalid_email') {
          setFieldErrors((current) => ({ ...current, email: result.message }));
        } else {
          setFormError(result.message);
        }
        break;
    }
  }, [name, email, password, phone, bio, isBarber, navigation, role]);

  const onProviderPress = useCallback(async (provider: 'google' | 'apple') => {
    setFormError(null);
    setLocationIssue(null);
    setProviderSubmitting(provider);
    const location = await checkLocationEligibility(nativeLocationGateway);
    if (location.status !== 'eligible') {
      setLocationIssue(location);
      setProviderSubmitting(null);
      return;
    }
    const result = await signInWithProvider(provider);
    setProviderSubmitting(null);
    if (result.status === 'error') setFormError(result.message);
  }, []);

  return (
    <AuthScreenShell testID="auth-signup-screen">
      <BackLink onPress={() => navigation.goBack()} testID="auth-signup-back" />
      <ScreenHeading
        title="Create an account"
        subtitle={
          isBarber
            ? 'Set up your barber profile and start taking bookings.'
            : 'A private barber, wherever you are.'
        }
      />
      {formError ? <Notice kind="error" message={formError} testID="auth-signup-error" /> : null}
      {locationIssue ? <LocationAccessNotice reason={locationIssue} testID="auth-signup-location-error" /> : null}
      <FormTextField
        label="Name"
        value={name}
        onChangeText={setName}
        error={fieldErrors.name}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        blurOnSubmit={false}
        testID="auth-signup-name"
      />
      <FormTextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        inputRef={emailRef}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        blurOnSubmit={false}
        testID="auth-signup-email"
      />
      {emailInUse ? (
        <View style={styles.loginInstead}>
          <TextLink
            label="Log in instead"
            onPress={() => navigation.navigate('Login', { role })}
            testID="auth-signup-login-instead"
          />
        </View>
      ) : null}
      <FormTextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        helper={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        inputRef={passwordRef}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        testID="auth-signup-password"
      />
      <FormTextField
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        optional
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        testID="auth-signup-phone"
      />
      {isBarber ? (
        <FormTextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          optional
          multiline
          helper="A few lines about your craft. You can edit this later."
          testID="auth-signup-bio"
        />
      ) : null}
      {isBarber ? (
        <Text
          testID="auth-signup-verify-note"
          style={[styles.verifyNote, { color: colors.textSecondary, fontFamily: fonts.body }]}
        >
          Your profile will be verified before you appear in search.
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          label="Create account"
          onPress={onSubmit}
          loading={submitting}
          disabled={providerSubmitting !== null}
          testID="auth-signup-submit"
        />
        <TextLink
          label="Already have an account? Log in"
          onPress={() => navigation.navigate('Login', { role })}
          disabled={submitting}
          testID="auth-signup-go-login"
        />
      </View>
      <View style={styles.providerActions}>
        <OAuthButton provider="google" onPress={() => onProviderPress('google')} loading={providerSubmitting === 'google'} disabled={submitting || providerSubmitting !== null} testID="auth-signup-google" />
        <OAuthButton provider="apple" onPress={() => onProviderPress('apple')} loading={providerSubmitting === 'apple'} disabled={submitting || providerSubmitting !== null} testID="auth-signup-apple" />
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  loginInstead: { alignItems: 'flex-start', marginTop: -12, marginBottom: 12 },
  verifyNote: { fontSize: 13, lineHeight: 19, marginBottom: 20 },
  actions: { marginTop: 8, gap: 8 },
  providerActions: { marginTop: 24, gap: 10 },
});
