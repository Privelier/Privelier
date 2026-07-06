/**
 * Auth deep-link callback handling (build-order step 5 hardening).
 *
 * Supabase's email confirmation link redirects to whatever `emailRedirectTo`
 * was passed at signUp/resend time, appending the session as a URL fragment:
 *   <redirectTo>#access_token=...&refresh_token=...&type=signup
 * or, if the link is stale/already used:
 *   <redirectTo>#error=access_denied&error_code=otp_expired&error_description=...
 *
 * The app never has a `window.location` for supabase-js to read automatically
 * (that is what `detectSessionInUrl` controls, and it is a no-op outside a
 * browser) — so this module is the manual equivalent: it turns the deep link
 * URL Linking hands us into a real session via `setSession`, which then flows
 * through the existing `onAuthStateChange` subscription in useAuthShell
 * exactly like any other sign-in.
 */
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { logAuthError } from './errors';

/** Path segment used for every auth redirect link. Must match the Supabase
 * dashboard's Auth → URL Configuration redirect allow-list exactly. */
const AUTH_CALLBACK_PATH = 'auth-callback';

/** Build the `emailRedirectTo` value for signUp/resend calls. */
export function getEmailRedirectTo(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

export type AuthCallbackOutcome = 'applied' | 'expired_or_used' | 'error' | 'ignored';

interface ParsedCallback {
  accessToken?: string;
  refreshToken?: string;
  errorCode?: string;
}

/** Pure parser — the URL fragment is not a standard query string, so this is
 * hand-rolled rather than relying on URL/Linking's query-string parsing. */
export function parseAuthCallbackUrl(url: string): ParsedCallback | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;
  const fragment = url.slice(hashIndex + 1);
  if (fragment.length === 0) return null;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token') ?? undefined;
  const refreshToken = params.get('refresh_token') ?? undefined;
  const errorCode = params.get('error_code') ?? params.get('error') ?? undefined;
  if (!accessToken && !refreshToken && !errorCode) return null;
  return { accessToken, refreshToken, errorCode };
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
  if (!parsed.accessToken || !parsed.refreshToken) {
    logAuthError('deepLink', 'auth callback missing access_token/refresh_token');
    return 'error';
  }
  const { error } = await supabase.auth.setSession({
    access_token: parsed.accessToken,
    refresh_token: parsed.refreshToken,
  });
  if (error) {
    logAuthError('deepLink.setSession', error);
    return 'error';
  }
  return 'applied';
}
