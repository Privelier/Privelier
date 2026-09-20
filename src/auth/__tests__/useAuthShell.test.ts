/**
 * Tests for the session-driven root state machine (src/auth/useAuthShell.ts,
 * Contract A). Both `lib/supabase` and `./authService` are mocked — this
 * exercises the state machine in isolation from any real network call.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { UsersRow } from '../../types';
import { supabase } from '../../../lib/supabase';
import { ensureProfile, ensureProfileFromForm, signOut } from '../authService';
import { useAuthShell } from '../useAuthShell';
import { checkLocationEligibility } from '../../location/locationEligibility';

type AuthChangeCallback = (event: string, session: Session | null) => void;

// babel-plugin-jest-hoist hoists both calls above the imports above at
// transform time, so the mocks are in place before useAuthShell.ts (and this
// file) ever evaluate the real modules.
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));
jest.mock('../authService');
jest.mock('../../location/locationEligibility', () => ({
  checkLocationEligibility: jest.fn(),
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockEnsureProfile = ensureProfile as jest.Mock;
const mockEnsureProfileFromForm = ensureProfileFromForm as jest.Mock;
const mockSignOut = signOut as jest.Mock;
const mockCheckLocation = checkLocationEligibility as jest.Mock;
const eligibleLocation = { status: 'eligible' as const, city: 'Nuremberg' as const, country: 'Germany' as const };

let authChangeCallback: AuthChangeCallback = () => {};
let onStateChange: (state: AppStateStatus) => void = () => {};
const unsubscribe = jest.fn();
const mockAddAppStateListener = jest.spyOn(AppState, 'addEventListener');

function makeSession(userId: string, accessToken = 'token-1'): Session {
  return {
    user: { id: userId, email: `${userId}@example.com`, user_metadata: {} },
    access_token: accessToken,
  } as unknown as Session;
}

function makeProfile(overrides: Partial<UsersRow> = {}): UsersRow {
  return {
    id: 'user-1',
    name: 'Alex',
    email: 'user-1@example.com',
    phone: null,
    role: 'customer',
    city: 'Nuremberg',
    country: 'Germany',
    profile_image: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Resolves getSession with the given initial session (defaults to null). */
function primeInitialSession(session: Session | null = null) {
  mockGetSession.mockResolvedValue({ data: { session } });
}

let activeUnmount: (() => void) | null = null;

/** renderHook() wrapper that tracks its unmount fn for automatic teardown. */
async function renderShell() {
  const rendered = await renderHook(() => useAuthShell());
  activeUnmount = rendered.unmount;
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  onStateChange = () => {};
  mockAddAppStateListener.mockImplementation((_event, listener) => {
    onStateChange = listener;
    return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
  });
  mockCheckLocation.mockResolvedValue(eligibleLocation);
  authChangeCallback = () => {};
  mockOnAuthStateChange.mockImplementation((callback: AuthChangeCallback) => {
    authChangeCallback = callback;
    return { data: { subscription: { unsubscribe } } };
  });
  // Default: ensureProfile never resolves unless a test configures it —
  // avoids unhandled-rejection noise in tests that don't reach provisioning.
  mockEnsureProfile.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  // Explicitly unmount the previous test's tree so a lingering subscription
  // / pending effect can never bleed into the next test's fresh render.
  activeUnmount?.();
  activeUnmount = null;
});

describe('initial restoring -> unauthenticated / provisioning', () => {
  it('starts in the restoring phase', async () => {
    // A getSession() that never resolves keeps the hook in 'restoring'
    // indefinitely, so we can reliably observe that initial phase.
    mockGetSession.mockImplementation(() => new Promise(() => {}));
    const { result } = await renderShell();
    expect(result.current.state.phase).toBe('restoring');
  });

  it('moves to unauthenticated when getSession resolves with no session', async () => {
    primeInitialSession(null);
    const { result } = await renderShell();

    await waitFor(() => expect(result.current.state.phase).toBe('unauthenticated'));
    expect(mockEnsureProfile).not.toHaveBeenCalled();
    expect(mockCheckLocation).toHaveBeenCalledTimes(1);
  });

  it('moves to provisioning (loading) when getSession resolves with a session', async () => {
    const session = makeSession('user-1');
    primeInitialSession(session);
    const { result } = await renderShell();

    await waitFor(() => expect(result.current.state.phase).toBe('location_gate'));
    if (result.current.state.phase === 'location_gate') {
      expect(result.current.state.view).toEqual({ kind: 'checking' });
    }
    await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalledWith(eligibleLocation));
  });
});

describe('foreground location gate', () => {
  it.each(['permission_denied', 'unavailable', 'outside_service_area'] as const)(
    'blocks a restored session on %s before provisioning',
    async (status) => {
      primeInitialSession(makeSession('user-1'));
      mockCheckLocation.mockResolvedValue({ status });

      const { result } = await renderShell();
      await waitFor(() => {
        expect(result.current.state).toEqual({
          phase: 'location_gate',
          view: { kind: 'blocked', reason: { status } },
        });
      });
      expect(mockEnsureProfile).not.toHaveBeenCalled();
    }
  );

  it('waits for a current check before loading an existing profile', async () => {
    primeInitialSession(makeSession('user-1'));
    let completeCheck: (value: typeof eligibleLocation) => void = () => {};
    mockCheckLocation.mockImplementation(() => new Promise((resolve) => { completeCheck = resolve; }));
    mockEnsureProfile.mockResolvedValue({ status: 'ready', profile: makeProfile() });

    const { result } = await renderShell();
    await waitFor(() => expect(mockCheckLocation).toHaveBeenCalledTimes(1));
    expect(result.current.state.phase).toBe('location_gate');
    expect(mockEnsureProfile).not.toHaveBeenCalled();

    await act(async () => completeCheck(eligibleLocation));
    await waitFor(() => expect(result.current.state.phase).toBe('authenticated'));
    expect(mockEnsureProfile).toHaveBeenCalledWith(eligibleLocation);
  });

  it('retries outside Nuremberg and enters only after a new eligible reading', async () => {
    primeInitialSession(makeSession('user-1'));
    mockCheckLocation.mockResolvedValueOnce({ status: 'outside_service_area' });
    mockEnsureProfile.mockResolvedValue({ status: 'ready', profile: makeProfile() });

    const { result } = await renderShell();
    await waitFor(() => {
      if (result.current.state.phase !== 'location_gate') throw new Error('expected location gate');
      expect(result.current.state.view.kind).toBe('blocked');
    });
    expect(mockEnsureProfile).not.toHaveBeenCalled();

    await act(() => result.current.retryLocation());
    await waitFor(() => expect(result.current.state.phase).toBe('authenticated'));
    expect(mockCheckLocation).toHaveBeenCalledTimes(2);
    expect(mockEnsureProfile).toHaveBeenCalledWith(eligibleLocation);
  });

  it('keeps password recovery ahead of an unavailable location', async () => {
    primeInitialSession(null);
    mockCheckLocation.mockResolvedValue({ status: 'permission_denied' });
    const { result } = await renderShell();
    await waitFor(() => expect(result.current.state.phase).toBe('location_gate'));

    await act(() => authChangeCallback('PASSWORD_RECOVERY', makeSession('user-1')));
    expect(result.current.state).toEqual({ phase: 'password_recovery', view: 'ready' });

    await act(() => result.current.finishPasswordRecovery());
    await waitFor(() => {
      expect(result.current.state).toEqual({
        phase: 'location_gate',
        view: { kind: 'blocked', reason: { status: 'permission_denied' } },
      });
    });
    expect(mockEnsureProfile).not.toHaveBeenCalled();
  });

  it('hides an authenticated shell on background and rechecks on return', async () => {
    primeInitialSession(makeSession('user-1'));
    mockEnsureProfile.mockResolvedValue({ status: 'ready', profile: makeProfile() });
    const { result } = await renderShell();
    await waitFor(() => expect(result.current.state.phase).toBe('authenticated'));

    mockCheckLocation.mockResolvedValueOnce({ status: 'outside_service_area' });
    await act(() => onStateChange('background'));
    expect(result.current.state.phase).toBe('location_gate');
    await act(() => onStateChange('active'));
    await waitFor(() => {
      expect(result.current.state).toEqual({
        phase: 'location_gate',
        view: { kind: 'blocked', reason: { status: 'outside_service_area' } },
      });
    });
    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);
  });

  it('ignores a location result from before sign-out', async () => {
    primeInitialSession(makeSession('user-1'));
    mockEnsureProfile.mockResolvedValue({ status: 'ready', profile: makeProfile() });
    const { result } = await renderShell();
    await waitFor(() => expect(result.current.state.phase).toBe('authenticated'));

    let finishOldCheck: (value: { status: 'outside_service_area' }) => void = () => {};
    mockCheckLocation.mockImplementationOnce(() => new Promise((resolve) => { finishOldCheck = resolve; }));
    await act(() => onStateChange('background'));
    await act(() => onStateChange('active'));
    await waitFor(() => expect(mockCheckLocation).toHaveBeenCalledTimes(2));

    await act(() => authChangeCallback('SIGNED_OUT', null));
    await waitFor(() => expect(result.current.state.phase).toBe('unauthenticated'));

    await act(async () => finishOldCheck({ status: 'outside_service_area' }));
    expect(result.current.state.phase).toBe('unauthenticated');
    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);
  });
});

describe('ensureProfile result handling', () => {
  it('"ready" moves the phase to authenticated with the returned profile', async () => {
    const session = makeSession('user-1');
    primeInitialSession(session);
    const profile = makeProfile();
    mockEnsureProfile.mockResolvedValue({ status: 'ready', profile });

    const { result } = await renderShell();

    await waitFor(() => expect(result.current.state.phase).toBe('authenticated'));
    expect(result.current.state).toEqual({ phase: 'authenticated', profile });
  });

  it('"needs_setup_form" surfaces as provisioning with view.kind === "setup_form"', async () => {
    const session = makeSession('user-1');
    primeInitialSession(session);
    const prefill = { role: 'customer' as const, name: undefined };
    mockEnsureProfile.mockResolvedValue({ status: 'needs_setup_form', prefill });

    const { result } = await renderShell();

    await waitFor(() => {
      expect(result.current.state.phase).toBe('provisioning');
      if (result.current.state.phase === 'provisioning') {
        expect(result.current.state.view).toEqual({ kind: 'setup_form', prefill });
      }
    });
  });
});

describe('remount stability: TOKEN_REFRESHED / USER_UPDATED', () => {
  async function getToAuthenticated() {
    const session = makeSession('user-1', 'token-1');
    primeInitialSession(session);
    const profile = makeProfile();
    mockEnsureProfile.mockResolvedValue({ status: 'ready', profile });

    const { result } = await renderShell();
    await waitFor(() => expect(result.current.state.phase).toBe('authenticated'));
    return { result, profile };
  }

  it('does not change the phase once authenticated, and does not re-trigger ensureProfile', async () => {
    const { result } = await getToAuthenticated();
    const stateBefore = result.current.state;
    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);

    await act(() => {
      authChangeCallback('TOKEN_REFRESHED', makeSession('user-1', 'token-2'));
    });

    expect(result.current.state.phase).toBe('authenticated');
    if (result.current.state.phase === 'authenticated' && stateBefore.phase === 'authenticated') {
      // Same cached profile object — no re-fetch happened.
      expect(result.current.state.profile).toBe(stateBefore.profile);
    }
    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);

    await act(() => {
      authChangeCallback('USER_UPDATED', makeSession('user-1', 'token-3'));
    });

    expect(result.current.state.phase).toBe('authenticated');
    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);
  });

  it('a TOKEN_REFRESHED with the same user id but a new session object does not re-trigger ensureProfile', async () => {
    const { result } = await getToAuthenticated();
    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);

    // Same user id, brand-new session object (new access token) — the
    // ensureProfile effect is keyed on userId + profile, not the session
    // object, precisely to avoid this re-triggering a refetch.
    await act(() => {
      authChangeCallback('TOKEN_REFRESHED', makeSession('user-1', 'brand-new-token'));
    });

    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe('authenticated');
  });
});

describe('SIGNED_OUT', () => {
  it('clears session/profile/view back to a state that resolves to unauthenticated', async () => {
    const session = makeSession('user-1');
    primeInitialSession(session);
    const profile = makeProfile();
    mockEnsureProfile.mockResolvedValue({ status: 'ready', profile });

    const { result } = await renderShell();
    await waitFor(() => expect(result.current.state.phase).toBe('authenticated'));

    await act(() => {
      authChangeCallback('SIGNED_OUT', null);
    });

    expect(result.current.state.phase).toBe('unauthenticated');
  });

  it('restarts the gate even if a link error is dismissed without a cached session', async () => {
    primeInitialSession(null);
    const { result } = await renderShell();
    await waitFor(() => expect(result.current.state.phase).toBe('unauthenticated'));

    await act(() => authChangeCallback('SIGNED_OUT', null));
    await waitFor(() => expect(mockCheckLocation).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.state.phase).toBe('unauthenticated'));
  });
});

describe('retryProvisioning', () => {
  it('resets the view to loading and re-triggers ensureProfile', async () => {
    const session = makeSession('user-1');
    primeInitialSession(session);
    mockEnsureProfile.mockResolvedValueOnce({
      status: 'error',
      code: 'network',
      message: 'We could not reach the server. Check your connection and try again.',
      retryable: true,
    });

    const { result } = await renderShell();
    await waitFor(() => {
      expect(result.current.state.phase).toBe('provisioning');
      if (result.current.state.phase === 'provisioning') {
        expect(result.current.state.view.kind).toBe('failure');
      }
    });
    expect(mockEnsureProfile).toHaveBeenCalledTimes(1);

    // Second call hangs so we can observe the loading view synchronously.
    mockEnsureProfile.mockImplementationOnce(() => new Promise(() => {}));

    await act(() => {
      result.current.retryProvisioning();
    });

    expect(result.current.state.phase).toBe('location_gate');
    if (result.current.state.phase === 'location_gate') {
      expect(result.current.state.view).toEqual({ kind: 'checking' });
    }
    await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalledTimes(2));
  });
});

describe('signOutNow', () => {
  it('delegates to authService.signOut', async () => {
    primeInitialSession(null);
    mockSignOut.mockResolvedValue(undefined);
    const { result } = await renderShell();
    await waitFor(() => expect(result.current.state.phase).toBe('unauthenticated'));

    await act(() => {
      result.current.signOutNow();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('submitSetupForm', () => {
  it('applies a "ready" result from ensureProfileFromForm, moving the phase to authenticated', async () => {
    const session = makeSession('user-1');
    primeInitialSession(session);
    const prefill = { role: 'customer' as const, name: undefined };
    mockEnsureProfile.mockResolvedValue({ status: 'needs_setup_form', prefill });

    const { result } = await renderShell();
    await waitFor(() => {
      expect(result.current.state.phase).toBe('provisioning');
    });

    const profile = makeProfile();
    mockEnsureProfileFromForm.mockResolvedValue({ status: 'ready', profile });

    await act(async () => {
      await result.current.submitSetupForm({ role: 'customer', name: 'Alex' });
    });

    expect(result.current.state).toEqual({ phase: 'authenticated', profile });
    expect(mockEnsureProfileFromForm).toHaveBeenCalledWith({ role: 'customer', name: 'Alex' }, eligibleLocation);
  });
});
