import { captchaHtml, parseCaptchaMessage } from '../captcha';

describe('parseCaptchaMessage', () => {
  it('accepts a token, an expiry and an error from the widget page', () => {
    expect(parseCaptchaMessage('{"type":"token","token":"abc"}')).toEqual({ type: 'token', token: 'abc' });
    expect(parseCaptchaMessage('{"type":"expired"}')).toEqual({ type: 'expired' });
    expect(parseCaptchaMessage('{"type":"error"}')).toEqual({ type: 'error' });
  });

  it('ignores anything else', () => {
    expect(parseCaptchaMessage('not json')).toBeNull();
    expect(parseCaptchaMessage('{"type":"token","token":""}')).toBeNull();
    expect(parseCaptchaMessage('{"type":"token","token":42}')).toBeNull();
    expect(parseCaptchaMessage('{"type":"navigate","url":"https://evil.example"}')).toBeNull();
  });
});

describe('captchaHtml', () => {
  it('embeds the site key and language as data the page cannot execute', () => {
    const html = captchaHtml('0x4AAA</script><script>alert(1)</script>', 'de');
    expect(html).toContain('challenges.cloudflare.com/turnstile/v0/api.js');
    expect(html).toContain('"language":"de"');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });
});

describe('useCaptcha without a site key', () => {
  it('is off: nothing renders and forms may submit without a token', () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_CAPTCHA_SITE_KEY;
      jest.doMock('react', () => ({ ...jest.requireActual('react'), useState: (v: unknown) => [v, jest.fn()], useCallback: (f: unknown) => f }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useCaptcha } = require('../components/CaptchaField') as typeof import('../components/CaptchaField');
      const state = useCaptcha('t');
      expect(state).toMatchObject({ required: false, token: undefined, ready: true, field: null });
    });
  });
});
