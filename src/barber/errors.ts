/**
 * Typed errors for the barber data layer. The PostgREST classification and
 * the copy shared with the customer app live in src/shared/dataErrors; this
 * module adds the barber's wording, per-caller copy overrides and the
 * Storage error mapping used by document and portfolio uploads.
 *
 * The UI only ever sees a BarberDataFailure with a code from
 * BarberDataErrorCode and calm, sentence-case copy.
 */
import { devWarn } from '../shared/devLog';
import {
  buildFailure,
  classifyPostgrestError,
  isNetworkMessage,
  sharedDataErrorCopy,
  type DataFailure,
  type PostgrestErrorLike,
} from '../shared/dataErrors';

/** Closed set of error codes the UI layer is allowed to switch on. */
export type BarberDataErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'network'
  | 'unknown'
  | 'transition_rejected'
  | 'limit_reached'
  | 'rate_limited'
  | 'blocked_language';

/** The error arm shared by every barber result union. */
export type BarberDataFailure = DataFailure<BarberDataErrorCode>;

/** User-facing copy per code. Sentence case, calm, no exclamation marks. */
export const barberDataErrorCopy: Record<BarberDataErrorCode, string> = {
  ...sharedDataErrorCopy.en,
  invalid_input: 'That entry is not valid. Check the values (including day, date and times) and try again.',
  // P0001 here is the status-transition trigger: the booking moved out from
  // under the barber (e.g. the customer withdrew a pending request).
  transition_rejected: 'That booking can no longer be changed that way. Refresh to see its current status.',
};

/** German copy for the same codes. */
export const barberDataErrorCopyDe: Record<BarberDataErrorCode, string> = {
  ...sharedDataErrorCopy.de,
  invalid_input: 'Diese Eingabe ist nicht gültig. Prüfe die Werte (auch Tag, Datum und Uhrzeiten) und versuch es erneut.',
  transition_rejected: 'Dieser Termin kann so nicht mehr geändert werden. Aktualisiere, um den aktuellen Stand zu sehen.',
};

const copy = { en: barberDataErrorCopy, de: barberDataErrorCopyDe };

/**
 * Per-caller copy overrides, keyed by code. The default copy is written for
 * the surface that first needed it (e.g. `invalid_input` names day/date/times,
 * which is right for an availability window and nonsense on a bio screen), so
 * a caller whose surface would read wrong supplies its own sentence here. The
 * CODE is unchanged — only the words the user sees.
 */
export type BarberDataErrorCopyOverrides = Partial<Record<BarberDataErrorCode, string>>;

/** Build a typed failure for a known code, optionally with caller copy. */
export function failure(code: BarberDataErrorCode, overrides?: BarberDataErrorCopyOverrides): BarberDataFailure {
  return buildFailure(code, copy, overrides?.[code]);
}

/** Raw error details are for developers only, never returned to the UI. */
export function logBarberDataError(context: string, raw: unknown): void {
  devWarn(`[barber] ${context}`, raw);
}

/**
 * Map a PostgREST error to a typed failure and log the raw details.
 * `overrides` replaces the user-facing sentence for a code; it never changes
 * which code is returned.
 */
export function mapPostgrestError(
  context: string,
  raw: PostgrestErrorLike | null,
  overrides?: BarberDataErrorCopyOverrides
): BarberDataFailure {
  logBarberDataError(context, raw);
  return failure(classifyPostgrestError(raw), overrides);
}

/** Minimal shape shared by a StorageError without importing its class. */
interface StorageErrorLike {
  message?: string | null;
}

/**
 * Map a Storage (bucket) error to a typed failure. Storage errors carry no
 * PostgREST `code`, so they are classified by message text only. Shared by
 * the verification-document and portfolio uploads (design D7).
 */
export function mapStorageError(context: string, raw: StorageErrorLike | null): BarberDataFailure {
  logBarberDataError(context, raw);
  if (!raw) return failure('unknown');
  const msg = (raw.message ?? '').toLowerCase();
  if (msg.includes('network') || isNetworkMessage(msg)) return failure('network');
  if (msg.includes('permission') || msg.includes('unauthorized') || msg.includes('row-level security')) {
    return failure('forbidden');
  }
  return failure('unknown');
}
