/**
 * Tests for the session-driven root state machine (src/auth/useAuthShell.ts,
 * Contract A). Both `lib/supabase` and `./authService` are mocked — this
 * exercises the state machine in isolation from any real network call.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import type { UsersRow } from '../../types';
import { supabase } from '../../../lib/supabase';
import { ensureProfile, ensureProfileFromForm, signOut } from '../authService';
import { useAuthShell } from '../useAuthShell';

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

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockEnsureProfile = ensureProfile as jest.Mock;
const mockEnsureProfileFromForm = ensureProfileFromForm as jest.Mock;
const mockSignOut = signOut as jest.Mock;

let authChangeCallback: AuthChangeCallback = () => {};
const unsubscribe = jest.fn();

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
    city: 'Lisbon',
    country: null,
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
  });

  it('moves to provisioning (loading) when getSession resolves with a session', async () => {
    const session = makeSession('user-1');
    primeInitialSession(session);
    const { result } = await renderShell();

    await waitFor(() => expect(result.current.state.phase).toBe('provisioning'));
    if (result.current.state.phase === 'provisioning') {
      expect(result.current.state.view).toEqual({ kind: 'loading' });
    }
    await waitFor(() => expect(mockEnsureProfile).toHaveBeenCalledTimes(1));
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

    expect(result.current.state.phase).toBe('provisioning');
    if (result.current.state.phase === 'provisioning') {
      expect(result.current.state.view).toEqual({ kind: 'loading' });
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
      await result.current.submitSetupForm({ role: 'customer', name: 'Alex', city: 'Lisbon' });
    });

    expect(result.current.state).toEqual({ phase: 'authenticated', profile });
  });
});
