import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type TextInput } from 'react-native';
import { updatePassword } from '../authService';
import { signupPasswordError } from './validation';
import { AuthScreenShell, FormTextField, Notice, PrimaryButton, ScreenHeading, TextLink } from './ui';

export default function ResetPasswordScreen({ view, onComplete, onDismiss }: {
  view: 'opening' | 'ready' | 'expired' | 'error';
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmationError, setConfirmationError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirmationRef = useRef<TextInput>(null);

  const onSubmit = useCallback(async () => {
    const nextPasswordError = signupPasswordError(password);
    const nextConfirmationError = confirmation !== password ? 'Passwords do not match.' : undefined;
    setPasswordError(nextPasswordError);
    setConfirmationError(nextConfirmationError);
    if (nextPasswordError || nextConfirmationError) return;
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.status === 'updated') onComplete();
    else setFormError(result.message);
  }, [password, confirmation, onComplete]);

  if (view !== 'ready') {
    const opening = view === 'opening';
    return (
      <AuthScreenShell testID="auth-reset-password-link-state">
        <ScreenHeading title={opening ? 'Opening your reset link' : 'This reset link cannot be used'} subtitle={opening ? 'Verifying the secure link.' : view === 'expired' ? 'It may have expired or already been used. Request a new link from the login screen.' : 'We could not verify this link. Request a new one from the login screen.'} />
        {opening ? <ActivityIndicator testID="auth-reset-password-opening" /> : <TextLink label="Return to login" onPress={onDismiss} testID="auth-reset-password-dismiss" />}
      </AuthScreenShell>
    );
  }

  return (
    <AuthScreenShell testID="auth-reset-password-screen">
      <ScreenHeading title="Choose a new password" subtitle="Use at least eight characters." />
      {formError ? <Notice kind="error" message={formError} testID="auth-reset-password-error" /> : null}
      <FormTextField label="New password" value={password} onChangeText={setPassword} error={passwordError} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="next" onSubmitEditing={() => confirmationRef.current?.focus()} blurOnSubmit={false} testID="auth-reset-password-new" />
      <FormTextField label="Confirm new password" value={confirmation} onChangeText={setConfirmation} error={confirmationError} secure autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" inputRef={confirmationRef} returnKeyType="done" onSubmitEditing={onSubmit} testID="auth-reset-password-confirm" />
      <View style={styles.actions}><PrimaryButton label="Save new password" onPress={onSubmit} loading={submitting} testID="auth-reset-password-submit" /></View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({ actions: { marginTop: 8 } });
