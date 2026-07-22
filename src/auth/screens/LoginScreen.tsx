/**
 * Login (pre-auth shell). Switches on SignInResult:
 * - 'signed_in'            → nothing here; the root switch reacts to the
 *                            SIGNED_IN auth event and moves to PROVISIONING.
 * - 'email_not_confirmed'  → route to AwaitEmailConfirmation with that email.
 * - AuthFailure            → calm inline error.
 *
 * The role param affects copy only. Routing authority after login is
 * public.users.role — a barber logging in through the customer login still
 * lands in the barber app.
 */
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signIn } from '../authService';
import type { AuthStackParamList } from './AuthNavigator';
import { emailError, loginPasswordError } from './validation';
import {
  AuthScreenShell,
  BackLink,
  FormTextField,
  Notice,
  PrimaryButton,
  ScreenHeading,
  TextLink,
} from './ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = useCallback(async () => {
    const errors: FieldErrors = {
      email: emailError(email),
      password: loginPasswordError(password),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    switch (result.status) {
      case 'signed_in':
        // Root switch handles the transition via the auth event.
        break;
      case 'email_not_confirmed':
        navigation.navigate('AwaitEmailConfirmation', { email: result.email, role });
        break;
      case 'error':
        setFormError(result.message);
        break;
    }
  }, [email, password, navigation, role]);

  return (
    <AuthScreenShell testID="auth-login-screen">
      <BackLink onPress={() => navigation.goBack()} testID="auth-login-back" />
      <ScreenHeading
        title="Log in"
        subtitle={
          role === 'barber'
            ? 'Welcome back. Your bookings are waiting.'
            : 'Welcome back.'
        }
      />
      {formError ? <Notice kind="error" message={formError} testID="auth-login-error" /> : null}
      <FormTextField
        label="Email"
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
        label="Password"
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
          label="Log in"
          onPress={onSubmit}
          loading={submitting}
          testID="auth-login-submit"
        />
        <TextLink
          label="New here? Create an account"
          onPress={() => navigation.navigate('Signup', { role })}
          disabled={submitting}
          testID="auth-login-go-signup"
        />
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: 8, gap: 8 },
});
