/**
 * Table-driven tests for the auth error mapping layer (src/auth/errors.ts).
 * Covers every branch of mapAuthApiError / mapPostgrestError, plus the
 * brand-voice rule that authErrorCopy is calm sentence case with no
 * exclamation marks.
 */
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
} from '@supabase/supabase-js';
import {
  authErrorCopy,
  failure,
  mapAuthApiError,
  mapPostgrestError,
  type AuthErrorCode,
} from '../errors';

describe('authErrorCopy (brand voice)', () => {
  it('has no exclamation marks and is sentence case for every code', () => {
    Object.entries(authErrorCopy).forEach(([code, copy]) => {
      expect(copy).not.toMatch(/!/);
      // Sentence case: starts with an uppercase letter, not ALL CAPS/Title Case.
      expect(copy[0]).toMatch(/[A-Z]/);
      expect(copy).not.toMatch(/^[A-Z\s]+$/); // not all-caps
    });
  });
});

describe('failure()', () => {
  it('builds a typed failure with the matching copy and retryable flag', () => {
    const result = failure('network');
    expect(result).toEqual({
      status: 'error',
      code: 'network',
      message: authErrorCopy.network,
      retryable: true,
    });
  });

  it.each<[AuthErrorCode, boolean]>([
    ['network', true],
    ['rate_limited', true],
    ['provisioning_denied', true],
    ['email_in_use', false],
    ['weak_password', false],
    ['invalid_email', false],
    ['invalid_credentials', false],
    ['email_not_confirmed', false],
    ['unknown', false],
  ])('retryable set is correct for %s', (code, retryable) => {
    expect(failure(code).retryable).toBe(retryable);
  });
});

describe('mapAuthApiError', () => {
  it.each<[string, string, AuthErrorCode]>([
    ['user_already_exists', 'Email already registered', 'email_in_use'],
    ['email_exists', 'Email already registered', 'email_in_use'],
    ['weak_password', 'Password too weak', 'weak_password'],
    ['email_address_invalid', 'bad email', 'invalid_email'],
    ['validation_failed', 'bad input', 'invalid_email'],
    ['over_request_rate_limit', 'slow down', 'rate_limited'],
    ['over_email_send_rate_limit', 'slow down', 'rate_limited'],
    ['invalid_credentials', 'nope', 'invalid_credentials'],
    ['email_not_confirmed', 'confirm your email', 'email_not_confirmed'],
  ])('maps GoTrue code %s to %s', (code, message, expected) => {
    const raw = new AuthApiError(message, 400, code);
    const result = mapAuthApiError('ctx', raw);
    expect(result).toEqual(failure(expected));
  });

  it('maps an unrecognised code with HTTP 429 to rate_limited via status fallback', () => {
    const raw = new AuthApiError('slow down', 429, 'some_unmapped_code');
    expect(mapAuthApiError('ctx', raw)).toEqual(failure('rate_limited'));
  });

  it.each<[string, AuthErrorCode]>([
    ['Invalid login credentials', 'invalid_credentials'],
    ['Email not confirmed', 'email_not_confirmed'],
    ['User already registered', 'email_in_use'],
    ['Password should be at least 6 characters', 'weak_password'],
    ['Unable to validate email address: must be a valid email', 'invalid_email'],
  ])('falls back to message-sniffing for %s', (message, expected) => {
    // No `code` field at all — forces the message-sniffing branch.
    const raw = new AuthApiError(message, 400, undefined as unknown as string);
    expect(mapAuthApiError('ctx', raw)).toEqual(failure(expected));
  });

  it('maps an AuthApiError with an unmapped code and unmatched message to unknown', () => {
    const raw = new AuthApiError('a totally unexpected server error', 500, 'weird_code');
    expect(mapAuthApiError('ctx', raw)).toEqual(failure('unknown'));
  });

  it('maps AuthWeakPasswordError to weak_password (checked before the generic AuthApiError branch)', () => {
    const raw = new AuthWeakPasswordError('too weak', 400, ['length']);
    expect(mapAuthApiError('ctx', raw)).toEqual(failure('weak_password'));
  });

  it('maps AuthRetryableFetchError to network', () => {
    const raw = new AuthRetryableFetchError('fetch failed', 0);
    expect(mapAuthApiError('ctx', raw)).toEqual(failure('network'));
  });

  it('maps a bare TypeError (RN fetch throwing) to network', () => {
    expect(mapAuthApiError('ctx', new TypeError('Network request failed'))).toEqual(
      failure('network')
    );
  });

  it.each(['Network request failed', 'Failed to fetch'])(
    'maps a plain Error with message %s to network',
    (message) => {
      expect(mapAuthApiError('ctx', new Error(message))).toEqual(failure('network'));
    }
  );

  it('maps a completely unknown thrown value to unknown', () => {
    expect(mapAuthApiError('ctx', 'a random string was thrown')).toEqual(failure('unknown'));
    expect(mapAuthApiError('ctx', null)).toEqual(failure('unknown'));
    expect(mapAuthApiError('ctx', { foo: 'bar' })).toEqual(failure('unknown'));
  });
});

describe('mapPostgrestError', () => {
  it('maps 42501 (RLS denial) to provisioning_denied', () => {
    expect(mapPostgrestError('ctx', { code: '42501', message: 'permission denied for table users' })).toEqual(
      failure('provisioning_denied')
    );
  });

  it('maps a row-level-security message with no code to provisioning_denied', () => {
    expect(
      mapPostgrestError('ctx', { message: 'new row violates row-level security policy' })
    ).toEqual(failure('provisioning_denied'));
  });

  it.each(['network request failed', 'failed to fetch'])(
    'maps a network-ish message %s to network',
    (message) => {
      expect(mapPostgrestError('ctx', { message })).toEqual(failure('network'));
    }
  );

  it('falls back to unknown for an unrecognised Postgres error', () => {
    expect(mapPostgrestError('ctx', { code: '23514', message: 'check constraint violated' })).toEqual(
      failure('unknown')
    );
  });

  it('falls back to unknown when raw is null', () => {
    expect(mapPostgrestError('ctx', null)).toEqual(failure('unknown'));
  });

  it('falls back to unknown when raw has no code or message', () => {
    expect(mapPostgrestError('ctx', {})).toEqual(failure('unknown'));
  });
});
