import { AuthScreenShell, ScreenHeading, TextLink } from './ui';

export default function AuthLinkErrorScreen({ view, onDismiss }: {
  view: 'expired' | 'error';
  onDismiss: () => void;
}) {
  const expired = view === 'expired';
  return (
    <AuthScreenShell testID="auth-link-error-screen">
      <ScreenHeading
        title="This link cannot be used"
        subtitle={expired
          ? 'It may have expired or already been used. Return to login and send a new confirmation or reset link.'
          : 'We could not verify this confirmation or reset link. Return to login and try again.'}
      />
      <TextLink label="Return to login" onPress={onDismiss} testID="auth-link-error-dismiss" />
    </AuthScreenShell>
  );
}
