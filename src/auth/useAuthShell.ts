/**
 * Session-driven root state machine (Contract A).
 *
 * Drives the single root switch in App.tsx over (session, profileRow):
 *   RESTORING → UNAUTHENTICATED | PROVISIONING → AUTHENTICATED
 *
 * Binding rules implemented here:
 * - onAuthStateChange is subscribed ONCE and unsubscribed on unmount.
 * - The callback performs SYNCHRONOUS state updates only — never awaits
 *   supabase calls (known supabase-js deadlock). ensureProfile() runs in an
 *   effect reacting to state instead.
 * - SIGNED_OUT clears ALL cached profile state.
 * - TOKEN_REFRESHED / USER_UPDATED update the session object but cannot
 *   change the derived phase while a profile row is cached, so the root
 *   switch keeps rendering the same element types — navigators never remount.
 * - Routing authority is public.users.role from ensureProfile's returned
 *   profile — never user_metadata, never which auth screen was used.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { acceptCurrentLegalConsent, ensureProfile, ensureProfileFromForm, signOut, syncLegalConsent } from './authService';
import type { LegalConsentView } from './screens/LegalConsentGateScreen';
import { applyAuthCallbackUrl, isOAuthSessionActive } from './deepLink';
import { failure, type AuthFailure } from './errors';
import type { EnsureProfileResult, ProfilePrefill, SetupFormFields } from './types';
import type { UsersRow } from '../types';

/** What the PROVISIONING phase is currently showing. */
export type ProvisioningView =
  | { kind: 'loading' }
  | { kind: 'setup_form'; prefill: ProfilePrefill }
  | { kind: 'failure'; failure: AuthFailure };

export type AuthShellState =
  | { phase: 'restoring' }
  | { phase: 'unauthenticated' }
  | { phase: 'provisioning'; view: ProvisioningView }
  | { phase: 'password_recovery'; view: 'opening' | 'ready' | 'expired' | 'error' }
  | { phase: 'auth_link_error'; view: 'expired' | 'error' }
  | { phase: 'legal_consent'; profile: UsersRow; view: LegalConsentView }
  | { phase: 'authenticated'; profile: UsersRow };

export interface AuthShell {
  state: AuthShellState;
  /** Re-run ensureProfile() after a retryable provisioning failure. */
  retryProvisioning: () => void;
  /** Submit the finish-setup form ('needs_setup_form' path). */
  submitSetupForm: (fields: SetupFormFields) => Promise<EnsureProfileResult>;
  /** Real sign-out. */
  signOutNow: () => void;
  finishPasswordRecovery: () => void;
  dismissPasswordRecovery: () => void;
  dismissAuthLinkError: () => void;
  /** Record acceptance of the current legal versions; resolves to an error message or null. */
  acceptLegalConsent: (confirmedAdult: boolean) => Promise<string | null>;
  retryLegalConsent: () => void;
}

export function useAuthShell(): AuthShell {
  const [restoring, setRestoring] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UsersRow | null>(null);
  const [view, setView] = useState<ProvisioningView>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [passwordRecovery, setPasswordRecovery] = useState<'opening' | 'ready' | 'expired' | 'error' | null>(null);
  const [authLinkError, setAuthLinkError] = useState<'expired' | 'error' | null>(null);
  // Consent is checked once per signed-in profile, after provisioning.
  // 'current' is the only state that lets the role navigators mount.
  const [consent, setConsent] = useState<LegalConsentView | { kind: 'current' }>({ kind: 'checking' });
  const [consentAttempt, setConsentAttempt] = useState(0);
  // The finish-setup form's own consent boxes, for a profile created there.
  const formConsentRef = useRef(false);

  // Single top-level subscription + initial session restore (encrypted
  // SecureStore-backed storage inside the supabase client).
  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => data.session ?? null)
      // A failed restore must never leave the app on the splash screen.
      .catch(() => null)
      .then((restored) => {
        if (!active) return;
        setSession(restored);
        setRestoring(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Synchronous state updates ONLY in this callback.
      switch (event) {
        case 'SIGNED_OUT':
          setSession(null);
          setProfile(null);
          setConsent({ kind: 'checking' });
          formConsentRef.current = false;
          setView({ kind: 'loading' });
          setRestoring(false);
          break;
        case 'INITIAL_SESSION':
          setSession(nextSession ?? null);
          setRestoring(false);
          break;
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          // No navigation change on refresh/update: the derived phase stays
          // stable while `profile` is cached, so navigators do not remount.
          setSession(nextSession ?? null);
          break;
        case 'PASSWORD_RECOVERY':
          setSession(nextSession ?? null);
          setPasswordRecovery('ready');
          break;
        default:
          break;
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Auth deep links (email confirmation, password recovery) land here:
  // applyAuthCallbackUrl exchanges the PKCE code, which fires the
  // onAuthStateChange subscription above (SIGNED_IN or PASSWORD_RECOVERY)
  // like any other sign-in. Handles both a cold start via the link
  // (getInitialURL) and the app already running (the 'url' event). OAuth
  // redirects are left to signInWithProvider while its browser is open.
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (isOAuthSessionActive()) return;
      const outcome = await applyAuthCallbackUrl(url);
      if (outcome === 'recovery_applied') setPasswordRecovery('ready');
      else if (outcome === 'expired_or_used') setAuthLinkError('expired');
      else if (outcome === 'error') setAuthLinkError('error');
    };
    Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });
    return () => subscription.remove();
  }, []);

  const applyEnsureResult = useCallback((result: EnsureProfileResult) => {
    switch (result.status) {
      case 'ready':
        setProfile(result.profile);
        break;
      case 'needs_setup_form':
        setView({ kind: 'setup_form', prefill: result.prefill });
        break;
      case 'signed_out':
        // Session vanished mid-flight; SIGNED_OUT will usually also fire,
        // but clear defensively either way.
        setSession(null);
        setProfile(null);
        setView({ kind: 'loading' });
        break;
      case 'error':
        setView({ kind: 'failure', failure: result });
        break;
    }
  }, []);

  // PROVISIONING: run ensureProfile() via an effect reacting to state —
  // never from inside the onAuthStateChange callback. Keyed on the user id
  // (not the session object) so token refreshes do not re-trigger it.
  // The view is already 'loading' whenever a provisioning cycle begins: it is
  // the initial value, SIGNED_OUT resets it, and retryProvisioning resets it
  // in the event handler — so the effect body never calls setState directly.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (restoring || userId === null || profile !== null) return;
    let cancelled = false;
    ensureProfile()
      // An unexpected throw shows the retryable failure, not an endless spinner.
      .catch(() => failure('network'))
      .then((result) => {
        if (!cancelled) applyEnsureResult(result);
      });
    return () => {
      cancelled = true;
    };
  }, [restoring, userId, profile, attempt, applyEnsureResult]);

  const retryProvisioning = useCallback(() => {
    setView({ kind: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  const submitSetupForm = useCallback(
    async (fields: SetupFormFields): Promise<EnsureProfileResult> => {
      formConsentRef.current = fields.legalConsent === true;
      const result = await ensureProfileFromForm(fields);
      // Success and signed-out flip the phase; failures stay inline in the
      // form (the form renders result.message itself), so the user never
      // loses what they typed.
      if (result.status === 'ready' || result.status === 'signed_out') {
        applyEnsureResult(result);
      }
      return result;
    },
    [applyEnsureResult]
  );

  const signOutNow = useCallback(() => {
    // signOut() never throws; the SIGNED_OUT event clears all cached state.
    void signOut();
  }, []);

  // LEGAL CONSENT: once a profile is ready, compare its recorded consent with
  // the current versions (and record signup/setup consent not yet stored).
  const metadataConsent = session?.user.user_metadata?.legal_consent === true;
  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (profileId === null || consent.kind !== 'checking') return;
    let cancelled = false;
    syncLegalConsent(profileId, formConsentRef.current || metadataConsent)
      .catch(() => failure('network'))
      .then((result) => {
        if (cancelled) return;
        if (result === 'current') setConsent({ kind: 'current' });
        else if (result === 'required') setConsent({ kind: 'required' });
        else setConsent({ kind: 'failure', message: result.message });
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, consent.kind, consentAttempt, metadataConsent]);

  const acceptLegalConsent = useCallback(async (confirmedAdult: boolean) => {
    const result = await acceptCurrentLegalConsent(confirmedAdult);
    if (result.status === 'ok') {
      setConsent({ kind: 'current' });
      return null;
    }
    return result.message;
  }, []);

  const retryLegalConsent = useCallback(() => {
    setConsent({ kind: 'checking' });
    setConsentAttempt((current) => current + 1);
  }, []);

  const finishPasswordRecovery = useCallback(() => setPasswordRecovery(null), []);
  const dismissPasswordRecovery = useCallback(() => {
    setPasswordRecovery(null);
    void signOut();
  }, []);
  const dismissAuthLinkError = useCallback(() => {
    setAuthLinkError(null);
    void signOut();
  }, []);

  const state: AuthShellState = useMemo(() => {
    if (restoring) return { phase: 'restoring' };
    if (passwordRecovery) return { phase: 'password_recovery', view: passwordRecovery };
    if (authLinkError) return { phase: 'auth_link_error', view: authLinkError };
    if (session === null) return { phase: 'unauthenticated' };
    if (profile !== null) {
      return consent.kind === 'current'
        ? { phase: 'authenticated', profile }
        : { phase: 'legal_consent', profile, view: consent };
    }
    return { phase: 'provisioning', view };
  }, [restoring, session, profile, view, passwordRecovery, authLinkError, consent]);

  return { state, retryProvisioning, submitSetupForm, signOutNow, finishPasswordRecovery, dismissPasswordRecovery, dismissAuthLinkError, acceptLegalConsent, retryLegalConsent };
}
