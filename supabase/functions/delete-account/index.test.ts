/**
 * @jest-environment node
 *
 * The delete-account Edge Function with a fake Deno and fake Supabase clients.
 * What these pin hardest: a customer's look photos live in the BARBER's folder,
 * so their paths must be read while the rows still exist and removed only after
 * the account is really gone, and nothing about them can stop the deletion or
 * the cleanup of the caller's own folders.
 */
type Handler = (req: Request) => Promise<Response>;

const USER_ID = 'user-1';
const FOLDER_BUCKETS = ['verification-docs', 'portfolio', 'looks', 'look-references'];
const BARBER_FOLDER_PHOTO = 'barber-9/result-1.jpg';

interface Scenario {
  rpcError?: { code: string } | null;
  lookRows?: { look_photos: { storage_path: string }[] | null }[];
  lookError?: { code: string } | null;
  folders?: Record<string, string[]>;
  removeError?: { message: string } | null;
  removeThrows?: boolean;
  user?: { id: string } | null;
}

const mockCreateClient = jest.fn();

jest.mock('npm:@supabase/supabase-js@2', () => ({ createClient: (...args: unknown[]) => mockCreateClient(...args) }), { virtual: true });

let handler: Handler;
let calls: string[];
let consoleError: jest.SpyInstance;

function setUp(scenario: Scenario = {}) {
  const user = scenario.user === undefined ? { id: USER_ID } : scenario.user;
  const caller = {
    auth: { getUser: jest.fn(async () => ({ data: { user }, error: user ? null : { message: 'bad token' } })) },
    rpc: jest.fn(async (name: string) => {
      calls.push(`rpc:${name}`);
      return { error: scenario.rpcError ?? null };
    }),
  };
  const admin = {
    from: jest.fn((table: string) => ({
      select: () => ({
        eq: async (column: string, value: string) => {
          calls.push(`read:${table}:${column}=${value}`);
          return { data: scenario.lookError ? null : (scenario.lookRows ?? []), error: scenario.lookError ?? null };
        },
      }),
    })),
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string) => {
          calls.push(`list:${bucket}:${folder}`);
          return { data: (scenario.folders?.[bucket] ?? []).map((name) => ({ name })), error: null };
        },
        remove: async (paths: string[]) => {
          calls.push(`remove:${bucket}:${paths.join(',')}`);
          if (scenario.removeThrows && paths.includes(BARBER_FOLDER_PHOTO)) throw new Error('network down');
          return { error: paths.includes(BARBER_FOLDER_PHOTO) ? (scenario.removeError ?? null) : null };
        },
      }),
    },
  };
  mockCreateClient.mockImplementation((_url: string, key: string) => (key === 'secret-key' ? admin : caller));
  return { caller, admin };
}

function post(authorization: string | null = 'Bearer token') {
  return new Request('https://example.invalid/delete-account', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : {},
  });
}

const withPrefix = (prefix: string) => calls.filter((call) => call.startsWith(prefix));

beforeAll(() => {
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://example.invalid',
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'publishable-key' }),
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'secret-key' }),
  };
  (globalThis as { Deno?: unknown }).Deno = {
    env: { get: (name: string) => env[name] },
    serve: (registered: Handler) => {
      handler = registered;
    },
  };
  jest.requireActual('./index');
});

beforeEach(() => {
  calls = [];
  mockCreateClient.mockReset();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('a customer with look photos', () => {
  const lookRows = [{ look_photos: [{ storage_path: BARBER_FOLDER_PHOTO }, { storage_path: 'barber-9/result-2.jpg' }] }, { look_photos: null }];

  it('reads the paths first, deletes the account, then removes them from the barber folder', async () => {
    setUp({ lookRows });
    const response = await handler(post());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'deleted' });
    expect(calls[0]).toBe(`read:looks:customer_id=${USER_ID}`);
    expect(calls[1]).toBe('rpc:delete_own_account');
    expect(calls[2]).toBe(`remove:looks:${BARBER_FOLDER_PHOTO},barber-9/result-2.jpg`);
  });

  it('still empties every one of the caller\'s own folders', async () => {
    setUp({ lookRows, folders: { 'look-references': ['ref.jpg'], portfolio: ['p.jpg'] } });
    await handler(post());

    expect(withPrefix('list:')).toEqual(FOLDER_BUCKETS.map((bucket) => `list:${bucket}:${USER_ID}`));
    expect(calls).toContain(`remove:look-references:${USER_ID}/ref.jpg`);
    expect(calls).toContain(`remove:portfolio:${USER_ID}/p.jpg`);
  });

  it.each([
    ['fails with a Postgres error', { code: 'XX000' }, 500, 'delete_failed'],
    ['is rate limited', { code: 'PA429' }, 429, 'rate_limited'],
  ])('removes nothing when the deletion %s', async (_label, rpcError, status, error) => {
    setUp({ lookRows, rpcError, folders: { portfolio: ['p.jpg'] } });
    const response = await handler(post());

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
    expect(withPrefix('remove:')).toEqual([]);
    expect(withPrefix('list:')).toEqual([]);
  });

  it.each([
    ['returns an error', { removeError: { message: 'storage down' } }],
    ['throws', { removeThrows: true }],
  ])('carries on with the own folders when removing the photos %s', async (_label, failure) => {
    setUp({ lookRows, ...failure, folders: { portfolio: ['p.jpg'] } });
    const response = await handler(post());

    expect(response.status).toBe(200);
    expect(calls).toContain(`remove:portfolio:${USER_ID}/p.jpg`);
    expect(consoleError).toHaveBeenCalledWith(`storage cleanup failed bucket=looks customer=${USER_ID}`, expect.any(String));
  });

  it('never logs a photo path', async () => {
    setUp({ lookRows, removeError: { message: 'storage down' } });
    await handler(post());

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(BARBER_FOLDER_PHOTO);
  });
});

describe('the deletion itself', () => {
  it('goes ahead when the look photo read fails', async () => {
    setUp({ lookError: { code: '42501' }, folders: { portfolio: ['p.jpg'] } });
    const response = await handler(post());

    expect(response.status).toBe(200);
    expect(calls).toContain('rpc:delete_own_account');
    expect(calls).toContain(`remove:portfolio:${USER_ID}/p.jpg`);
    expect(consoleError).toHaveBeenCalledWith(`look photo lookup skipped user=${USER_ID}`, '42501');
  });

  it('only touches the caller\'s own folder for someone with no customer looks, like a barber', async () => {
    setUp({ lookRows: [], folders: { looks: ['own.jpg'] } });
    const response = await handler(post());

    expect(response.status).toBe(200);
    expect(withPrefix('remove:')).toEqual([`remove:looks:${USER_ID}/own.jpg`]);
  });
});

describe('before any account is known', () => {
  it('refuses other methods', async () => {
    setUp();
    const response = await handler(new Request('https://example.invalid/delete-account', { method: 'GET' }));

    expect(response.status).toBe(405);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('refuses a request without a token and never builds a client', async () => {
    setUp();
    const response = await handler(post(null));

    expect(response.status).toBe(401);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('refuses an invalid token before the secret key is used or anything is read', async () => {
    const { admin } = setUp({ user: null });
    const response = await handler(post());

    expect(response.status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient.mock.calls[0][1]).toBe('publishable-key');
  });
});
