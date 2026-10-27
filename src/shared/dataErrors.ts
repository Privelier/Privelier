/**
 * The PostgREST error classification and the copy shared by the customer
 * and barber data layers. Each app keeps its own closed code set, its
 * failure type and the wording that is specific to its surfaces; this module
 * only holds what is identical in both. Auth maps GoTrue errors and keeps
 * its own module.
 *
 * Raw PostgREST/Postgres text goes to debug logging only, never to the
 * screen.
 */
import { getAppLanguage } from './locale';

/** Minimal shape shared by PostgrestError without importing its class. */
export interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
}

/** What a PostgREST error means for the UI, before app-specific wording. */
type PostgrestErrorKind =
  | 'forbidden'
  | 'invalid_input'
  | 'transition_rejected'
  | 'rate_limited'
  | 'blocked_language'
  | 'limit_reached'
  | 'network'
  | 'unknown';

const KIND_BY_CODE: Readonly<Record<string, PostgrestErrorKind>> = {
  // RLS/permission denial (insufficient_privilege).
  '42501': 'forbidden',
  // Check-constraint violation, e.g. availability time order or price > 0.
  '23514': 'invalid_input',
  // A bare RAISE EXCEPTION: on these write surfaces only the actor-aware
  // booking status-transition trigger (migration 0011) raises it.
  P0001: 'transition_rejected',
  // Server-side abuse limits (migrations 0055, 0056).
  PA429: 'rate_limited',
  PA030: 'blocked_language',
  PA002: 'limit_reached',
};

/**
 * Postgres unique violation. Deliberately NOT classified: its meaning
 * depends on the write (an idempotent retry, a duplicate review), so callers
 * check it first.
 */
export const UNIQUE_VIOLATION = '23505';

/** Fetch-level failures from React Native's networking stack. */
export function isNetworkMessage(message: string | null | undefined): boolean {
  const msg = (message ?? '').toLowerCase();
  return msg.includes('network request failed') || msg.includes('failed to fetch');
}

export function classifyPostgrestError(raw: PostgrestErrorLike | null): PostgrestErrorKind {
  if (!raw) return 'unknown';
  const byCode = raw.code ? KIND_BY_CODE[raw.code] : undefined;
  if (byCode) return byCode;
  if ((raw.message ?? '').toLowerCase().includes('row-level security')) return 'forbidden';
  if (isNetworkMessage(raw.message)) return 'network';
  return 'unknown';
}

type SharedCode = 'forbidden' | 'network' | 'unknown' | 'rate_limited' | 'blocked_language' | 'limit_reached';

/** Copy for the codes that read the same on every surface. */
export const sharedDataErrorCopy: Record<'en' | 'de', Record<SharedCode, string>> = {
  en: {
    forbidden: 'You do not have permission to do that.',
    network: 'We could not reach the server. Check your connection and try again.',
    unknown: 'Something went wrong on our side. Try again in a moment.',
    rate_limited: 'That was a lot in a short time. Wait a minute, then try again.',
    blocked_language: 'This contains language that is not allowed on Privelier. Edit it and try again.',
    limit_reached: 'You have reached the limit for this. Remove one before adding another.',
  },
  de: {
    forbidden: 'Das ist nicht erlaubt.',
    network: 'Keine Verbindung zum Server. Prüfe deine Verbindung und versuch es erneut.',
    unknown: 'Bei uns ist etwas schiefgelaufen. Versuch es gleich noch einmal.',
    rate_limited: 'Das war viel in kurzer Zeit. Warte eine Minute und versuch es dann erneut.',
    blocked_language: 'Das enthält Sprache, die auf Privelier nicht erlaubt ist. Bitte formuliere es um.',
    limit_reached: 'Du hast das Limit dafür erreicht. Entferne einen Eintrag, bevor du einen neuen hinzufügst.',
  },
};

/** The typed failure every data-layer result union shares. */
export interface DataFailure<C extends string> {
  status: 'error';
  code: C;
  /** User-facing copy — brand voice: sentence case, calm, no exclamation marks. */
  message: string;
  /** Whether simply retrying the same action can reasonably succeed. */
  retryable: boolean;
}

/** Build a failure in the app language; only network errors are retryable. */
export function buildFailure<C extends string>(
  code: C,
  copy: { en: Record<C, string>; de: Record<C, string> },
  override?: string
): DataFailure<C> {
  return {
    status: 'error',
    code,
    message: override ?? copy[getAppLanguage() === 'de' ? 'de' : 'en'][code],
    retryable: code === 'network',
  };
}
