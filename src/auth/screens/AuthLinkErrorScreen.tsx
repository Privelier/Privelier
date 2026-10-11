import { getAppLanguage } from '../../shared/locale';
import { AuthScreenShell, ScreenHeading, TextLink } from './ui';

export default function AuthLinkErrorScreen({ view, onDismiss }: {
  view: 'expired' | 'error';
  onDismiss: () => void;
}) {
  const de = getAppLanguage() === 'de';
  const expired = view === 'expired';
  return (
    <AuthScreenShell testID="auth-link-error-screen">
      <ScreenHeading
        title={de ? 'Dieser Link kann nicht verwendet werden' : 'This link cannot be used'}
        subtitle={expired
          ? (de ? 'Er ist abgelaufen oder wurde schon verwendet. Kehre zur Anmeldung zurück und fordere einen neuen Link an.' : 'It may have expired or already been used. Return to login and send a new confirmation or reset link.')
          : (de ? 'Wir konnten diesen Link nicht prüfen. Kehre zur Anmeldung zurück und versuch es erneut.' : 'We could not verify this confirmation or reset link. Return to login and try again.')}
      />
      <TextLink label="Return to login" onPress={onDismiss} testID="auth-link-error-dismiss" />
    </AuthScreenShell>
  );
}
