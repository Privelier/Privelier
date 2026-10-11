/**
 * Client-side form validation for the auth screens (build-order step 5).
 * Copy is brand voice: sentence case, calm, no exclamation marks.
 */

import { getAppLanguage } from '../../shared/locale';

/**
 * Supabase's server-side default minimum is 6 characters; we deliberately
 * enforce 8 client-side for a premium product (recorded step-5 decision).
 * The server remains the authority — this is UX guidance, not security.
 */
export const PASSWORD_MIN_LENGTH = 8;

const isGerman = () => getAppLanguage() === 'de';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return isGerman() ? 'Gib deine E-Mail-Adresse ein.' : 'Enter your email address.';
  if (!EMAIL_PATTERN.test(trimmed)) return isGerman() ? 'Diese E-Mail-Adresse scheint nicht gültig zu sein.' : 'That email address does not look valid.';
  return undefined;
}

export function signupPasswordError(value: string): string | undefined {
  if (value.length === 0) return isGerman() ? 'Wähle ein Passwort.' : 'Choose a password.';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return isGerman() ? `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.` : `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return undefined;
}

export function loginPasswordError(value: string): string | undefined {
  if (value.length === 0) return isGerman() ? 'Gib dein Passwort ein.' : 'Enter your password.';
  return undefined;
}

/** Required text field: trimmed emptiness check with field-specific copy. */
export function requiredText(value: string, message: string): string | undefined {
  return value.trim().length === 0 ? message : undefined;
}

/** Optional text field: trimmed value, or undefined so it is omitted entirely. */
export function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
