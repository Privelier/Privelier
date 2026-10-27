import { useCallback, useState } from 'react';
import { getAppLanguage } from '../../shared/locale';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '../authService';
import type { AuthStackParamList } from './AuthNavigator';
import { emailError } from './validation';
import { AuthScreenShell, BackLink, FormTextField, Notice, PrimaryButton, ScreenHeading, TextLink } from './ui';
import { useCaptcha } from '../components/CaptchaField';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const de = getAppLanguage() === 'de';
  const [email, setEmail] = useState(route.params.email ?? '');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const captcha = useCaptcha('auth-forgot-password-captcha');

  const onSubmit = useCallback(async () => {
    const nextError = emailError(email);
    setError(nextError);
    setFormError(null);
    if (nextError || !captcha.ready) return;
    setSubmitting(true);
    const result = await requestPasswordReset(email, captcha.token);
    setSubmitting(false);
    captcha.reset();
    if (result.status === 'sent') setSent(true);
    else setFormError(result.message);
  }, [email, captcha]);

  return (
    <AuthScreenShell testID="auth-forgot-password-screen">
      <BackLink onPress={() => navigation.goBack()} testID="auth-forgot-password-back" />
      <ScreenHeading title={de ? 'Passwort zurücksetzen' : 'Reset your password'} subtitle={de ? 'Wir senden dir einen sicheren Link, mit dem du ein neues Passwort wählst.' : 'We’ll email you a secure link to choose a new password.'} />
      {sent ? (
        <Notice kind="success" message={de ? 'Prüfe dein Postfach auf den Link zum Zurücksetzen.' : 'Check your inbox for the password reset link.'} testID="auth-forgot-password-success" />
      ) : null}
      {formError ? <Notice kind="error" message={formError} testID="auth-forgot-password-error" /> : null}
      <FormTextField label={de ? 'E-Mail' : 'Email'} value={email} onChangeText={setEmail} error={error} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={onSubmit} testID="auth-forgot-password-email" />
      {captcha.field}
      <View style={styles.actions}>
        <PrimaryButton label={sent ? (de ? 'Weiteren Link senden' : 'Send another link') : (de ? 'Link senden' : 'Send reset link')} onPress={onSubmit} loading={submitting} disabled={!captcha.ready} testID="auth-forgot-password-submit" />
        <TextLink label={de ? 'Zurück zur Anmeldung' : 'Back to log in'} onPress={() => navigation.navigate('Login', { role: route.params.role })} disabled={submitting} testID="auth-forgot-password-login" />
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({ actions: { marginTop: 8, gap: 8 } });
