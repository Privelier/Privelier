/**
 * Session-driven root state machine (Contract A, build-order step 5).
 *
 * Drives the single root switch in App.tsx over session, foreground location,
 * and profile row. Neither role navigator mounts without a current eligible fix.
 *
 * Binding rules implemented here:
 * - onAuthStateChange is subscribed ONCE and unsubscribed on unmount.
 * - The callback performs SYNCHRONOUS state updates only — never awaits
 *   supabase calls (known supabase-js deadlock). ensureProfile() runs in an
 *   effect reacting to state instead.
 * - SIGNED_OUT clears ALL cached profile state.
 * - TOKEN_REFRESHED / USER_UPDATED update the session object without
 *   triggering a location check or remounting an authenticated navigator.
 * - Routing authority is public.users.role from ensureProfile's returned
 *   profile — never user_metadata, never which auth screen was used.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { ensureProfile, ensureProfileFromForm, signOut } from './authService';
import { applyAuthCallbackUrl, isPasswordRecoveryUrl } from './deepLink';
import type { AuthFailure } from './errors';
import type { EnsureProfileResult, ProfilePrefill, SetupFormFields } from './types';
import type { UsersRow } from '../types';
import { checkLocationEligibility, type LocationEligibility } from '../location/locationEligibility';
import { nativeLocationGateway } from '../location/nativeLocationGateway';

/** What the PROVISIONING phase is currently showing. */
export type ProvisioningView =
  | { kind: 'loading' }
  | { kind: 'setup_form'; prefill: ProfilePrefill }
  | { kind: 'failure'; failure: AuthFailure };

export type AuthShellState =
  | { phase: 'restoring' }
  | { phase: 'location_gate'; view: { kind: 'checking' } | { kind: 'blocked'; reason: Exclude<LocationEligibility, { status: 'eligible' }> } }
  | { phase: 'unauthenticated' }
  | { phase: 'provisioning'; view: ProvisioningView }
  | { phase: 'password_recovery'; view: 'opening' | 'ready' | 'expired' | 'error' }
  | { phase: 'auth_link_error'; view: 'expired' | 'error' }
  | { phase: 'authenticated'; profile: UsersRow };

export interface AuthShell {
  state: AuthShellState;
  retryLocation: () => void;
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
  const [location, setLocation] = useState<LocationEligibility | null>(null);
  const [locationAttempt, setLocationAttempt] = useState(0);
  const locationCheck = useRef(0);
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
          locationCheck.current += 1;
          setLocation(null);
          setLocationAttempt((current) => current + 1);
          setSession(null);
          setProfile(null);
          setView({ kind: 'loading' });
          setRestoring(false);
          break;
        case 'INITIAL_SESSION':
          locationCheck.current += 1;
          setLocation(null);
          setLocationAttempt((current) => current + 1);
          setSession(nextSession ?? null);
          setRestoring(false);
          break;
        case 'SIGNED_IN':
          locationCheck.current += 1;
          setLocation(null);
          setSession(nextSession ?? null);
          setLocationAttempt((current) => current + 1);
          break;
        case 'TOKEN_REFRESHED':
        case 'USER_UPDATED':
          // No navigation change on refresh/update: the derived phase stays
          // stable while `profile` is cached, so navigators do not remount.
          setSession(nextSession ?? null);
          break;
        case 'PASSWORD_RECOVERY':
          locationCheck.current += 1;
          setLocation(null);
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
        setLocation(null);
        setView({ kind: 'loading' });
        break;
      case 'error':
        setProfile(null);
        setView({ kind: 'failure', failure: result });
        break;
    }
  }, []);

  // One current foreground check gates both auth entry and profile reads.
  // A new user id, retry, or foreground return starts a fresh check; token
  // refreshes preserve the mounted app shell.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (restoring) return;
    const checkId = ++locationCheck.current;
    let active = true;
    void (async () => {
      const result = await checkLocationEligibility(nativeLocationGateway);
      if (!active || checkId !== locationCheck.current) return;
      if (result.status === 'eligible' && userId !== null) {
        setView({ kind: 'loading' });
        const profileResult = await ensureProfile(result);
        if (!active || checkId !== locationCheck.current) return;
        applyEnsureResult(profileResult);
      }
      setLocation(result);
    })();
    return () => {
      active = false;
      locationCheck.current += 1;
    };
  }, [restoring, userId, locationAttempt, applyEnsureResult]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setLocation(null);
        setLocationAttempt((current) => current + 1);
      } else {
        locationCheck.current += 1;
        setLocation(null);
      }
    });
    return () => subscription.remove();
  }, []);

  const retryLocation = useCallback(() => {
    locationCheck.current += 1;
    setLocation(null);
    setLocationAttempt((current) => current + 1);
  }, []);

  const retryProvisioning = useCallback(() => {
    setView({ kind: 'loading' });
    retryLocation();
  }, [retryLocation]);

  const submitSetupForm = useCallback(
    async (fields: SetupFormFields): Promise<EnsureProfileResult> => {
      const currentLocation = await checkLocationEligibility(nativeLocationGateway);
      if (currentLocation.status !== 'eligible') {
        setLocation(currentLocation);
        return { status: 'error', code: 'unknown', message: 'Your location could not be confirmed.', retryable: true };
      }
      const result = await ensureProfileFromForm(fields, currentLocation);
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
    retryLocation();
  }, [retryLocation]);
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
    if (location === null) return { phase: 'location_gate', view: { kind: 'checking' } };
    if (location.status !== 'eligible') return { phase: 'location_gate', view: { kind: 'blocked', reason: location } };
    if (session === null) return { phase: 'unauthenticated' };
    if (profile !== null) return { phase: 'authenticated', profile };
    return { phase: 'provisioning', view };
  }, [restoring, session, profile, view, passwordRecovery, authLinkError, location]);

  return { state, retryLocation, retryProvisioning, submitSetupForm, signOutNow, finishPasswordRecovery, dismissPasswordRecovery, dismissAuthLinkError };
}
