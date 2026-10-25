/**
 * Login (pre-auth shell). Switches on SignInResult:
 * - 'signed_in'            → nothing here; the root switch reacts to the
 *                            SIGNED_IN auth event and moves to PROVISIONING.
 * - 'email_not_confirmed'  → route to AwaitEmailConfirmation with that email.
 * - AuthFailure            → calm inline error.
 *
 * Existing accounts must enter through their database-backed role's login.
 */
import { getAppLanguage } from '../../shared/locale';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAppleSignInSupported, signIn, signInWithProvider } from '../authService';
import { LegalLinks } from '../../legal/LegalComponents';
import type { AuthStackParamList } from './AuthNavigator';
import { emailError, loginPasswordError } from './validation';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface FieldErrors {
  email?: string;
  password?: string;
}

function roleMismatchMessage(actualRole: 'customer' | 'barber'): string {
  return actualRole === 'barber'
    ? "Dies ist ein Barber-Konto. Bitte melde dich über 'Als Barber' an."
    : "Dies ist ein Kundenkonto. Bitte melde dich über 'Als Kunde' an.";
}

export default function LoginScreen({ navigation, route }: Props) {
  const de = getAppLanguage() === 'de';
  const { role } = route.params;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [providerSubmitting, setProviderSubmitting] = useState<'google' | 'apple' | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const onSubmit = useCallback(async () => {
    const errors: FieldErrors = {
      email: emailError(email),
      password: loginPasswordError(password),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    const result = await signIn(email, password, role);
    setSubmitting(false);

    switch (result.status) {
      case 'signed_in':
        // Root switch handles the transition via the auth event.
        break;
      case 'role_mismatch':
        navigation.replace('Login', {
          role: result.actualRole,
          mismatchMessage: roleMismatchMessage(result.actualRole),
        });
        break;
      case 'email_not_confirmed':
        navigation.navigate('AwaitEmailConfirmation', { email: result.email, role });
        break;
      case 'error':
        setFormError(result.message);
        break;
    }
  }, [email, password, navigation, role]);

  const onProviderPress = useCallback(async (provider: 'google' | 'apple') => {
    setFormError(null);
    setProviderSubmitting(provider);
    const result = await signInWithProvider(provider, role);
    setProviderSubmitting(null);
    if (result.status === 'error') setFormError(result.message);
    else if (result.status === 'role_mismatch') {
      navigation.replace('Login', {
        role: result.actualRole,
        mismatchMessage: roleMismatchMessage(result.actualRole),
      });
    }
  }, [navigation, role]);

  return (
    <AuthScreenShell testID="auth-login-screen">
      <BackLink onPress={() => navigation.goBack()} testID="auth-login-back" />
      <ScreenHeading
        title={de ? 'Anmelden' : 'Log in'}
        subtitle={
          role === 'barber'
            ? (de ? 'Willkommen zurück. Deine Termine warten.' : 'Welcome back. Your bookings are waiting.')
            : (de ? 'Willkommen zurück.' : 'Welcome back.')
        }
      />
      {route.params.mismatchMessage ? <Notice kind="error" message={route.params.mismatchMessage} testID="auth-login-role-mismatch" /> : null}
      {formError ? <Notice kind="error" message={formError} testID="auth-login-error" /> : null}
      <FormTextField
        label={de ? 'E-Mail' : 'Email'}
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        blurOnSubmit={false}
        testID="auth-login-email"
      />
      <FormTextField
        label={de ? 'Passwort' : 'Password'}
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secure
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        inputRef={passwordRef}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        testID="auth-login-password"
      />
      <View style={styles.actions}>
        <PrimaryButton
          label={de ? 'Anmelden' : 'Log in'}
          onPress={onSubmit}
          loading={submitting}
          disabled={providerSubmitting !== null}
          testID="auth-login-submit"
        />
        <TextLink
          label={de ? 'Passwort vergessen?' : 'Forgot password?'}
          onPress={() => navigation.navigate('ForgotPassword', { role, email })}
          disabled={submitting || providerSubmitting !== null}
          testID="auth-login-forgot-password"
        />
        <TextLink
          label={de ? 'Neu hier? Konto erstellen' : 'New here? Create an account'}
          onPress={() => navigation.navigate('Signup', { role })}
          disabled={submitting}
          testID="auth-login-go-signup"
        />
      </View>
      <View style={styles.providerActions}>
        <OAuthButton provider="google" onPress={() => onProviderPress('google')} loading={providerSubmitting === 'google'} disabled={submitting || providerSubmitting !== null} testID="auth-login-google" />
        {isAppleSignInSupported() ? <OAuthButton provider="apple" onPress={() => onProviderPress('apple')} loading={providerSubmitting === 'apple'} disabled={submitting || providerSubmitting !== null} testID="auth-login-apple" /> : null}
      </View>
      <LegalLinks role={role} testIDPrefix="auth-login-legal" />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: 8, gap: 8 },
  providerActions: { marginTop: 24, gap: 10 },
});
