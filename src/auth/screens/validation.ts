/**
 * Client-side form validation for the auth screens (build-order step 5).
 * Copy is brand voice: sentence case, calm, no exclamation marks.
 */

/**
 * Supabase's server-side default minimum is 6 characters; we deliberately
 * enforce 8 client-side for a premium product (recorded step-5 decision).
 * The server remains the authority — this is UX guidance, not security.
 */
export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'That email address does not look valid.';
  return undefined;
}

export function signupPasswordError(value: string): string | undefined {
  if (value.length === 0) return 'Choose a password.';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return undefined;
}

export function loginPasswordError(value: string): string | undefined {
  if (value.length === 0) return 'Enter your password.';
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
