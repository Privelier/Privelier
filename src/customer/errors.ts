/**
 * Central mapping from PostgREST (supabase.from(...)) errors to a closed set
 * of typed codes with user-facing copy, for the customer discovery data
 * layer (build-order step 9-10).
 *
 * Mirrors src/barber/errors.ts: the UI only ever sees a CustomerDataFailure
 * with a code from CustomerDataErrorCode and calm, sentence-case copy. Raw
 * PostgREST/Postgres text goes to debug logging only, never to the screen.
 */

/** Closed set of error codes the UI layer is allowed to switch on. */
export type CustomerDataErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'network'
  | 'unknown'
  | 'conflict'
  | 'transition_rejected';

/** The error arm shared by every discovery result union. */
export interface CustomerDataFailure {
  status: 'error';
  code: CustomerDataErrorCode;
  /** User-facing copy — brand voice: sentence case, calm, no exclamation marks. */
  message: string;
  /** Whether simply retrying the same action can reasonably succeed. */
  retryable: boolean;
}

/** User-facing copy per code. Sentence case, calm, no exclamation marks. */
export const customerDataErrorCopy: Record<CustomerDataErrorCode, string> = {
  forbidden: 'You do not have permission to do that.',
  invalid_input: 'That entry is not valid. Check the values and try again.',
  network: 'We could not reach the server. Check your connection and try again.',
  unknown: 'Something went wrong on our side. Try again in a moment.',
  conflict: 'That time was just booked by someone else. Pick another time.',
  transition_rejected:
    'That booking can no longer be cancelled. Refresh to see its current status.',
};

const retryableCodes: ReadonlySet<CustomerDataErrorCode> = new Set(['network']);

/** Build a typed failure for a known code. */
export function failure(code: CustomerDataErrorCode): CustomerDataFailure {
  return {
    status: 'error',
    code,
    message: customerDataErrorCopy[code],
    retryable: retryableCodes.has(code),
  };
}

/**
 * Raw error details are for developers only. Nothing returned to the UI
 * ever contains raw server text.
 */
export function logCustomerDataError(context: string, raw: unknown): void {
  if (__DEV__) {
    console.warn(`[customer] ${context}`, raw);
  }
}

/** Minimal shape shared by PostgrestError without importing its class. */
interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
}

/** Postgres RLS/permission denial (insufficient_privilege). */
const RLS_DENIED = '42501';
/** Postgres check-constraint violation. Discovery is read-only in this
 * module, so this should not normally occur, but is mapped defensively for
 * consistency with the barber-side data layer's error shape. */
const CHECK_VIOLATION = '23514';
/**
 * Postgres raise_exception (a bare `RAISE EXCEPTION` in a trigger/function).
 * On the customer write surfaces this only comes from the actor-aware booking
 * status-transition trigger (migration 0011) rejecting an illegal transition
 * or a wrong-actor cancel — surfaced as a distinct 'transition_rejected' so
 * the Bookings screen can tell the customer the booking already moved on
 * rather than showing generic error copy. The column-immutability freeze in
 * the same trigger also raises P0001, but the cancel mutation only ever
 * changes `status`, so it is never hit.
 */
const RAISE_EXCEPTION = 'P0001';
/**
 * Postgres unique-violation code. NOT mapped inside mapPostgrestError below
 * — 23505 means something different depending on context: during auth
 * provisioning it signals "another writer already created this same row,
 * treat as idempotent success" (see src/auth/authService.ts), but for
 * booking creation it means two different customers raced for the same
 * barber/date/time slot (uq_bookings_barber_slot_active, migration 0009)
 * and must surface as a real, user-facing conflict. Exported so
 * insertBooking (src/customer/bookingCreateData.ts) can check it before
 * falling back to the generic mapper.
 */
export const UNIQUE_VIOLATION = '23505';

/**
 * Map a PostgREST error to a typed failure and log the raw details.
 * - 42501 (RLS denial): an unauthenticated or otherwise disallowed read
 *   attempt (e.g. the anon role, which has no table access as of migration
 *   0006).
 * - 23514 (check violation): mapped for shape consistency with the
 *   barber-side error module; not expected on the read-only paths here.
 */
export function mapPostgrestError(
  context: string,
  raw: PostgrestErrorLike | null
): CustomerDataFailure {
  logCustomerDataError(context, raw);
  if (!raw) return failure('unknown');
  if (raw.code === RLS_DENIED) return failure('forbidden');
  if (raw.code === CHECK_VIOLATION) return failure('invalid_input');
  if (raw.code === RAISE_EXCEPTION) return failure('transition_rejected');
  const msg = (raw.message ?? '').toLowerCase();
  if (msg.includes('row-level security')) return failure('forbidden');
  if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
    return failure('network');
  }
  return failure('unknown');
}
