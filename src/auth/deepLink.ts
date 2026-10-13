/**
 * Auth deep-link callback handling.
 *
 * The client runs the PKCE flow (lib/supabase.ts), so every legitimate
 * callback — email confirmation, password recovery, Google/Apple web OAuth —
 * arrives as `privelier://auth-callback?code=...`. Exchanging the code needs
 * the verifier this device stored when it started the flow, so a link crafted
 * by someone else cannot sign this device into a foreign account.
 *
 * Implicit-flow fragments (`#access_token=...&refresh_token=...`) are refused
 * on purpose: any web page or app can open that URL with the attacker's own
 * tokens and silently swap the victim into the attacker's session.
 *
 * Failed or stale links arrive as `?error=...&error_code=otp_expired` (PKCE)
 * or the same keys in the fragment; both are read.
 */
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { logAuthError } from './errors';

/** Path segment used for every auth redirect link. Must match the Supabase
 * dashboard's Auth → URL Configuration redirect allow-list exactly. */
const AUTH_CALLBACK_PATH = 'auth-callback';
const APP_SCHEME = 'privelier:';

/** Build the `emailRedirectTo` value for signUp/resend calls. */
export function getEmailRedirectTo(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/** Expo Go produces an `exp://` callback that is not a stable Supabase
 * redirect target. Email links and OAuth require the development/production
 * build registered for Privelier's custom scheme. */
export function hasStableAuthRedirect(): boolean {
  try {
    return new URL(getEmailRedirectTo()).protocol === APP_SCHEME;
  } catch {
    return false;
  }
}

export type AuthCallbackOutcome = 'applied' | 'recovery_applied' | 'expired_or_used' | 'error' | 'ignored';

interface ParsedCallback {
  code?: string;
  errorCode?: string;
}

/**
 * Accept only the callback URL created for this running app. A development
 * build resolves this to `privelier://auth-callback`; Expo Go resolves it to
 * an `exp://.../--/auth-callback` URL, which is deliberately not a stable
 * production auth target.
 *
 * Query parameters are allowed, but user-info, ports, and extra path
 * segments are not.
 */
export function isExpectedAuthCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const expected = new URL(getEmailRedirectTo());
    const expectedPath = expected.pathname;
    const hasExpectedPath =
      parsed.pathname === expectedPath ||
      (expectedPath === '' && parsed.pathname === '/');
    return (
      parsed.protocol === expected.protocol &&
      parsed.host === expected.host &&
      parsed.port === expected.port &&
      hasExpectedPath &&
      parsed.username === '' &&
      parsed.password === ''
    );
  } catch {
    return false;
  }
}

/** Pure parser: a PKCE code, or an error from the query or the fragment.
 * Token-bearing fragments are never returned (see the module comment). */
export function parseAuthCallbackUrl(url: string): ParsedCallback | null {
  if (!isExpectedAuthCallbackUrl(url)) return null;
  const query = new URL(url).searchParams;
  const hashIndex = url.indexOf('#');
  const fragment = new URLSearchParams(hashIndex === -1 ? '' : url.slice(hashIndex + 1));
  const errorCode =
    query.get('error_code') ?? query.get('error') ?? fragment.get('error_code') ?? fragment.get('error') ?? undefined;
  if (errorCode) return { errorCode };
  const code = query.get('code') ?? undefined;
  return code ? { code } : null;
}

/**
 * On Android the OAuth redirect reaches both WebBrowser.openAuthSessionAsync
 * and the app-wide Linking listener. A PKCE code can be exchanged only once,
 * so concurrent callers for the same code share one exchange instead of the
 * loser failing with "invalid flow state" and signing the user back out.
 */
const inFlightExchanges = new Map<string, Promise<AuthCallbackOutcome>>();

async function exchangeCode(code: string): Promise<AuthCallbackOutcome> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logAuthError('deepLink.exchangeCodeForSession', error);
    return 'error';
  }
  // auth-js returns redirectType at runtime (verifier stored as "<v>/recovery")
  // but its public type omits it.
  const redirectType = (data as { redirectType?: string | null } | null)?.redirectType;
  return redirectType === 'recovery' ? 'recovery_applied' : 'applied';
}

/**
 * Handle an incoming deep link. Safe to call with any URL the app is opened
 * with — returns 'ignored' for anything that is not an auth callback.
 */
export async function applyAuthCallbackUrl(url: string): Promise<AuthCallbackOutcome> {
  const parsed = parseAuthCallbackUrl(url);
  if (!parsed) return 'ignored';
  if (parsed.errorCode) {
    logAuthError('deepLink', `auth callback returned error_code=${parsed.errorCode}`);
    return parsed.errorCode === 'otp_expired' ? 'expired_or_used' : 'error';
  }
  const code = parsed.code as string;
  const pending = inFlightExchanges.get(code);
  if (pending) return pending;
  // Settled results stay cached so a late duplicate delivery of the same URL
  // resolves to the same outcome instead of re-exchanging a spent code.
  if (inFlightExchanges.size >= 20) inFlightExchanges.clear();
  const exchange = exchangeCode(code);
  inFlightExchanges.set(code, exchange);
  return exchange;
}

/**
 * True while signInWithProvider owns an OAuth browser session. The app-wide
 * Linking listener leaves the callback to that caller, which reports errors
 * inline on the sign-in screen instead of the email-link error screen.
 */
let oauthSessionActive = false;
export function setOAuthSessionActive(active: boolean): void {
  oauthSessionActive = active;
}
export function isOAuthSessionActive(): boolean {
  return oauthSessionActive;
}
