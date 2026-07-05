/**
 * Central mapping from Supabase (GoTrue auth + PostgREST data) errors to a
 * closed set of typed codes with user-facing copy.
 *
 * Rules (Contract B):
 * - The UI only ever sees an `AuthFailure` with a code from `AuthErrorCode`
 *   and calm, sentence-case copy. Raw GoTrue/PostgREST/Postgres text goes to
 *   debug logging only, never to the screen.
 * - 23505 (unique violation) is deliberately NOT mapped here — callers treat
 *   it as "the other writer won" and re-fetch (idempotent provisioning).
 */
import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthWeakPasswordError,
} from '@supabase/supabase-js';

/** Closed set of error codes the UI layer is allowed to switch on. */
export type AuthErrorCode =
  | 'email_in_use'
  | 'weak_password'
  | 'invalid_email'
  | 'rate_limited'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'network'
  | 'provisioning_denied'
  | 'unknown';

/** The error arm shared by every auth/profile result union. */
export interface AuthFailure {
  status: 'error';
  code: AuthErrorCode;
  /** User-facing copy — brand voice: sentence case, calm, no exclamation marks. */
  message: string;
  /** Whether simply retrying the same action can reasonably succeed. */
  retryable: boolean;
}

/** User-facing copy per code. Sentence case, calm, no exclamation marks. */
export const authErrorCopy: Record<AuthErrorCode, string> = {
  email_in_use: 'This email is already in use. Try signing in instead.',
  weak_password: 'That password is too weak. Try a longer, less common one.',
  invalid_email: 'That email address does not look valid. Check it and try again.',
  rate_limited: 'Too many attempts for now. Wait a moment, then try again.',
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed:
    'Your email is not confirmed yet. Check your inbox for the confirmation link.',
  network: 'We could not reach the server. Check your connection and try again.',
  provisioning_denied:
    'We could not finish setting up your account. Try again, or contact support if this keeps happening.',
  unknown: 'Something went wrong on our side. Try again in a moment.',
};

const retryableCodes: ReadonlySet<AuthErrorCode> = new Set([
  'network',
  'rate_limited',
  // Contract B §5: on an RLS denial the caller keeps the user in the
  // provisioning state so the action can be retried (e.g. via the setup form).
  'provisioning_denied',
]);

/** Build a typed failure for a known code. */
export function failure(code: AuthErrorCode): AuthFailure {
  return {
    status: 'error',
    code,
    message: authErrorCopy[code],
    retryable: retryableCodes.has(code),
  };
}

/**
 * Raw error details are for developers only. Nothing returned to the UI
 * ever contains raw server text.
 */
export function logAuthError(context: string, raw: unknown): void {
  if (__DEV__) {
    console.warn(`[auth] ${context}`, raw);
  }
}

/** Fetch-level failures thrown by React Native's networking stack. */
function isNetworkFailure(raw: unknown): boolean {
  if (raw instanceof TypeError) return true;
  if (raw instanceof Error) {
    const msg = raw.message.toLowerCase();
    return msg.includes('network request failed') || msg.includes('failed to fetch');
  }
  return false;
}

/**
 * Map a GoTrue (supabase.auth.*) error to a typed failure and log the raw
 * details. Prefers the structured `code` field; falls back to status/message
 * sniffing for responses that omit it.
 */
export function mapAuthApiError(context: string, raw: unknown): AuthFailure {
  logAuthError(context, raw);
  if (isAuthRetryableFetchError(raw)) return failure('network');
  if (isAuthWeakPasswordError(raw)) return failure('weak_password');
  if (isAuthApiError(raw)) {
    switch (raw.code) {
      case 'user_already_exists':
      case 'email_exists':
        return failure('email_in_use');
      case 'weak_password':
        return failure('weak_password');
      case 'email_address_invalid':
      case 'validation_failed':
        return failure('invalid_email');
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return failure('rate_limited');
      case 'invalid_credentials':
        return failure('invalid_credentials');
      case 'email_not_confirmed':
        return failure('email_not_confirmed');
      default:
        break;
    }
    if (raw.status === 429) return failure('rate_limited');
    const msg = raw.message.toLowerCase();
    if (msg.includes('invalid login credentials')) return failure('invalid_credentials');
    if (msg.includes('email not confirmed')) return failure('email_not_confirmed');
    if (msg.includes('already registered')) return failure('email_in_use');
    if (msg.includes('password should be')) return failure('weak_password');
    if (msg.includes('valid email')) return failure('invalid_email');
    return failure('unknown');
  }
  if (isNetworkFailure(raw)) return failure('network');
  return failure('unknown');
}

/** Minimal shape shared by PostgrestError without importing its class. */
interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
}

/**
 * Map a PostgREST (supabase.from(...)) error to a typed failure and log the
 * raw details. Callers must handle 23505 (unique violation) themselves
 * BEFORE calling this — it means "another writer already provisioned the
 * row" and is a success path, not a failure.
 */
export function mapPostgrestError(context: string, raw: PostgrestErrorLike | null): AuthFailure {
  logAuthError(context, raw);
  if (!raw) return failure('unknown');
  // 42501: RLS/permission denial. Post-migration-0005 this signals tampered
  // signup metadata (e.g. a role outside customer/barber) — Contract B §5.
  if (raw.code === '42501') return failure('provisioning_denied');
  const msg = (raw.message ?? '').toLowerCase();
  if (msg.includes('row-level security')) return failure('provisioning_denied');
  if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
    return failure('network');
  }
  return failure('unknown');
}
