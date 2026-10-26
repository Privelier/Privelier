/**
 * Signup (pre-auth shell). One screen for both roles; the role param picks
 * signUpCustomer vs signUpBarber, adds the optional bio field, and adjusts
 * copy (barbers see the manual-verification note).
 *
 * Switches on SignUpResult:
 * - 'confirmation_email_sent' → AwaitEmailConfirmation with the email.
 *   (also for an already-registered email, so the form never reveals
 *   which addresses have accounts).
 * - AuthFailure               → weak_password / invalid_email attach to their
 *                               field; everything else is a calm form banner.
 *
 * Password: at least 8 characters enforced client-side (Supabase's default
 * server minimum is 6 — deliberate premium-product decision, see validation.ts).
 */
import { defaultCountry, getAppLanguage } from '../../shared/locale';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAppleSignInSupported, signInWithProvider, signUpBarber, signUpCustomer } from '../authService';
import { LegalConsentFields, LegalLinks } from '../../legal/LegalComponents';
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
  city?: string;
}

export default function SignupScreen({ navigation, route }: Props) {
  const de = getAppLanguage() === 'de';
  const { role } = route.params;
  const isBarber = role === 'barber';
  const { colors, fonts } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState(defaultCountry);
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [providerSubmitting, setProviderSubmitting] = useState<'google' | 'apple' | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [legalAttempted, setLegalAttempted] = useState(false);
  // Focus chain for the required fields: name → email → password → city → submit
  // (optional country/phone/bio are left out of the keyboard chain).
  const nameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const cityRef = useRef<TextInputInstance>(null);

  const onSubmit = useCallback(async () => {
    const errors: FieldErrors = {
      name: requiredText(name, de ? 'Gib deinen Namen ein.' : 'Enter your name.'),
      email: emailError(email),
      password: signupPasswordError(password),
      city: requiredText(city, de ? 'Gib deine Stadt ein.' : 'Enter your city.'),
    };
    setFieldErrors(errors);
    setFormError(null);
    setLegalAttempted(true);
    if (errors.name || errors.email || errors.password || errors.city || !termsAccepted || !adultConfirmed) {
      // The submit button sits below the fold of a long form: take the user
      // to the first problem (focus also scrolls it into view) and tell
      // screen readers how many items need attention.
      const firstInvalid = errors.name ? nameRef : errors.email ? emailRef : errors.password ? passwordRef : errors.city ? cityRef : null;
      firstInvalid?.current?.focus();
      const count = [errors.name, errors.email, errors.password, errors.city].filter(Boolean).length
        + (termsAccepted ? 0 : 1) + (adultConfirmed ? 0 : 1);
      AccessibilityInfo.announceForAccessibility(
        de ? `Bitte prüfe ${count} ${count === 1 ? 'Angabe' : 'Angaben'}.` : `Please check ${count} ${count === 1 ? 'item' : 'items'}.`
      );
      return;
    }

    const profileFields = {
      name: name.trim(),
      city: city.trim(),
      country: optionalText(country),
      phone: optionalText(phone),
    };

    setSubmitting(true);
    const result = isBarber
      ? await signUpBarber(email, password, { ...profileFields, bio: optionalText(bio) })
      : await signUpCustomer(email, password, profileFields);
    setSubmitting(false);

    switch (result.status) {
      case 'confirmation_email_sent':
        navigation.navigate('AwaitEmailConfirmation', { email: result.email, role });
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
  }, [name, email, password, city, country, phone, bio, isBarber, navigation, role, termsAccepted, adultConfirmed, de]);

  const onProviderPress = useCallback(async (provider: 'google' | 'apple') => {
    setFormError(null);
    setProviderSubmitting(provider);
    const result = await signInWithProvider(provider, role);
    setProviderSubmitting(null);
    if (result.status === 'error') setFormError(result.message);
    else if (result.status === 'role_mismatch') {
      navigation.replace('Login', {
        role: result.actualRole,
        mismatchMessage: result.actualRole === 'barber'
          ? "Dies ist ein Barber-Konto. Bitte melde dich über 'Als Barber' an."
          : "Dies ist ein Kundenkonto. Bitte melde dich über 'Als Kunde' an.",
      });
    }
  }, [navigation, role]);

  return (
    <AuthScreenShell testID="auth-signup-screen">
      <BackLink onPress={() => navigation.goBack()} testID="auth-signup-back" />
      <ScreenHeading
        title={de ? 'Konto erstellen' : 'Create an account'}
        subtitle={
          isBarber
            ? (de ? 'Richte dein Barber-Profil ein und nimm Buchungen an.' : 'Set up your barber profile and start taking bookings.')
            : (de ? 'Ein privater Barber, wo immer du bist.' : 'A private barber, wherever you are.')
        }
      />
      {formError ? <Notice kind="error" message={formError} testID="auth-signup-error" /> : null}
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
        inputRef={nameRef}
        testID="auth-signup-name"
      />
      <FormTextField
        label={de ? 'E-Mail' : 'Email'}
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
      <FormTextField
        label={de ? 'Passwort' : 'Password'}
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        helper={de ? `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.` : `At least ${PASSWORD_MIN_LENGTH} characters.`}
        secure
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        inputRef={passwordRef}
        returnKeyType="next"
        onSubmitEditing={() => cityRef.current?.focus()}
        blurOnSubmit={false}
        testID="auth-signup-password"
      />
      <FormTextField
        label={de ? 'Stadt' : 'City'}
        value={city}
        onChangeText={setCity}
        error={fieldErrors.city}
        autoCapitalize="words"
        inputRef={cityRef}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        testID="auth-signup-city"
      />
      <FormTextField
        label={de ? 'Land' : 'Country'}
        value={country}
        onChangeText={setCountry}
        optional
        autoCapitalize="words"
        autoComplete="country"
        textContentType="countryName"
        testID="auth-signup-country"
      />
      <FormTextField
        label={de ? 'Telefon' : 'Phone'}
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
          helper={de ? 'Ein paar Zeilen über dein Handwerk. Du kannst das später ändern.' : 'A few lines about your craft. You can edit this later.'}
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
      <LegalConsentFields
        role={role}
        termsAccepted={termsAccepted}
        adultConfirmed={adultConfirmed}
        onTermsChange={() => setTermsAccepted((current) => !current)}
        onAdultChange={() => setAdultConfirmed((current) => !current)}
        termsError={legalAttempted && !termsAccepted ? (de ? 'Stimme den Bedingungen zu und bestätige die Datenschutzerklärung.' : 'Accept the terms and acknowledge the privacy policy.') : undefined}
        adultError={legalAttempted && !adultConfirmed ? (de ? 'Bitte bestätige, dass du mindestens 18 bist.' : 'You must confirm that you are at least 18.') : undefined}
        testIDPrefix="auth-signup"
      />
      <View style={styles.actions}>
        <PrimaryButton
          label={de ? 'Konto erstellen' : 'Create account'}
          onPress={onSubmit}
          loading={submitting}
          disabled={providerSubmitting !== null}
          testID="auth-signup-submit"
        />
        <TextLink
          label={de ? 'Schon ein Konto? Anmelden' : 'Already have an account? Log in'}
          onPress={() => navigation.navigate('Login', { role })}
          disabled={submitting}
          testID="auth-signup-go-login"
        />
      </View>
      <View style={styles.providerActions}>
        <OAuthButton provider="google" onPress={() => onProviderPress('google')} loading={providerSubmitting === 'google'} disabled={submitting || providerSubmitting !== null} testID="auth-signup-google" />
        {isAppleSignInSupported() ? <OAuthButton provider="apple" onPress={() => onProviderPress('apple')} loading={providerSubmitting === 'apple'} disabled={submitting || providerSubmitting !== null} testID="auth-signup-apple" /> : null}
      </View>
      <LegalLinks role={role} testIDPrefix="auth-signup-legal" />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  verifyNote: { fontSize: 13, lineHeight: 19, marginBottom: 20 },
  actions: { marginTop: 8, gap: 8 },
  providerActions: { marginTop: 24, gap: 10 },
});
