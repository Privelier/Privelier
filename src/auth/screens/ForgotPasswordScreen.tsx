import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '../authService';
import type { AuthStackParamList } from './AuthNavigator';
import { emailError } from './validation';
import { AuthScreenShell, BackLink, FormTextField, Notice, PrimaryButton, ScreenHeading, TextLink } from './ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState(route.params.email ?? '');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    const nextError = emailError(email);
    setError(nextError);
    setFormError(null);
    if (nextError) return;
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);
    if (result.status === 'sent') setSent(true);
    else setFormError(result.message);
  }, [email]);

  return (
    <AuthScreenShell testID="auth-forgot-password-screen">
      <BackLink onPress={() => navigation.goBack()} testID="auth-forgot-password-back" />
      <ScreenHeading title="Reset your password" subtitle="We’ll email you a secure link to choose a new password." />
      {sent ? (
        <Notice kind="success" message="Check your inbox for the password reset link." testID="auth-forgot-password-success" />
      ) : null}
      {formError ? <Notice kind="error" message={formError} testID="auth-forgot-password-error" /> : null}
      <FormTextField label="Email" value={email} onChangeText={setEmail} error={error} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={onSubmit} testID="auth-forgot-password-email" />
      <View style={styles.actions}>
        <PrimaryButton label={sent ? 'Send another link' : 'Send reset link'} onPress={onSubmit} loading={submitting} testID="auth-forgot-password-submit" />
        <TextLink label="Back to log in" onPress={() => navigation.navigate('Login', { role: route.params.role })} disabled={submitting} testID="auth-forgot-password-login" />
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({ actions: { marginTop: 8, gap: 8 } });
