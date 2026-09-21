/**
 * Session-driven root state machine (Contract A, build-order step 5).
 *
 * Drives the single root switch in App.tsx over the session and profile row.
 *
 * Binding rules implemented here:
 * - onAuthStateChange is subscribed ONCE and unsubscribed on unmount.
 * - The callback performs SYNCHRONOUS state updates only — never awaits
 *   supabase calls (known supabase-js deadlock). ensureProfile() runs in an
 *   effect reacting to state instead.
 * - SIGNED_OUT clears ALL cached profile state.
 * - TOKEN_REFRESHED / USER_UPDATED update the session object without
 *   remounting an authenticated navigator.
 * - Routing authority is public.users.role from ensureProfile's returned
 *   profile — never user_metadata, never which auth screen was used.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { ensureProfile, ensureProfileFromForm, signOut } from './authService';
import { applyAuthCallbackUrl, isPasswordRecoveryUrl } from './deepLink';
import type { AuthFailure } from './errors';
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
  | { phase: 'authenticated'; profile: UsersRow };

export interface AuthShell {
  state: AuthShellState;
  /** Re-run ensureProfile() after a retryable provisioning failure. */
  retryProvisioning: () => void;
  /** Submit the finish-setup form ('needs_setup_form' path). */
  submitSetupForm: (fields: SetupFormFields) => Promise<EnsureProfileResult>;
  /** Real sign-out — replaces the step-4 pre-auth "exit role" behavior. */
  signOutNow: () => void;
  finishPasswordRecovery: () => void;
  dismissPasswordRecovery: () => void;
  dismissAuthLinkError: () => void;
}

export function useAuthShell(): AuthShell {
  const [restoring, setRestoring] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UsersRow | null>(null);
  const [view, setView] = useState<ProvisioningView>({ kind: 'loading' });
  const [passwordRecovery, setPasswordRecovery] = useState<'opening' | 'ready' | 'expired' | 'error' | null>(null);
  const [authLinkError, setAuthLinkError] = useState<'expired' | 'error' | null>(null);

  // Single top-level subscription + initial session restore (encrypted
  // SecureStore-backed storage inside the supabase client).
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setRestoring(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Synchronous state updates ONLY in this callback.
      switch (event) {
        case 'SIGNED_OUT':
          setSession(null);
          setProfile(null);
          setView({ kind: 'loading' });
          setRestoring(false);
          break;
        case 'INITIAL_SESSION':
          setSession(nextSession ?? null);
          setRestoring(false);
          break;
        case 'SIGNED_IN':
          setSession(nextSession ?? null);
          break;
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

  // Auth deep links (email confirmation) land here: applyAuthCallbackUrl
  // calls setSession(), which fires the onAuthStateChange subscription above
  // like any other sign-in — no separate state wiring needed. Handles both
  // a cold start via the link (getInitialURL) and the app already running
  // (the 'url' event).
  useEffect(() => {
    const handleUrl = async (url: string) => {
      const isRecovery = isPasswordRecoveryUrl(url);
      if (isRecovery) setPasswordRecovery('opening');
      const outcome = await applyAuthCallbackUrl(url);
      if (outcome === 'recovery_applied') setPasswordRecovery('ready');
      else if (outcome === 'expired_or_used') {
        if (isRecovery) setPasswordRecovery('expired');
        else setAuthLinkError('expired');
      } else if (outcome === 'error') {
        if (isRecovery) setPasswordRecovery('error');
        else setAuthLinkError('error');
      }
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
        setProfile(null);
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
        setProfile(null);
        setView({ kind: 'failure', failure: result });
        break;
    }
  }, []);

  // Provision once per signed-in user. Token refreshes preserve the mounted
  // app shell because this effect keys on user id rather than session object.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (restoring || userId === null) return;
    let active = true;
    void (async () => {
      setView({ kind: 'loading' });
      const profileResult = await ensureProfile();
      if (!active) return;
      applyEnsureResult(profileResult);
    })();
    return () => {
      active = false;
    };
  }, [restoring, userId, applyEnsureResult]);

  const retryProvisioning = useCallback(() => {
    setView({ kind: 'loading' });
    void ensureProfile().then(applyEnsureResult);
  }, [applyEnsureResult]);

  const submitSetupForm = useCallback(
    async (fields: SetupFormFields): Promise<EnsureProfileResult> => {
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

  const finishPasswordRecovery = useCallback(() => {
    setPasswordRecovery(null);
  }, []);
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
    if (profile !== null) return { phase: 'authenticated', profile };
    return { phase: 'provisioning', view };
  }, [restoring, session, profile, view, passwordRecovery, authLinkError]);

  return { state, retryProvisioning, submitSetupForm, signOutNow, finishPasswordRecovery, dismissPasswordRecovery, dismissAuthLinkError };
}
