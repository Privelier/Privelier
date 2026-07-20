/**
 * AWAIT_EMAIL_CONFIRMATION (Contract A state 3). Post-signup (or after a
 * login attempt on an unconfirmed email) — there is no session yet, so this
 * lives in the pre-auth shell as plain client navigation state. It does NOT
 * persist across restarts: after a restart the user lands back at the
 * pre-auth shell and logs in normally. That is correct.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { resendConfirmation } from '../authService';
import Brandmark from '../../shared/components/Brandmark';
import type { AuthStackParamList } from './AuthNavigator';
import {
  AuthScreenShell,
  Notice,
  PrimaryButton,
  ScreenHeading,
  SecondaryButton,
} from './ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'AwaitEmailConfirmation'>;

type ResendFeedback =
  | { kind: 'none' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export default function AwaitEmailConfirmationScreen({ navigation, route }: Props) {
  const { email, role } = route.params;
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState<ResendFeedback>({ kind: 'none' });

  const onResend = useCallback(async () => {
    setResending(true);
    setFeedback({ kind: 'none' });
    const result = await resendConfirmation(email);
    setResending(false);
    if (result.status === 'sent') {
      setFeedback({ kind: 'success' });
    } else {
      setFeedback({ kind: 'error', message: result.message });
    }
  }, [email]);

  return (
    <AuthScreenShell testID="auth-confirm-screen">
      {/* The one auth screen that earns the mark: a dead-end waiting state
          with no BackLink, where the user is leaving for their inbox. Aligned
          LEFT, not centred — ScreenHeading and everything else in the auth
          shell sit on a left grid, and a centred mark above them would break
          that rhythm. */}
      <Brandmark size="md" style={styles.mark} />
      <ScreenHeading
        title="Check your inbox"
        subtitle={`We’ve sent a confirmation link to ${email}. Open it to activate your account, then log in.`}
      />
      {feedback.kind === 'success' ? (
        <Notice kind="success" message="Confirmation email sent." testID="auth-confirm-success" />
      ) : null}
      {feedback.kind === 'error' ? (
        <Notice kind="error" message={feedback.message} testID="auth-confirm-error" />
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          label="Back to log in"
          onPress={() => navigation.navigate('Login', { role })}
          disabled={resending}
          testID="auth-confirm-back-to-login"
        />
        <SecondaryButton
          label="Send the link again"
          onPress={onResend}
          loading={resending}
          testID="auth-confirm-resend"
        />
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
  // flex-start keeps the mark on the shell's left grid; without it the root
  // View stretches and the mark would centre itself.
  mark: { alignSelf: 'flex-start', marginBottom: 24 },
});
