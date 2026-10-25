import { useCallback, useRef, useState } from 'react';
import { getAppLanguage } from '../../shared/locale';
import { ActivityIndicator, StyleSheet, View, type TextInputInstance } from 'react-native';
import { updatePassword } from '../authService';
import { signupPasswordError } from './validation';
import { AuthScreenShell, FormTextField, Notice, PrimaryButton, ScreenHeading, TextLink } from './ui';

export default function ResetPasswordScreen({ view, onComplete, onDismiss }: {
  view: 'opening' | 'ready' | 'expired' | 'error';
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const de = getAppLanguage() === 'de';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmationError, setConfirmationError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirmationRef = useRef<TextInputInstance>(null);

  const onSubmit = useCallback(async () => {
    const nextPasswordError = signupPasswordError(password);
    const nextConfirmationError = confirmation !== password ? (de ? 'Die Passwörter stimmen nicht überein.' : 'Passwords do not match.') : undefined;
    setPasswordError(nextPasswordError);
    setConfirmationError(nextConfirmationError);
    if (nextPasswordError || nextConfirmationError) return;
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.status === 'updated') onComplete();
    else setFormError(result.message);
  }, [password, confirmation, onComplete, de]);

  if (view !== 'ready') {
    const opening = view === 'opening';
    return (
      <AuthScreenShell testID="auth-reset-password-link-state">
        <ScreenHeading title={opening ? (de ? 'Link wird geöffnet' : 'Opening your reset link') : (de ? 'Dieser Link kann nicht verwendet werden' : 'This reset link cannot be used')} subtitle={opening ? (de ? 'Der sichere Link wird geprüft.' : 'Verifying the secure link.') : view === 'expired' ? (de ? 'Er ist abgelaufen oder wurde schon verwendet. Fordere auf der Anmeldeseite einen neuen an.' : 'It may have expired or already been used. Request a new link from the login screen.') : (de ? 'Wir konnten den Link nicht prüfen. Fordere auf der Anmeldeseite einen neuen an.' : 'We could not verify this link. Request a new one from the login screen.')} />
        {opening ? <ActivityIndicator testID="auth-reset-password-opening" /> : <TextLink label={de ? 'Zur Anmeldung' : 'Return to login'} onPress={onDismiss} testID="auth-reset-password-dismiss" />}
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell testID="auth-reset-password-screen">
      <ScreenHeading title={de ? 'Neues Passwort wählen' : 'Choose a new password'} subtitle={de ? 'Mindestens acht Zeichen.' : 'Use at least eight characters.'} />
      {formError ? <Notice kind="error" message={formError} testID="auth-reset-password-error" /> : null}
      <FormTextField label={de ? 'Neues Passwort' : 'New password'} value={password} onChangeText={setPassword} error={passwordError} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="next" onSubmitEditing={() => confirmationRef.current?.focus()} blurOnSubmit={false} testID="auth-reset-password-new" />
      <FormTextField label={de ? 'Neues Passwort bestätigen' : 'Confirm new password'} value={confirmation} onChangeText={setConfirmation} error={confirmationError} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" inputRef={confirmationRef} returnKeyType="done" onSubmitEditing={onSubmit} testID="auth-reset-password-confirm" />
      <View style={styles.actions}><PrimaryButton label={de ? 'Neues Passwort speichern' : 'Save new password'} onPress={onSubmit} loading={submitting} testID="auth-reset-password-submit" /></View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({ actions: { marginTop: 8 } });
