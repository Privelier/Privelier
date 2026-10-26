/**
 * Central mapping from PostgREST (supabase.from(...)) errors to a closed set
 * of typed codes with user-facing copy, for the customer discovery data
 * layer.
 *
 * Mirrors src/barber/errors.ts: the UI only ever sees a CustomerDataFailure
 * with a code from CustomerDataErrorCode and calm, sentence-case copy. Raw
 * PostgREST/Postgres text goes to debug logging only, never to the screen.
 */
import { getAppLanguage } from '../shared/locale';
import { devWarn } from '../shared/devLog';

/** Closed set of error codes the UI layer is allowed to switch on. */
export type CustomerDataErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'network'
  | 'unknown'
  | 'conflict'
  | 'transition_rejected'
  | 'already_reviewed'
  | 'too_many_pending'
  | 'rate_limited'
  | 'blocked_language'
  | 'limit_reached';

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
  already_reviewed: 'You have already reviewed this booking.',
  too_many_pending:
    'You already have several open requests. Wait for a barber to reply, or cancel one, before sending another.',
  rate_limited: 'That was a lot in a short time. Wait a minute, then try again.',
  blocked_language: 'This contains language that is not allowed on Privelier. Edit it and try again.',
  limit_reached: 'You have reached the limit for this. Remove one before adding another.',
};

const retryableCodes: ReadonlySet<CustomerDataErrorCode> = new Set(['network']);

/** German copy for the same codes. */
export const customerDataErrorCopyDe: Record<CustomerDataErrorCode, string> = {
  forbidden: 'Das ist nicht erlaubt.',
  invalid_input: 'Diese Eingabe ist nicht gültig. Prüfe die Werte und versuch es erneut.',
  network: 'Keine Verbindung zum Server. Prüfe deine Verbindung und versuch es erneut.',
  unknown: 'Bei uns ist etwas schiefgelaufen. Versuch es gleich noch einmal.',
  conflict: 'Diese Uhrzeit wurde gerade von jemand anderem gebucht. Wähle eine andere Uhrzeit.',
  transition_rejected: 'Dieser Termin kann nicht mehr storniert werden. Aktualisiere, um den aktuellen Stand zu sehen.',
  already_reviewed: 'Du hast diesen Termin bereits bewertet.',
  too_many_pending:
    'Du hast bereits mehrere offene Anfragen. Warte auf eine Antwort oder sage eine ab, bevor du eine neue sendest.',
  rate_limited: 'Das war viel in kurzer Zeit. Warte eine Minute und versuch es dann erneut.',
  blocked_language: 'Das enthält Sprache, die auf Privelier nicht erlaubt ist. Bitte formuliere es um.',
  limit_reached: 'Du hast das Limit dafür erreicht. Entferne einen Eintrag, bevor du einen neuen hinzufügst.',
};

export function failure(code: CustomerDataErrorCode): CustomerDataFailure {
  return {
    status: 'error',
    code,
    message: (getAppLanguage() === 'de' ? customerDataErrorCopyDe : customerDataErrorCopy)[code],
    retryable: retryableCodes.has(code),
  };
}

/**
 * Raw error details are for developers only. Nothing returned to the UI
 * ever contains raw server text.
 */
export function logCustomerDataError(context: string, raw: unknown): void {
  devWarn(`[customer] ${context}`, raw);
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
 * Postgres unique-violation code. NOT mapped inside mapPostgrestError below:
 * its meaning depends on the write (an idempotent retry during auth
 * provisioning, a duplicate review), so callers check it first.
 */
export const UNIQUE_VIOLATION = '23505';

/** Server-side abuse limits (migrations 0055, 0056). */
const RATE_LIMITED = 'PA429';
const BLOCKED_LANGUAGE = 'PA030';
const LIMIT_REACHED = 'PA002';

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
  if (raw.code === RATE_LIMITED) return failure('rate_limited');
  if (raw.code === BLOCKED_LANGUAGE) return failure('blocked_language');
  if (raw.code === LIMIT_REACHED) return failure('limit_reached');
  const msg = (raw.message ?? '').toLowerCase();
  if (msg.includes('row-level security')) return failure('forbidden');
  if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
    return failure('network');
  }
  return failure('unknown');
}
