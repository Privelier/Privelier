/**
 * Central mapping from PostgREST (supabase.from(...)) errors to a closed set
 * of typed codes with user-facing copy, for the barber services/availability
 * data layer (build-order step 7-8).
 *
 * Mirrors src/auth/errors.ts: the UI only ever sees a BarberDataFailure with
 * a code from BarberDataErrorCode and calm, sentence-case copy. Raw
 * PostgREST/Postgres text goes to debug logging only, never to the screen.
 */

/** Closed set of error codes the UI layer is allowed to switch on. */
export type BarberDataErrorCode = 'forbidden' | 'invalid_input' | 'network' | 'unknown';

/** The error arm shared by every services/availability result union. */
export interface BarberDataFailure {
  status: 'error';
  code: BarberDataErrorCode;
  /** User-facing copy — brand voice: sentence case, calm, no exclamation marks. */
  message: string;
  /** Whether simply retrying the same action can reasonably succeed. */
  retryable: boolean;
}

/** User-facing copy per code. Sentence case, calm, no exclamation marks. */
export const barberDataErrorCopy: Record<BarberDataErrorCode, string> = {
  forbidden: 'You do not have permission to do that.',
  invalid_input:
    'That entry is not valid. Check the values (including day, date and times) and try again.',
  network: 'We could not reach the server. Check your connection and try again.',
  unknown: 'Something went wrong on our side. Try again in a moment.',
};

const retryableCodes: ReadonlySet<BarberDataErrorCode> = new Set(['network']);

/** Build a typed failure for a known code. */
export function failure(code: BarberDataErrorCode): BarberDataFailure {
  return {
    status: 'error',
    code,
    message: barberDataErrorCopy[code],
    retryable: retryableCodes.has(code),
  };
}

/**
 * Raw error details are for developers only. Nothing returned to the UI
 * ever contains raw server text.
 */
export function logBarberDataError(context: string, raw: unknown): void {
  if (__DEV__) {
    console.warn(`[barber] ${context}`, raw);
  }
}

/** Minimal shape shared by PostgrestError without importing its class. */
interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
}

/** Postgres RLS/permission denial (insufficient_privilege). */
const RLS_DENIED = '42501';
/** Postgres check-constraint violation — e.g. chk_availability_day_or_date,
 * chk_availability_time_order, or the price/duration_minutes checks. */
const CHECK_VIOLATION = '23514';

/**
 * Map a PostgREST error to a typed failure and log the raw details.
 * - 42501 (RLS denial): a non-owner or non-barber write attempt.
 * - 23514 (check violation): an invalid day/date pairing, start >= end, or
 *   an out-of-range price/duration — surfaced as a clean validation message,
 *   never the raw Postgres constraint text.
 */
export function mapPostgrestError(context: string, raw: PostgrestErrorLike | null): BarberDataFailure {
  logBarberDataError(context, raw);
  if (!raw) return failure('unknown');
  if (raw.code === RLS_DENIED) return failure('forbidden');
  if (raw.code === CHECK_VIOLATION) return failure('invalid_input');
  const msg = (raw.message ?? '').toLowerCase();
  if (msg.includes('row-level security')) return failure('forbidden');
  if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
    return failure('network');
  }
  return failure('unknown');
}
