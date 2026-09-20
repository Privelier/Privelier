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

  it('rejects a callback that combines the PKCE and implicit token shapes', () => {
    expect(
      parseAuthCallbackUrl(
        'privelier://auth-callback?code=pkce-code-1#access_token=at-1&refresh_token=rt-1'
      )
    ).toBeNull();
  });

  it('extracts access_token and refresh_token from the fragment', () => {
    const url = 'privelier://auth-callback#access_token=at-1&refresh_token=rt-1&type=signup';
    expect(parseAuthCallbackUrl(url)).toEqual({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      errorCode: undefined,
      type: 'signup',
    });
  });

  it('extracts error_code when the link is expired or already used', () => {
    const url =
      'privelier://auth-callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseAuthCallbackUrl(url)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
      errorCode: 'otp_expired',
      type: undefined,
    });
  });

  it('falls back to the bare error param when error_code is absent', () => {
    const url = 'privelier://auth-callback#error=access_denied';
    expect(parseAuthCallbackUrl(url)?.errorCode).toBe('access_denied');
  });

  it('returns null for a URL with no fragment', () => {
    expect(parseAuthCallbackUrl('privelier://auth-callback')).toBeNull();
  });

  it('returns null for a URL with an empty fragment', () => {
    expect(parseAuthCallbackUrl('privelier://auth-callback#')).toBeNull();
  });

  it('returns null for an unrelated deep link', () => {
    expect(parseAuthCallbackUrl('privelier://some-other-path?foo=bar')).toBeNull();
  });
});

describe('applyAuthCallbackUrl', () => {
  it('returns "ignored" for a non-auth-callback URL', async () => {
    const outcome = await applyAuthCallbackUrl('privelier://some-other-path');
    expect(outcome).toBe('ignored');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it.each([
    'https://auth-callback#access_token=at-1&refresh_token=rt-1',
    'privelier://some-other-path#access_token=at-1&refresh_token=rt-1',
    'privelier://auth-callback/extra#access_token=at-1&refresh_token=rt-1',
    'privelier://auth-callback.evil.example#access_token=at-1&refresh_token=rt-1',
  ])('ignores valid-looking tokens from an unexpected URL: %s', async (url) => {
    const outcome = await applyAuthCallbackUrl(url);

    expect(outcome).toBe('ignored');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('calls setSession with the parsed tokens and returns "applied" on success', async () => {
    mockAuth.setSession.mockResolvedValue({ data: {}, error: null } as never);
    const url = 'privelier://auth-callback#access_token=at-1&refresh_token=rt-1&type=signup';

    const outcome = await applyAuthCallbackUrl(url);

    expect(outcome).toBe('applied');
    expect(mockAuth.setSession).toHaveBeenCalledWith({
      access_token: 'at-1',
      refresh_token: 'rt-1',
    });
  });

  it('exchanges a PKCE code and returns "applied" on success', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null } as never);

    const outcome = await applyAuthCallbackUrl('privelier://auth-callback?code=pkce-code-1');

    expect(outcome).toBe('applied');
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code-1');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('returns "error" when PKCE code exchange fails', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'boom' } } as never);

    await expect(applyAuthCallbackUrl('privelier://auth-callback?code=pkce-code-1')).resolves.toBe(
      'error'
    );
  });

  it('returns "recovery_applied" for a valid password recovery callback', async () => {
    mockAuth.setSession.mockResolvedValue({ data: {}, error: null } as never);
    const outcome = await applyAuthCallbackUrl(
      'privelier://auth-callback#access_token=at-1&refresh_token=rt-1&type=recovery'
    );
    expect(outcome).toBe('recovery_applied');
  });

  it('returns "error" when setSession itself fails', async () => {
    mockAuth.setSession.mockResolvedValue({
      data: {},
      error: { message: 'boom' },
    } as never);
    const url = 'privelier://auth-callback#access_token=at-1&refresh_token=rt-1';

    const outcome = await applyAuthCallbackUrl(url);

    expect(outcome).toBe('error');
  });

  it('returns "expired_or_used" for otp_expired without calling setSession', async () => {
    const url =
      'privelier://auth-callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

    const outcome = await applyAuthCallbackUrl(url);

    expect(outcome).toBe('expired_or_used');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('returns "error" for any other error_code without calling setSession', async () => {
    const url = 'privelier://auth-callback#error=access_denied&error_code=something_else';

    const outcome = await applyAuthCallbackUrl(url);

    expect(outcome).toBe('error');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('returns "ignored" when the fragment has neither tokens nor an error_code', async () => {
    const url = 'privelier://auth-callback#type=signup';

    const outcome = await applyAuthCallbackUrl(url);

    expect(outcome).toBe('ignored');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('returns "error" when only one of access_token/refresh_token is present', async () => {
    const url = 'privelier://auth-callback#access_token=at-1';

    const outcome = await applyAuthCallbackUrl(url);

    expect(outcome).toBe('error');
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });
});
