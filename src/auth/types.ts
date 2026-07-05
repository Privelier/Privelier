/**
 * Public result types for the auth/profile data layer (Contract B).
 * Every service function returns a discriminated union the UI can switch on;
 * nothing here ever carries raw server error text.
 */
import type { Role, UsersRow } from '../types';
import type { AuthFailure } from './errors';

/** Profile fields collected at customer signup. */
export interface SignUpProfileFields {
  name: string;
  city: string;
  country?: string;
  phone?: string;
}

/** Profile fields collected at barber signup. */
export interface BarberSignUpProfileFields extends SignUpProfileFields {
  bio?: string;
}

/**
 * Result of signUpCustomer / signUpBarber. With email confirmation ON,
 * a successful call never returns a session — the UI routes to a
 * "check your inbox" screen on 'confirmation_email_sent'.
 */
export type SignUpResult =
  | { status: 'confirmation_email_sent'; email: string }
  | { status: 'email_in_use' }
  | AuthFailure;

/**
 * Result of signIn. 'email_not_confirmed' is a first-class arm (not just an
 * error code) because the UI routes back to the check-your-inbox screen and
 * offers resendConfirmation from there.
 */
export type SignInResult =
  | { status: 'signed_in' }
  | { status: 'email_not_confirmed'; email: string }
  | AuthFailure;

/** Result of resendConfirmation. */
export type ResendConfirmationResult = { status: 'sent' } | AuthFailure;

/**
 * Result of fetchOwnProfile. 'ok' with profile null means "no users row yet"
 * (deferred provisioning has not run); a fetch failure is a separate arm so
 * callers never mistake a network error for a missing row.
 */
export type FetchOwnProfileResult =
  | { status: 'ok'; profile: UsersRow | null }
  | AuthFailure;

/**
 * Prefill recovered from signup metadata for the setup form. Metadata is a
 * recovery-prefill hint ONLY — never authorization; only values that pass
 * client-side validation appear here.
 */
export interface ProfilePrefill {
  role?: Role;
  name?: string;
  city?: string;
  country?: string;
  phone?: string;
  bio?: string;
}

/** Fields the setup form submits when metadata was missing or invalid. */
export interface SetupFormFields {
  role: Role;
  name: string;
  city: string;
  country?: string;
  phone?: string;
  bio?: string;
}

/**
 * Result of ensureProfile / ensureProfileFromForm.
 * - 'ready': users row exists (and barber_profile too, for barbers).
 * - 'needs_setup_form': no users row and metadata was unusable — the UI
 *   collects the fields and calls ensureProfileFromForm.
 * - 'signed_out': there is no session; nothing to provision.
 * - error arm: caller stays in the provisioning state; recovery is
 *   detection + idempotent retry, never deletion.
 */
export type EnsureProfileResult =
  | { status: 'ready'; profile: UsersRow }
  | { status: 'needs_setup_form'; prefill: ProfilePrefill }
  | { status: 'signed_out' }
  | AuthFailure;
