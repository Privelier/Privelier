/**
 * Typed errors for the customer data layer. The PostgREST classification
 * and the copy shared with the barber app live in src/shared/dataErrors;
 * this module adds the customer-only codes (booking conflicts, reviews,
 * open-request cap) and the customer's wording.
 *
 * The UI only ever sees a CustomerDataFailure with a code from
 * CustomerDataErrorCode and calm, sentence-case copy.
 */
import { devWarn } from '../shared/devLog';
import { buildFailure, classifyPostgrestError, sharedDataErrorCopy, type DataFailure, type PostgrestErrorLike } from '../shared/dataErrors';

export { UNIQUE_VIOLATION } from '../shared/dataErrors';

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

/** The error arm shared by every customer result union. */
export type CustomerDataFailure = DataFailure<CustomerDataErrorCode>;

/** User-facing copy per code. Sentence case, calm, no exclamation marks. */
export const customerDataErrorCopy: Record<CustomerDataErrorCode, string> = {
  ...sharedDataErrorCopy.en,
  invalid_input: 'That entry is not valid. Check the values and try again.',
  conflict: 'That time was just booked by someone else. Pick another time.',
  // P0001 here is the status-transition trigger refusing a cancel because
  // the booking already moved on.
  transition_rejected: 'That booking can no longer be cancelled. Refresh to see its current status.',
  already_reviewed: 'You have already reviewed this booking.',
  too_many_pending:
    'You already have several open requests. Wait for a barber to reply, or cancel one, before sending another.',
};

/** German copy for the same codes. */
export const customerDataErrorCopyDe: Record<CustomerDataErrorCode, string> = {
  ...sharedDataErrorCopy.de,
  invalid_input: 'Diese Eingabe ist nicht gültig. Prüfe die Werte und versuch es erneut.',
  conflict: 'Diese Uhrzeit wurde gerade von jemand anderem gebucht. Wähle eine andere Uhrzeit.',
  transition_rejected: 'Dieser Termin kann nicht mehr storniert werden. Aktualisiere, um den aktuellen Stand zu sehen.',
  already_reviewed: 'Du hast diesen Termin bereits bewertet.',
  too_many_pending:
    'Du hast bereits mehrere offene Anfragen. Warte auf eine Antwort oder sage eine ab, bevor du eine neue sendest.',
};

const copy = { en: customerDataErrorCopy, de: customerDataErrorCopyDe };

export function failure(code: CustomerDataErrorCode): CustomerDataFailure {
  return buildFailure(code, copy);
}

/** Raw error details are for developers only, never returned to the UI. */
export function logCustomerDataError(context: string, raw: unknown): void {
  devWarn(`[customer] ${context}`, raw);
}

/** Map a PostgREST error to a typed failure and log the raw details. */
export function mapPostgrestError(context: string, raw: PostgrestErrorLike | null): CustomerDataFailure {
  logCustomerDataError(context, raw);
  return failure(classifyPostgrestError(raw));
}
