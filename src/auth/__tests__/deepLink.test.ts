/**
 * Unit tests for the auth deep-link callback parser + handler
 * (src/auth/deepLink.ts). supabase.auth.setSession is mocked; expo-linking is
 * mocked because createURL needs a real app manifest to resolve the scheme,
 * which is unavailable in the Jest environment.
 */
import { supabase } from '../../../lib/supabase';
import {
  applyAuthCallbackUrl,
  getEmailRedirectTo,
  hasStableAuthRedirect,
  isExpectedAuthCallbackUrl,
  parseAuthCallbackUrl,
} from '../deepLink';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
  },
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `privelier://${path}`),
}));

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getEmailRedirectTo', () => {
  it('builds the auth-callback deep link', () => {
    expect(getEmailRedirectTo()).toBe('privelier://auth-callback');
  });

  it('requires the registered custom scheme rather than Expo Go', () => {
    const createURL = jest.requireMock('expo-linking').createURL as jest.Mock;
    createURL.mockReturnValueOnce('exp://127.0.0.1:8081/--/auth-callback');
    expect(hasStableAuthRedirect()).toBe(false);
  });
});

describe('isExpectedAuthCallbackUrl', () => {
  it.each([
    'privelier://auth-callback',
    'privelier://auth-callback/?source=email',
  ])('accepts the registered callback URL: %s', (url) => {
    expect(isExpectedAuthCallbackUrl(url)).toBe(true);
  });

  it.each([
    'https://auth-callback#access_token=at-1&refresh_token=rt-1',
    'exp://127.0.0.1:8081/--/auth-callback#access_token=at-1&refresh_token=rt-1',
    'privelier://some-other-path#access_token=at-1&refresh_token=rt-1',
    'privelier://auth-callback/extra#access_token=at-1&refresh_token=rt-1',
    'privelier://auth-callback.evil.example#access_token=at-1&refresh_token=rt-1',
    'privelier://auth-callback:443#access_token=at-1&refresh_token=rt-1',
    'privelier://user:password@auth-callback#access_token=at-1&refresh_token=rt-1',
    'not a URL#access_token=at-1&refresh_token=rt-1',
  ])('rejects an unexpected callback origin or path: %s', (url) => {
    expect(isExpectedAuthCallbackUrl(url)).toBe(false);
  });
});

describe('parseAuthCallbackUrl', () => {
  it('extracts a PKCE code from the callback query', () => {
    expect(parseAuthCallbackUrl('privelier://auth-callback?code=pkce-code-1')).toEqual({
      code: 'pkce-code-1',
    });
  });

  it('never returns implicit-flow tokens from a fragment (session substitution)', () => {
    expect(
      parseAuthCallbackUrl('privelier://auth-callback#access_token=at-1&refresh_token=rt-1&type=signup')
    ).toBeNull();
  });

  it('extracts error_code from the fragment when the link is expired or already used', () => {
    const url =
      'privelier://auth-callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseAuthCallbackUrl(url)).toEqual({ errorCode: 'otp_expired' });
  });

  it('extracts error_code from the query (PKCE error redirect)', () => {
    const url = 'privelier://auth-callback?error=access_denied&error_code=otp_expired';
    expect(parseAuthCallbackUrl(url)).toEqual({ errorCode: 'otp_expired' });
  });

  it('falls back to the bare error param when error_code is absent', () => {
    expect(parseAuthCallbackUrl('privelier://auth-callback#error=access_denied')?.errorCode).toBe('access_denied');
  });

  it('returns null for a URL with no code and no error', () => {
    expect(parseAuthCallbackUrl('privelier://auth-callback')).toBeNull();
    expect(parseAuthCallbackUrl('privelier://auth-callback#')).toBeNull();
  });

  it('returns null for an unrelated deep link', () => {
    expect(parseAuthCallbackUrl('privelier://some-other-path?foo=bar')).toBeNull();
  });
});

describe('applyAuthCallbackUrl', () => {
  it('returns "ignored" for a non-auth-callback URL', async () => {
    await expect(applyAuthCallbackUrl('privelier://some-other-path')).resolves.toBe('ignored');
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it.each([
    'privelier://auth-callback#access_token=at-1&refresh_token=rt-1',
    'privelier://auth-callback#access_token=at-1&refresh_token=rt-1&type=recovery',
    'https://auth-callback#access_token=at-1&refresh_token=rt-1',
    'privelier://auth-callback.evil.example#access_token=at-1&refresh_token=rt-1',
  ])('never sets a session from fragment tokens: %s', async (url) => {
    await expect(applyAuthCallbackUrl(url)).resolves.toBe('ignored');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('exchanges a PKCE code and returns "applied" on success', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null } as never);

    await expect(applyAuthCallbackUrl('privelier://auth-callback?code=pkce-code-1')).resolves.toBe('applied');
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code-1');
  });

  it('returns "recovery_applied" when the exchanged code was a password recovery', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { redirectType: 'recovery' }, error: null } as never);

    await expect(applyAuthCallbackUrl('privelier://auth-callback?code=recovery-code')).resolves.toBe(
      'recovery_applied'
    );
  });

  it('exchanges a code once when the same callback arrives twice (Android OAuth race)', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mockAuth.exchangeCodeForSession.mockReturnValue(new Promise((r) => { resolve = r; }) as never);

    const first = applyAuthCallbackUrl('privelier://auth-callback?code=race-code');
    const second = applyAuthCallbackUrl('privelier://auth-callback?code=race-code');
    resolve({ data: {}, error: null });

    await expect(Promise.all([first, second])).resolves.toEqual(['applied', 'applied']);
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    // A late third delivery reuses the settled outcome instead of re-exchanging.
    await expect(applyAuthCallbackUrl('privelier://auth-callback?code=race-code')).resolves.toBe('applied');
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('returns "error" when PKCE code exchange fails', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'boom' } } as never);

    await expect(applyAuthCallbackUrl('privelier://auth-callback?code=bad-code')).resolves.toBe('error');
  });

  it('returns "expired_or_used" for otp_expired without exchanging anything', async () => {
    const url = 'privelier://auth-callback?error=access_denied&error_code=otp_expired&code=ignored';

    await expect(applyAuthCallbackUrl(url)).resolves.toBe('expired_or_used');
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('returns "error" for any other error_code', async () => {
    await expect(
      applyAuthCallbackUrl('privelier://auth-callback#error=access_denied&error_code=something_else')
    ).resolves.toBe('error');
  });
});
