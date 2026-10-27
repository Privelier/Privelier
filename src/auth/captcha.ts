/**
 * CAPTCHA for sign-up, sign-in, password reset and resending the
 * confirmation link (Cloudflare Turnstile, which Supabase Auth verifies).
 *
 * Off until EXPO_PUBLIC_CAPTCHA_SITE_KEY is set: then the founders also turn
 * CAPTCHA on in Supabase > Authentication > Bot protection with the
 * matching secret (docs/hardening/FOUNDER_ACTIONS.md, F11). Turnstile checks
 * the page's hostname, so EXPO_PUBLIC_CAPTCHA_ORIGIN must be one of the
 * site key's allowed hostnames. Both values are public by design.
 */
export const CAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_CAPTCHA_SITE_KEY?.trim() || null;
export const CAPTCHA_ORIGIN = process.env.EXPO_PUBLIC_CAPTCHA_ORIGIN?.trim() || 'https://privelier.app';

/** Messages the widget page posts back to the app. */
export type CaptchaMessage = { type: 'token'; token: string } | { type: 'expired' } | { type: 'error' };

export function parseCaptchaMessage(raw: string): CaptchaMessage | null {
  try {
    const value = JSON.parse(raw) as Partial<CaptchaMessage> & { token?: unknown };
    if (value.type === 'token' && typeof value.token === 'string' && value.token.length > 0) {
      return { type: 'token', token: value.token };
    }
    if (value.type === 'expired' || value.type === 'error') return { type: value.type };
  } catch {
    // Not a message from the widget page.
  }
  return null;
}

/** A self-contained page that renders one Turnstile widget in the brand's dark theme. */
export function captchaHtml(siteKey: string, language: 'de' | 'en'): string {
  // JSON in a <script> must not be able to close the tag.
  const config = JSON.stringify({ sitekey: siteKey, language }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onLoad&render=explicit" async defer></script>
<style>html,body{margin:0;background:transparent;display:flex;justify-content:center}</style>
</head><body><div id="w"></div><script>
var c=${config};
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function onLoad(){turnstile.render('#w',{sitekey:c.sitekey,theme:'dark',language:c.language,
callback:function(t){post({type:'token',token:t})},
'expired-callback':function(){post({type:'expired'})},
'error-callback':function(){post({type:'error'})}})}
</script></body></html>`;
}
