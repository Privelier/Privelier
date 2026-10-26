/**
 * Auth + profile provisioning data layer.
 *
 * Implements Contract B exactly:
 * - Email confirmation is ON: signUp() returns no session and performs NO
 *   profile-row inserts. Signup metadata is a recovery-prefill hint only.
 * - Profile rows are created on FIRST LOGIN via the idempotent
 *   ensureProfile(), called on every boot while a session exists.
 * - Role truth comes from public.users (server), never from user_metadata.
 * - The client never writes users.role (post-create), users.created_at,
 *   barber_profile.rating / verified / verification_status — server defaults
 *   and the migration-0005 triggers own those.
 * - There is no client-side rollback across auth.users → users →
 *   barber_profile: recovery is detection + idempotent retry, never deletion.
 *
 * No UI in this module.
 */
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';
import type { Role, UsersRow } from '../types';
import { applyAuthCallbackUrl, getEmailRedirectTo, hasStableAuthRedirect, setOAuthSessionActive } from './deepLink';
import { failure, logAuthError, mapAuthApiError, mapPostgrestError } from './errors';
import type { AuthFailure } from './errors';
import type {
  BarberSignUpProfileFields,
  EnsureProfileResult,
  FetchOwnProfileResult,
  ProfilePrefill,
  PasswordResetRequestResult,
  PasswordUpdateResult,
  ResendConfirmationResult,
  SetupFormFields,
  SignInResult,
  OAuthSignInResult,
  SignUpProfileFields,
  SignUpResult,
} from './types';

/** Postgres unique-violation SQLSTATE — "the other writer already won". */
const UNIQUE_VIOLATION = '23505';

/** Runtime guard: the only role values a client may ever provision. */
function isClientRole(value: unknown): value is Role {
  return value === 'customer' || value === 'barber';
}

/** Fields required to insert the users row (and optionally barber_profile). */
interface ProvisionFields {
  role: Role;
  name: string;
  city?: string;
  country?: string;
  phone?: string;
  bio?: string;
}

// ---------------------------------------------------------------------------
// Sign up (Contract B §signUp)
// ---------------------------------------------------------------------------

async function signUp(
  email: string,
  password: string,
  metadata: ProvisionFields
): Promise<SignUpResult> {
  if (!hasStableAuthRedirect()) return failure('development_build_required');
  const normalizedEmail = email.trim();
  const normalizedMetadata = {
    ...metadata,
    name: metadata.name.trim(),
    city: metadata.city?.trim(),
    country: metadata.country?.trim() || undefined,
  };
  // Single write. options.data is stored as user_metadata — a prefill hint
  // for deferred provisioning ONLY, never authorization (RLS + the 0005
  // triggers are the authority).
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: getEmailRedirectTo(),
      data: {
        name: normalizedMetadata.name,
        role: normalizedMetadata.role,
        city: normalizedMetadata.city,
        country: normalizedMetadata.country,
        phone: normalizedMetadata.phone,
        bio: normalizedMetadata.bio,
        // Signup is only submittable with both consent boxes ticked; this
        // records that statement until the profile exists and the server
        // RPC can store it (see syncLegalConsent).
        legal_consent: true,
      },
    },
  });
  if (error) {
    const mapped = mapAuthApiError('signUp', error);
    if (mapped.code === 'email_in_use') return { status: 'email_in_use' };
    return mapped;
  }
  // With confirmation ON, Supabase obfuscates duplicate emails: it returns a
  // fake user whose identities array is empty instead of an error.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { status: 'email_in_use' };
  }
  return { status: 'confirmation_email_sent', email: normalizedEmail };
}

export function signUpCustomer(
  email: string,
  password: string,
  fields: SignUpProfileFields
): Promise<SignUpResult> {
  return signUp(email, password, { role: 'customer', ...fields });
}

export function signUpBarber(
  email: string,
  password: string,
  fields: BarberSignUpProfileFields
): Promise<SignUpResult> {
  return signUp(email, password, { role: 'barber', ...fields });
}

// ---------------------------------------------------------------------------
// Sign in / resend confirmation / sign out
// ---------------------------------------------------------------------------

async function signOutOnRoleMismatch(expectedRole: Role): Promise<Role | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
  if (error || !data || !isClientRole(data.role) || data.role === expectedRole) return null;
  await supabase.auth.signOut();
  return data.role;
}

export async function signIn(email: string, password: string, expectedRole?: Role): Promise<SignInResult> {
  const normalizedEmail = email.trim();
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) {
    const mapped = mapAuthApiError('signIn', error);
    if (mapped.code === 'email_not_confirmed') {
      // Routes the UI back to the check-your-inbox screen.
      return { status: 'email_not_confirmed', email: normalizedEmail };
    }
    return mapped;
  }
  if (expectedRole) {
    const actualRole = await signOutOnRoleMismatch(expectedRole);
    if (actualRole) return { status: 'role_mismatch', actualRole };
  }
  // Session is persisted by the client (encrypted SecureStore). The caller's
  // next step is ensureProfile().
  return { status: 'signed_in' };
}

/**
 * Sign in with Apple is offered on iOS only, where it is native
 * (ASAuthorizationController) and needs no Services ID or rotating client
 * secret. App Store Guideline 4.8 requires it there because Google sign-in is
 * offered; Android users have Google and email.
 */
export function isAppleSignInSupported(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Native Sign in with Apple -> Supabase signInWithIdToken.
 * https://supabase.com/docs/guides/auth/social-login/auth-apple (Expo native)
 * A random nonce is SHA-256 hashed into Apple's request and the raw value is
 * sent to Supabase, which checks the token's nonce claim (replay protection).
 * Apple returns the name only on the very first authorization, so it is
 * saved to user_metadata straight away for the finish-setup prefill.
 */
async function signInWithAppleNative(): Promise<{ status: 'started' } | { status: 'cancelled' } | AuthFailure> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (raw) {
    if ((raw as { code?: string } | null)?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    logAuthError('signInWithApple.native', raw);
    return failure('provider_unavailable');
  }
  if (!credential.identityToken) {
    logAuthError('signInWithApple.native', 'no identity token returned');
    return failure('provider_unavailable');
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) return mapAuthApiError('signInWithApple.idToken', error);
  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ');
  if (name) {
    const updated = await supabase.auth.updateUser({ data: { name, full_name: name } });
    if (updated.error) logAuthError('signInWithApple.saveName', updated.error);
  }
  return { status: 'started' };
}

/**
 * Google (and Apple on non-iOS, if ever enabled) through Supabase's hosted
 * OAuth + PKCE in the system auth session (ASWebAuthenticationSession /
 * Custom Tabs — never an embedded WebView, which Google blocks).
 * https://supabase.com/docs/guides/auth/social-login/auth-google
 */
async function signInWithBrowserOAuth(
  provider: 'google' | 'apple'
): Promise<{ status: 'started' } | { status: 'cancelled' } | AuthFailure> {
  const redirectTo = getEmailRedirectTo();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Let people choose which Google account to use instead of silently
      // reusing the one the browser is signed into.
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });
  if (error) return mapAuthApiError(`signInWithProvider.${provider}`, error);
  if (!data.url) return failure('provider_unavailable');
  setOAuthSessionActive(true);
  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'cancel' || result.type === 'dismiss') return { status: 'cancelled' };
    if (result.type !== 'success') return failure('provider_unavailable');
    const outcome = await applyAuthCallbackUrl(result.url);
    if (outcome === 'applied' || outcome === 'recovery_applied') return { status: 'started' };
    // 'ignored' means Supabase redirected somewhere other than our callback:
    // the redirect URL is missing from Auth -> URL Configuration.
    logAuthError(`signInWithProvider.${provider}`, `callback outcome=${outcome}`);
    return failure('provider_unavailable');
  } finally {
    setOAuthSessionActive(false);
  }
}

export async function signInWithProvider(
  provider: 'google' | 'apple',
  expectedRole?: Role
): Promise<OAuthSignInResult> {
  const native = provider === 'apple' && isAppleSignInSupported();
  if (!native && !hasStableAuthRedirect()) return failure('development_build_required');
  try {
    const result = native ? await signInWithAppleNative() : await signInWithBrowserOAuth(provider);
    if (result.status !== 'started') return result;
    if (expectedRole) {
      const actualRole = await signOutOnRoleMismatch(expectedRole);
      if (actualRole) return { status: 'role_mismatch', actualRole };
    }
    return { status: 'started' };
  } catch (raw) {
    return mapAuthApiError(`signInWithProvider.${provider}`, raw);
  }
}

export async function resendConfirmation(email: string): Promise<ResendConfirmationResult> {
  if (!hasStableAuthRedirect()) return failure('development_build_required');
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: getEmailRedirectTo() },
  });
  if (error) return mapAuthApiError('resendConfirmation', error);
  return { status: 'sent' };
}

export async function requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
  if (!hasStableAuthRedirect()) return failure('development_build_required');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getEmailRedirectTo(),
  });
  if (error) return mapAuthApiError('requestPasswordReset', error);
  return { status: 'sent' };
}

export async function updatePassword(password: string): Promise<PasswordUpdateResult> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return mapAuthApiError('updatePassword', error);
  return { status: 'updated' };
}

/**
 * Signs out. Never throws to the UI: if the server call fails (e.g. network),
 * we still clear the local session so the user is signed out on this device.
 */
export async function signOut(): Promise<void> {
  // While the session is still valid: stop any live trip (wipes the
  // barber's position) and detach this device's push token, so a shared
  // phone never receives the previous user's notifications.
  try {
    const [{ stopAnyTripForSignOut }, { unregisterPushToken }] = await Promise.all([
      import('../barber/trip/tripService'),
      import('../shared/push'),
    ]);
    await Promise.all([stopAnyTripForSignOut(), unregisterPushToken()]);
  } catch (raw) {
    logAuthError('signOut.cleanup', raw);
  }
  // No subscription from this account may survive into the next one.
  await supabase.removeAllChannels();
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logAuthError('signOut', error);
      const local = await supabase.auth.signOut({ scope: 'local' });
      if (local.error) logAuthError('signOut.local', local.error);
    }
  } catch (raw) {
    logAuthError('signOut', raw);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (rawLocal) {
      logAuthError('signOut.local', rawLocal);
    }
  }
}

// ---------------------------------------------------------------------------
// Profile fetch (Contract B §fetchOwnProfile)
// ---------------------------------------------------------------------------

type SessionResult = { status: 'ok'; session: Session | null } | AuthFailure;

async function getSession(): Promise<SessionResult> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return mapAuthApiError('getSession', error);
  return { status: 'ok', session: data.session };
}

async function fetchProfileById(userId: string): Promise<FetchOwnProfileResult> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return mapPostgrestError('fetchOwnProfile', error);
  return { status: 'ok', profile: (data as UsersRow | null) ?? null };
}

/**
 * `select * from users where id = auth.uid()` via maybeSingle().
 * 'ok' with profile null means the row does not exist yet (deferred
 * provisioning has not run). Role comes from this row — server truth,
 * NEVER from user_metadata.
 */
export async function fetchOwnProfile(): Promise<FetchOwnProfileResult> {
  const sessionResult = await getSession();
  if (sessionResult.status === 'error') return sessionResult;
  if (!sessionResult.session) return { status: 'ok', profile: null };
  return fetchProfileById(sessionResult.session.user.id);
}

// ---------------------------------------------------------------------------
// Deferred provisioning (Contract B §ensureProfile)
// ---------------------------------------------------------------------------

/** Trimmed non-empty string, else undefined. Metadata is untrusted input. */
function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

type MetadataParse =
  | { usable: true; fields: ProvisionFields }
  | { usable: false; prefill: ProfilePrefill };

/**
 * Client-side validation of signup metadata before it is used as insert
 * input. `role` must be exactly 'customer' or 'barber' (Contract B §2);
 * `name` must be present because users.name is NOT NULL — inserting without
 * it would be a guaranteed constraint failure, so we route to the setup form
 * instead.
 */
function parseMetadata(rawMetadata: Record<string, unknown> | undefined): MetadataParse {
  const meta = rawMetadata ?? {};
  const role = isClientRole(meta.role) ? meta.role : undefined;
  const name = asOptionalString(meta.name);
  const prefill: ProfilePrefill = {
    role,
    name,
    city: asOptionalString(meta.city),
    country: asOptionalString(meta.country),
    phone: asOptionalString(meta.phone),
    bio: asOptionalString(meta.bio),
  };
  if (!role || !name) return { usable: false, prefill };
  return {
    usable: true,
    fields: {
      role,
      name,
      city: prefill.city,
      country: prefill.country,
      phone: prefill.phone,
      bio: prefill.bio,
    },
  };
}

/**
 * Ensure the barber_profile row exists for a barber user. Must run ONLY
 * after the users row is confirmed committed: the barber_profile INSERT
 * policy's has_role('barber') reads public.users. Never parallelize.
 * Returns null on success, a typed failure otherwise.
 *
 * Only user_id and bio are ever written — rating / verified /
 * verification_status belong to server defaults and the 0005 trigger.
 */
async function ensureBarberProfileRow(
  userId: string,
  bio: string | undefined
): Promise<AuthFailure | null> {
  const existing = await supabase
    .from('barber_profile')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing.error) {
    return mapPostgrestError('ensureProfile.barberProfile.select', existing.error);
  }
  if (existing.data) return null;
  const inserted = await supabase
    .from('barber_profile')
    .insert({ user_id: userId, bio: bio ?? null });
  if (inserted.error) {
    // Unique violation on user_id: another writer (a concurrent boot)
    // provisioned it first — success-of-the-other-writer.
    if (inserted.error.code === UNIQUE_VIOLATION) return null;
    return mapPostgrestError('ensureProfile.barberProfile.insert', inserted.error);
  }
  return null;
}

async function provisionForSession(
  session: Session,
  formFields: SetupFormFields | null
): Promise<EnsureProfileResult> {
  const fetched = await fetchProfileById(session.user.id);
  if (fetched.status === 'error') return fetched;

  let profile = fetched.profile;
  let bioHint: string | undefined;

  if (profile) {
    // Row exists — role is server truth from here on.
    bioHint =
      formFields?.bio ?? asOptionalString(session.user.user_metadata?.bio);
  } else {
    let fields: ProvisionFields;
    if (formFields) {
      fields = formFields;
    } else {
      const parsed = parseMetadata(session.user.user_metadata);
      if (!parsed.usable) {
        // Do NOT insert — the UI collects the fields (ensureProfileFromForm).
        return { status: 'needs_setup_form', prefill: parsed.prefill };
      }
      fields = parsed.fields;
    }
    bioHint = fields.bio;

    // Email ALWAYS from the session, never from a client text field.
    const email = session.user.email;
    if (!email) {
      logAuthError('ensureProfile', 'session has no email address');
      return failure('unknown');
    }

    // Never send created_at (server default, frozen by the 0005 trigger).
    // Never send role values outside customer/barber (TS union + runtime
    // guard + the 0005 INSERT policy whitelist).
    const inserted = await supabase
      .from('users')
      .insert({
        id: session.user.id,
        email,
        name: fields.name,
        role: fields.role,
        city: fields.city ?? null,
        country: fields.country ?? null,
        phone: fields.phone ?? null,
      })
      .select()
      .single();

    if (inserted.error) {
      if (inserted.error.code === UNIQUE_VIOLATION) {
        // users.id or users.email already taken: treat as
        // success-of-the-other-writer — re-fetch and proceed.
        const refetched = await fetchProfileById(session.user.id);
        if (refetched.status === 'error') return refetched;
        if (!refetched.profile) {
          // Unique conflict but our own row is not visible — unexpected;
          // stay in the provisioning state and let the caller retry.
          logAuthError(
            'ensureProfile',
            'unique violation on users insert but own row not found on re-fetch'
          );
          return failure('unknown');
        }
        profile = refetched.profile;
      } else {
        // 42501 maps to 'provisioning_denied' (post-0005: tampered
        // metadata); network maps to a retryable failure. Either way the
        // caller keeps the user in the provisioning state — no rollback.
        return mapPostgrestError('ensureProfile.users.insert', inserted.error);
      }
    } else {
      profile = inserted.data as UsersRow;
    }
  }

  // Second, sequential call ONLY after the users row is confirmed committed.
  if (profile.role === 'barber') {
    const barberFailure = await ensureBarberProfileRow(profile.id, bioHint);
    if (barberFailure) return barberFailure;
  }

  return { status: 'ready', profile };
}

// ---------------------------------------------------------------------------
// Legal consent (migration 0033)
// ---------------------------------------------------------------------------

/**
 * Compare the user's server-recorded consent with the current legal
 * versions. A user who consented in this app's signup or setup form but has
 * never had it recorded (the form ran before a session existed) is recorded
 * now; anyone else who is behind the current versions must accept again.
 * Run by the auth shell after provisioning returns a ready profile.
 */
export async function syncLegalConsent(
  userId: string,
  consentHint: boolean
): Promise<'current' | 'required' | AuthFailure> {
  const [versions, own] = await Promise.all([
    supabase.from('legal_current_versions').select('*').maybeSingle(),
    supabase
      .from('users')
      .select('role, accepted_terms_version, accepted_privacy_version')
      .eq('id', userId)
      .maybeSingle(),
  ]);
  if (versions.error) return mapPostgrestError('legalConsent.versions', versions.error);
  if (own.error) return mapPostgrestError('legalConsent.own', own.error);
  if (!versions.data || !own.data) return 'current'; // nothing configured to accept

  const v = versions.data as { privacy_version: string; customer_terms_version: string; barber_terms_version: string };
  const row = own.data as { role: Role | 'admin'; accepted_terms_version: string | null; accepted_privacy_version: string | null };
  const terms = row.role === 'barber' ? v.barber_terms_version : v.customer_terms_version;
  if (row.accepted_terms_version === terms && row.accepted_privacy_version === v.privacy_version) return 'current';

  const neverRecorded = row.accepted_terms_version === null && row.accepted_privacy_version === null;
  if (consentHint && neverRecorded) {
    const recorded = await acceptCurrentLegalConsent(true);
    return recorded.status === 'ok' ? 'current' : recorded;
  }
  return 'required';
}

/** Record acceptance of the current terms + privacy notice (server-stamped). */
export async function acceptCurrentLegalConsent(
  confirmedAdult: boolean
): Promise<{ status: 'ok' } | AuthFailure> {
  const { error } = await supabase.rpc('accept_current_legal_consent', { p_confirmed_adult: confirmedAdult });
  if (error) return mapPostgrestError('acceptCurrentLegalConsent', error);
  return { status: 'ok' };
}

/**
 * Idempotent deferred provisioning — call on every boot while a session
 * exists and after every successful sign-in. Safe to call repeatedly and
 * concurrently: duplicate-key races resolve as success-of-the-other-writer.
 */
export async function ensureProfile(): Promise<EnsureProfileResult> {
  const sessionResult = await getSession();
  if (sessionResult.status === 'error') return sessionResult;
  if (!sessionResult.session) return { status: 'signed_out' };
  return provisionForSession(sessionResult.session, null);
}

/**
 * Same inserts and rules as ensureProfile, but fields come from the setup
 * form (the 'needs_setup_form' path) instead of signup metadata. Role is
 * constrained to customer/barber by the TypeScript union AND re-checked at
 * runtime; email still comes from the session, never from the form.
 */
export async function ensureProfileFromForm(
  fields: SetupFormFields
): Promise<EnsureProfileResult> {
  if (!isClientRole(fields.role)) {
    logAuthError('ensureProfileFromForm', `invalid role value: ${String(fields.role)}`);
    return failure('unknown');
  }
  const name = fields.name.trim();
  const city = fields.city.trim();
  if (name.length === 0 || city.length === 0) {
    logAuthError('ensureProfileFromForm', 'empty name or city');
    return failure('unknown');
  }
  const sessionResult = await getSession();
  if (sessionResult.status === 'error') return sessionResult;
  if (!sessionResult.session) return { status: 'signed_out' };
  return provisionForSession(sessionResult.session, {
    ...fields,
    name,
    city,
    country: fields.country?.trim() || undefined,
  });
}
