/**
 * Session-driven root state machine (Contract A, build-order step 5).
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { ensureProfile, ensureProfileFromForm, signOut } from './authService';
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
  | { phase: 'authenticated'; profile: UsersRow };

export interface AuthShell {
  state: AuthShellState;
  /** Re-run ensureProfile() after a retryable provisioning failure. */
  retryProvisioning: () => void;
  /** Submit the finish-setup form ('needs_setup_form' path). */
  submitSetupForm: (fields: SetupFormFields) => Promise<EnsureProfileResult>;
  /** Real sign-out — replaces the step-4 pre-auth "exit role" behavior. */
  signOutNow: () => void;
}

export function useAuthShell(): AuthShell {
  const [restoring, setRestoring] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UsersRow | null>(null);
  const [view, setView] = useState<ProvisioningView>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

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
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          // No navigation change on refresh/update: the derived phase stays
          // stable while `profile` is cached, so navigators do not remount.
          setSession(nextSession ?? null);
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
    ensureProfile().then((result) => {
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

  const state: AuthShellState = useMemo(() => {
    if (restoring) return { phase: 'restoring' };
    if (session === null) return { phase: 'unauthenticated' };
    if (profile !== null) return { phase: 'authenticated', profile };
    return { phase: 'provisioning', view };
  }, [restoring, session, profile, view]);

  return { state, retryProvisioning, submitSetupForm, signOutNow };
}
