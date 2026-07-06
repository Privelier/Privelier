/**
 * Unit/integration tests for the auth + deferred-profile-provisioning data
 * layer (src/auth/authService.ts). The Supabase client (`lib/supabase.ts`) is
 * mocked entirely — these tests never touch a real network or database.
 */
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import {
  ensureProfile,
  ensureProfileFromForm,
  resendConfirmation,
  signIn,
  signOut,
  signUpBarber,
  signUpCustomer,
} from '../authService';
import type { SetupFormFields } from '../types';

// babel-plugin-jest-hoist hoists this above the imports above at transform
// time, so the mock is in place before authService.ts (and this file) ever
// evaluate the real `../../../lib/supabase` module.
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resend: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

// deepLink.ts calls expo-linking's createURL(), which needs a real app
// manifest (app.json scheme) to resolve — unavailable in the Jest
// environment. authService only cares that it gets *some* stable string to
// pass through as emailRedirectTo, not expo-linking's own behavior.
jest.mock('../deepLink', () => ({
  getEmailRedirectTo: jest.fn(() => 'privelier://auth-callback'),
}));

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Test helpers: a minimal fake PostgREST query-builder chain.
// ---------------------------------------------------------------------------

/**
 * Builds a fake supabase-js query-builder chain. Supports both usage shapes
 * exercised by authService:
 *   supabase.from(t).select(...).eq(...).maybeSingle()   -- read
 *   supabase.from(t).insert(...).select().single()       -- insert + read back
 *   supabase.from(t).insert(...)                         -- insert, awaited directly
 * (the builder itself is "thenable" so awaiting it before any further
 * chaining resolves to `result`, matching the real PostgrestBuilder).
 *
 * `record`, if given, is invoked exactly when the "real" DB action happens
 * (insert(), or the terminal maybeSingle()/single() of a read) so tests can
 * assert relative call order across multiple builders.
 */
function chainable(result: unknown, record?: () => void) {
  // Only the terminal call for THIS builder should record: if insert() was
  // called, that's the real DB action (single()/maybeSingle() afterwards is
  // just reading the row back); otherwise the read's maybeSingle()/single()
  // is the real action.
  let insertCalled = false;
  const obj: {
    select: jest.Mock;
    eq: jest.Mock;
    maybeSingle: jest.Mock;
    single: jest.Mock;
    insert: jest.Mock;
    then: (resolve: (value: unknown) => void) => void;
  } = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    maybeSingle: jest.fn(() => {
      if (!insertCalled) record?.();
      return Promise.resolve(result);
    }),
    single: jest.fn(() => {
      if (!insertCalled) record?.();
      return Promise.resolve(result);
    }),
    insert: jest.fn((_payload: unknown) => {
      insertCalled = true;
      record?.();
      return obj;
    }),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return obj;
}

/** Queues successive return values for supabase.from(), one per call. */
function queueFrom(...builders: unknown[]) {
  builders.forEach((builder) => mockFrom.mockImplementationOnce(() => builder));
}

function makeSession(overrides: {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Session {
  return {
    user: {
      id: overrides.id ?? 'user-1',
      email: overrides.email === undefined ? 'session@example.com' : overrides.email,
      user_metadata: overrides.user_metadata ?? {},
    },
  } as unknown as Session;
}

function okSession(session: Session | null) {
  mockAuth.getSession.mockResolvedValue({
    data: { session },
    error: null,
  } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
}

// ---------------------------------------------------------------------------
// signUpCustomer / signUpBarber
// ---------------------------------------------------------------------------

describe('signUpCustomer / signUpBarber', () => {
  it('returns confirmation_email_sent on success and normalizes the email', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: { identities: [{ id: 'identity-1' }] } },
      error: null,
    } as never);

    const result = await signUpCustomer('  test@example.com  ', 'password123', {
      name: 'Alex',
      city: 'Lisbon',
    });

    expect(result).toEqual({ status: 'confirmation_email_sent', email: 'test@example.com' });
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        emailRedirectTo: 'privelier://auth-callback',
        data: {
          name: 'Alex',
          role: 'customer',
          city: 'Lisbon',
          country: undefined,
          phone: undefined,
          bio: undefined,
        },
      },
    });
  });

  it('signUpBarber sends role "barber" with the barber fields', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: { identities: [{ id: 'identity-1' }] } },
      error: null,
    } as never);

    await signUpBarber('barber@example.com', 'password123', {
      name: 'Barb',
      city: 'Porto',
      bio: 'Fades and fresh cuts.',
    });

    expect(mockAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'privelier://auth-callback',
          data: expect.objectContaining({ role: 'barber', bio: 'Fades and fresh cuts.' }),
        }),
      })
    );
  });

  it('maps a GoTrue error via mapAuthApiError (e.g. weak_password)', async () => {
    const { AuthApiError } = jest.requireActual('@supabase/supabase-js');
    mockAuth.signUp.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('Password too weak', 400, 'weak_password'),
    } as never);

    const result = await signUpCustomer('test@example.com', 'weak', { name: 'Alex', city: 'Lisbon' });
    expect(result).toEqual({
      status: 'error',
      code: 'weak_password',
      message: expect.any(String),
      retryable: false,
    });
  });

  it('maps the GoTrue "email_in_use" code straight through as {status: email_in_use}', async () => {
    const { AuthApiError } = jest.requireActual('@supabase/supabase-js');
    mockAuth.signUp.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('already registered', 400, 'user_already_exists'),
    } as never);

    const result = await signUpCustomer('test@example.com', 'password123', {
      name: 'Alex',
      city: 'Lisbon',
    });
    expect(result).toEqual({ status: 'email_in_use' });
  });

  it('treats the duplicate-email obfuscation case (fake user, empty identities) as email_in_use', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: { identities: [] } },
      error: null,
    } as never);

    const result = await signUpCustomer('taken@example.com', 'password123', {
      name: 'Alex',
      city: 'Lisbon',
    });
    expect(result).toEqual({ status: 'email_in_use' });
  });
});

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe('signIn', () => {
  it('returns signed_in on success', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);
    const result = await signIn('test@example.com', 'password123');
    expect(result).toEqual({ status: 'signed_in' });
  });

  it('surfaces email_not_confirmed as a first-class arm, not a generic error', async () => {
    const { AuthApiError } = jest.requireActual('@supabase/supabase-js');
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'),
    } as never);

    const result = await signIn('  test@example.com ', 'password123');
    expect(result).toEqual({ status: 'email_not_confirmed', email: 'test@example.com' });
  });

  it('maps invalid_credentials to a generic AuthFailure', async () => {
    const { AuthApiError } = jest.requireActual('@supabase/supabase-js');
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError('bad creds', 400, 'invalid_credentials'),
    } as never);

    const result = await signIn('test@example.com', 'wrong');
    expect(result).toMatchObject({ status: 'error', code: 'invalid_credentials' });
  });
});

// ---------------------------------------------------------------------------
// resendConfirmation
// ---------------------------------------------------------------------------

describe('resendConfirmation', () => {
  it('returns sent on success', async () => {
    mockAuth.resend.mockResolvedValue({ data: {}, error: null } as never);
    const result = await resendConfirmation('test@example.com');
    expect(result).toEqual({ status: 'sent' });
    expect(mockAuth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com',
      options: { emailRedirectTo: 'privelier://auth-callback' },
    });
  });

  it('maps a rate-limit error', async () => {
    const { AuthApiError } = jest.requireActual('@supabase/supabase-js');
    mockAuth.resend.mockResolvedValue({
      data: {},
      error: new AuthApiError('slow down', 429, 'over_email_send_rate_limit'),
    } as never);
    const result = await resendConfirmation('test@example.com');
    expect(result).toMatchObject({ status: 'error', code: 'rate_limited' });
  });
});

// ---------------------------------------------------------------------------
// signOut — must never throw.
// ---------------------------------------------------------------------------

describe('signOut', () => {
  it('resolves cleanly when the server call succeeds', async () => {
    mockAuth.signOut.mockResolvedValueOnce({ error: null } as never);
    await expect(signOut()).resolves.toBeUndefined();
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('falls back to a local-scope sign-out when the server call errors (without throwing)', async () => {
    mockAuth.signOut
      .mockResolvedValueOnce({ error: new Error('server unreachable') } as never)
      .mockResolvedValueOnce({ error: null } as never);

    await expect(signOut()).resolves.toBeUndefined();
    expect(mockAuth.signOut).toHaveBeenCalledTimes(2);
    expect(mockAuth.signOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
  });

  it('falls back to a local-scope sign-out when the server call throws (without throwing)', async () => {
    mockAuth.signOut
      .mockRejectedValueOnce(new Error('network exploded'))
      .mockResolvedValueOnce({ error: null } as never);

    await expect(signOut()).resolves.toBeUndefined();
    expect(mockAuth.signOut).toHaveBeenCalledTimes(2);
    expect(mockAuth.signOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
  });

  it('still never throws even when both the server call and the local fallback throw', async () => {
    mockAuth.signOut
      .mockRejectedValueOnce(new Error('network exploded'))
      .mockRejectedValueOnce(new Error('local scope also failed'));

    await expect(signOut()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ensureProfile / ensureProfileFromForm (via provisionForSession)
// ---------------------------------------------------------------------------

describe('ensureProfile / provisionForSession', () => {
  it('returns signed_out when there is no session', async () => {
    okSession(null);
    const result = await ensureProfile();
    expect(result).toEqual({ status: 'signed_out' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('propagates a getSession failure', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'network request failed', __isAuthError: true, name: 'AuthApiError', status: 0 },
    } as never);
    const result = await ensureProfile();
    expect(result.status).toBe('error');
  });

  it('existing customer profile: returns ready without any insert', async () => {
    const session = makeSession({ id: 'user-1' });
    okSession(session);
    const existingProfile = {
      id: 'user-1',
      role: 'customer',
      name: 'Alex',
      email: 'session@example.com',
    };
    queueFrom(chainable({ data: existingProfile, error: null })); // users select

    const result = await ensureProfile();
    expect(result).toEqual({ status: 'ready', profile: existingProfile });
    expect(mockFrom).toHaveBeenCalledTimes(1); // no barber_profile call for a customer
  });

  it('existing barber profile with an existing barber_profile row: returns ready, no inserts', async () => {
    const session = makeSession({ id: 'user-2' });
    okSession(session);
    const existingProfile = { id: 'user-2', role: 'barber', name: 'Barb' };
    const usersSelect = chainable({ data: existingProfile, error: null });
    const barberProfileSelect = chainable({ data: { id: 'bp-1' }, error: null });
    queueFrom(usersSelect, barberProfileSelect);

    const result = await ensureProfile();
    expect(result).toEqual({ status: 'ready', profile: existingProfile });
    expect(usersSelect.insert).not.toHaveBeenCalled();
    expect(barberProfileSelect.insert).not.toHaveBeenCalled();
  });

  it('no profile, usable customer metadata: inserts users only', async () => {
    const session = makeSession({
      id: 'user-3',
      email: 'newcustomer@example.com',
      user_metadata: { role: 'customer', name: 'New Customer', city: 'Lisbon' },
    });
    okSession(session);
    const insertedRow = { id: 'user-3', role: 'customer', name: 'New Customer' };
    const usersSelect = chainable({ data: null, error: null });
    const usersInsert = chainable({ data: insertedRow, error: null });
    queueFrom(usersSelect, usersInsert);

    const result = await ensureProfile();

    expect(result).toEqual({ status: 'ready', profile: insertedRow });
    expect(usersInsert.insert).toHaveBeenCalledTimes(1);
    const payload = usersInsert.insert.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: 'user-3',
      email: 'newcustomer@example.com',
      name: 'New Customer',
      role: 'customer',
    });
    expect(payload).not.toHaveProperty('created_at');
    expect(mockFrom).toHaveBeenCalledTimes(2); // no barber_profile call for a customer
  });

  it('no profile, usable barber metadata: inserts users then barber_profile, in that order', async () => {
    const session = makeSession({
      id: 'user-4',
      email: 'newbarber@example.com',
      user_metadata: { role: 'barber', name: 'New Barber', city: 'Porto', bio: 'Fresh fades' },
    });
    okSession(session);
    const insertedRow = { id: 'user-4', role: 'barber', name: 'New Barber' };
    const callOrder: string[] = [];
    const usersSelect = chainable({ data: null, error: null });
    const usersInsert = chainable({ data: insertedRow, error: null }, () => callOrder.push('users.insert'));
    const barberProfileSelect = chainable({ data: null, error: null }, () =>
      callOrder.push('barberProfile.select')
    );
    const barberProfileInsert = chainable({ data: null, error: null }, () =>
      callOrder.push('barberProfile.insert')
    );
    queueFrom(usersSelect, usersInsert, barberProfileSelect, barberProfileInsert);

    const result = await ensureProfile();

    expect(result).toEqual({ status: 'ready', profile: insertedRow });
    // The barber_profile insert must only ever run AFTER the users insert commits.
    expect(callOrder).toEqual(['users.insert', 'barberProfile.select', 'barberProfile.insert']);

    const usersPayload = usersInsert.insert.mock.calls[0][0];
    expect(usersPayload).not.toHaveProperty('created_at');
    expect(usersPayload.role).toBe('barber');

    const barberPayload = barberProfileInsert.insert.mock.calls[0][0];
    expect(barberPayload).toEqual({ user_id: 'user-4', bio: 'Fresh fades' });
  });

  it('no profile, unusable metadata (missing name): returns needs_setup_form and inserts nothing', async () => {
    const session = makeSession({
      id: 'user-5',
      user_metadata: { role: 'customer' }, // no name
    });
    okSession(session);
    const usersSelect = chainable({ data: null, error: null });
    queueFrom(usersSelect);

    const result = await ensureProfile();
    expect(result).toEqual({
      status: 'needs_setup_form',
      prefill: { role: 'customer', name: undefined, city: undefined, country: undefined, phone: undefined, bio: undefined },
    });
    expect(usersSelect.insert).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('no profile, unusable metadata (invalid role): returns needs_setup_form and inserts nothing', async () => {
    const session = makeSession({
      id: 'user-6',
      user_metadata: { role: 'admin', name: 'Sneaky' },
    });
    okSession(session);
    const usersSelect = chainable({ data: null, error: null });
    queueFrom(usersSelect);

    const result = await ensureProfile();
    expect(result.status).toBe('needs_setup_form');
    expect(usersSelect.insert).not.toHaveBeenCalled();
  });

  it('unique violation on the users insert: refetches and proceeds using the refetched row (not an error)', async () => {
    const session = makeSession({
      id: 'user-7',
      user_metadata: { role: 'customer', name: 'Race Loser' },
    });
    okSession(session);
    const refetchedProfile = { id: 'user-7', role: 'customer', name: 'Race Winner' };
    const usersSelect = chainable({ data: null, error: null });
    const usersInsert = chainable({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const usersRefetch = chainable({ data: refetchedProfile, error: null });
    queueFrom(usersSelect, usersInsert, usersRefetch);

    const result = await ensureProfile();

    expect(result).toEqual({ status: 'ready', profile: refetchedProfile });
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it('unique violation on the barber_profile insert: treated as success (no error)', async () => {
    const session = makeSession({
      id: 'user-8',
      user_metadata: { role: 'barber', name: 'Barber Eight' },
    });
    okSession(session);
    const insertedRow = { id: 'user-8', role: 'barber', name: 'Barber Eight' };
    const usersSelect = chainable({ data: null, error: null });
    const usersInsert = chainable({ data: insertedRow, error: null });
    const barberProfileSelect = chainable({ data: null, error: null });
    const barberProfileInsert = chainable({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    queueFrom(usersSelect, usersInsert, barberProfileSelect, barberProfileInsert);

    const result = await ensureProfile();
    expect(result).toEqual({ status: 'ready', profile: insertedRow });
  });

  it('a non-unique Postgres error (42501) on the users insert propagates as provisioning_denied, and it is retryable', async () => {
    const session = makeSession({
      id: 'user-9',
      user_metadata: { role: 'customer', name: 'Tampered' },
    });
    okSession(session);
    const usersSelect = chainable({ data: null, error: null });
    const usersInsert = chainable({
      data: null,
      error: { code: '42501', message: 'permission denied for table users' },
    });
    queueFrom(usersSelect, usersInsert);

    const result = await ensureProfile();
    expect(result).toEqual({
      status: 'error',
      code: 'provisioning_denied',
      message: expect.any(String),
      retryable: true,
    });
  });

  it('email for the users insert always comes from session.user.email, never a client field', async () => {
    const session = makeSession({
      id: 'user-10',
      email: 'authoritative@example.com',
      user_metadata: { role: 'customer', name: 'Someone' },
    });
    okSession(session);
    const insertedRow = { id: 'user-10', role: 'customer', name: 'Someone' };
    const usersSelect = chainable({ data: null, error: null });
    const usersInsert = chainable({ data: insertedRow, error: null });
    queueFrom(usersSelect, usersInsert);

    await ensureProfile();

    const payload = usersInsert.insert.mock.calls[0][0];
    expect(payload.email).toBe('authoritative@example.com');
  });
});

describe('ensureProfileFromForm', () => {
  const validFields: SetupFormFields = {
    role: 'customer',
    name: 'Form User',
    city: 'Lisbon',
  };

  it('runtime-guards an invalid role (bypassing the TS type via `as any`) and never calls getSession', async () => {
    const badFields = { ...validFields, role: 'admin' } as unknown as SetupFormFields;
    const result = await ensureProfileFromForm(badFields);
    expect(result).toEqual({
      status: 'error',
      code: 'unknown',
      message: expect.any(String),
      retryable: false,
    });
    expect(mockAuth.getSession).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('runtime-guards an empty/whitespace-only name and never calls getSession', async () => {
    const badFields = { ...validFields, name: '   ' } as SetupFormFields;
    const result = await ensureProfileFromForm(badFields);
    expect(result).toEqual({
      status: 'error',
      code: 'unknown',
      message: expect.any(String),
      retryable: false,
    });
    expect(mockAuth.getSession).not.toHaveBeenCalled();
  });

  it('on valid fields, inserts using the form fields and the session email (never a form email)', async () => {
    const session = makeSession({ id: 'user-11', email: 'from-session@example.com' });
    okSession(session);
    const insertedRow = { id: 'user-11', role: 'customer', name: 'Form User' };
    const usersSelect = chainable({ data: null, error: null });
    const usersInsert = chainable({ data: insertedRow, error: null });
    queueFrom(usersSelect, usersInsert);

    const result = await ensureProfileFromForm(validFields);

    expect(result).toEqual({ status: 'ready', profile: insertedRow });
    const payload = usersInsert.insert.mock.calls[0][0];
    expect(payload.email).toBe('from-session@example.com');
    expect(payload.role).toBe('customer');
    expect(payload).not.toHaveProperty('created_at');
  });

  it('returns signed_out when there is no session', async () => {
    okSession(null);
    const result = await ensureProfileFromForm(validFields);
    expect(result).toEqual({ status: 'signed_out' });
  });
});
