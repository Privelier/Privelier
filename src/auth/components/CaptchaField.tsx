/**
 * The Turnstile challenge for the auth forms, and the hook that owns its
 * token. Renders nothing while CAPTCHA is off (no site key configured), so
 * the forms behave exactly as before. Tokens are single use: forms call
 * `reset()` after every attempt, which remounts the widget for a new one.
 */
import { useCallback, useState, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { getAppLanguage } from '../../shared/locale';
import { useTheme } from '../../theme/useTheme';
import { CAPTCHA_ORIGIN, CAPTCHA_SITE_KEY, captchaHtml, parseCaptchaMessage } from '../captcha';
import { typeScale } from '../../theme/typography';

export interface CaptchaState {
  /** True when a token must accompany the request. */
  required: boolean;
  /** The current single-use token, or undefined until the challenge passes. */
  token: string | undefined;
  /** Whether the form may be submitted now. */
  ready: boolean;
  /** Ask for a fresh token after an attempt. */
  reset: () => void;
  field: ReactElement | null;
}

export function useCaptcha(testID: string): CaptchaState {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [generation, setGeneration] = useState(0);
  const reset = useCallback(() => {
    setToken(undefined);
    setFailed(false);
    setGeneration((value) => value + 1);
  }, []);
  const onMessage = useCallback((message: ReturnType<typeof parseCaptchaMessage>) => {
    if (!message) return;
    if (message.type === 'token') {
      setFailed(false);
      setToken(message.token);
    } else {
      setToken(undefined);
      setFailed(message.type === 'error');
    }
  }, []);

  if (!CAPTCHA_SITE_KEY) {
    return { required: false, token: undefined, ready: true, reset, field: null };
  }
  return {
    required: true,
    token,
    ready: token !== undefined,
    reset,
    field: <CaptchaField key={generation} siteKey={CAPTCHA_SITE_KEY} failed={failed} onMessage={onMessage} testID={testID} />,
  };
}

function CaptchaField({
  siteKey,
  failed,
  onMessage,
  testID,
}: {
  siteKey: string;
  failed: boolean;
  onMessage: (message: ReturnType<typeof parseCaptchaMessage>) => void;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  return (
    <View style={styles.wrap} testID={testID}>
      <WebView
        source={{ html: captchaHtml(siteKey, de ? 'de' : 'en'), baseUrl: CAPTCHA_ORIGIN }}
        originWhitelist={['https://*']}
        onMessage={(event: WebViewMessageEvent) => onMessage(parseCaptchaMessage(event.nativeEvent.data))}
        javaScriptEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.web}
        containerStyle={styles.web}
        accessibilityLabel={de ? 'Sicherheitsprüfung' : 'Security check'}
      />
      {failed ? (
        <Text style={[styles.error, { color: colors.errorText, fontFamily: fonts.body }]}>
          {de ? 'Die Sicherheitsprüfung konnte nicht geladen werden. Prüfe deine Verbindung.' : 'The security check could not load. Check your connection.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8, alignItems: 'center' },
  web: { width: 310, height: 70, backgroundColor: 'transparent' },
  error: { ...typeScale.secondary, marginTop: 4, textAlign: 'center' },
});
