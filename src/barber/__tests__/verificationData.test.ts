/**
 * Unit tests for the barber verification-document upload data layer
 * (src/barber/verificationData.ts, build-order step 17). The Supabase client
 * (`lib/supabase.ts`) and the global `fetch` used to read local image bytes
 * are mocked entirely, matching the mocking approach in
 * src/barber/__tests__/servicesData.test.ts and
 * src/barber/__tests__/conversationData.test.ts — these tests never touch a
 * real network, storage bucket or database.
 *
 * The two things these tests pin hardest:
 *  - uploadVerificationDocument targets the PRIVATE `verification-docs` bucket
 *    at a UNIQUE `{userId}/{docType}-{stamp}.jpg` path (never a fixed name, so a
 *    re-upload never overwrites a prior/approved object — Step 17 security fix),
 *    and classifies storage/read failures into the closed BarberDataErrorCode set.
 *  - submitVerificationDocument NEVER `status` / `reviewed_by` / `reviewed_at`
 *    (those are DB-trigger / admin-owned), and — since the 2026-07-17 fix —
 *    its UPDATE arm sends ONLY the one image column, never `user_id`. That
 *    payload-shape assertion is the direct regression guard for the bug where
 *    an upsert's `ON CONFLICT DO UPDATE SET user_id = ...` hit the column-grant
 *    guardrail (0015) and made every RESUBMISSION fail 42501 while first
 *    submissions passed. Insert and update are asserted separately because the
 *    columns a client may write differ per operation.
 */
import { supabase } from '../../../lib/supabase';
import { submitVerificationDocument, uploadVerificationDocument } from '../verificationData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

const mockFrom = supabase.from as jest.Mock;
const mockStorageFrom = supabase.storage.from as jest.Mock;

// Preserve and restore the real globalThis.fetch around the whole suite; each test
// installs its own jest.fn() so nothing leaks a real network call.
const realFetch = globalThis.fetch;

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** A storage builder whose single `upload` resolves to `{ error }`. */
function storageUpload(result: { error: unknown }) {
  const upload = jest.fn(() => Promise.resolve(result));
  mockStorageFrom.mockReturnValue({ upload });
  return upload;
}

/** globalThis.fetch resolving to a body whose arrayBuffer() yields N bytes. */
function fetchYields(byteLength = 4) {
  const fn = jest.fn(() =>
    Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(byteLength)) })
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** A minimal PostgREST update().eq().select().maybeSingle() chain. */
function updateChain(result: unknown) {
  const obj: { update: jest.Mock; eq: jest.Mock; select: jest.Mock; maybeSingle: jest.Mock } = {
    update: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    select: jest.fn(() => obj),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

/** A minimal PostgREST insert().select().single() chain. */
function insertChain(result: unknown) {
  const obj: { insert: jest.Mock; select: jest.Mock; single: jest.Mock } = {
    insert: jest.fn(() => obj),
    select: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

// ---------------------------------------------------------------------------
// uploadVerificationDocument
// ---------------------------------------------------------------------------

describe('uploadVerificationDocument', () => {
  // Unique-per-upload object name in the barber's own folder — never a fixed
  // path, and no upsert (nothing to overwrite). See uniqueObjectName.
  const ID_PATH = /^u1\/id-\d+-[a-z0-9]+\.jpg$/;
  const LICENSE_PATH = /^u1\/license-\d+-[a-z0-9]+\.jpg$/;

  it('reads the file bytes and uploads a unique object under the barber folder', async () => {
    const fetchFn = fetchYields(4);
    const upload = storageUpload({ error: null });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');

    expect(result.status).toBe('ok');
    const path = (result as { status: 'ok'; path: string }).path;
    expect(path).toMatch(ID_PATH);
    expect(fetchFn).toHaveBeenCalledWith('file:///tmp/pic.jpg');
    expect(mockStorageFrom).toHaveBeenCalledWith('verification-docs');
    // The returned path is exactly the one uploaded, and no upsert is requested.
    expect(upload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
    });
  });

  it('uploads the license doc under the barber folder', async () => {
    fetchYields();
    const upload = storageUpload({ error: null });

    const result = await uploadVerificationDocument('u1', 'license', 'file:///tmp/lic.jpg');

    expect(result.status).toBe('ok');
    expect((result as { status: 'ok'; path: string }).path).toMatch(LICENSE_PATH);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(LICENSE_PATH), expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
    });
  });

  it('passes an explicit mimeType through as the contentType', async () => {
    fetchYields();
    const upload = storageUpload({ error: null });

    await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.png', 'image/png');

    expect(upload).toHaveBeenCalledWith(expect.stringMatching(ID_PATH), expect.any(ArrayBuffer), {
      contentType: 'image/png',
    });
  });

  it('maps a thrown fetch/read to network (and never calls upload)', async () => {
    const fetchFn = jest.fn(() => Promise.reject(new Error('boom')));
    globalThis.fetch = fetchFn as unknown as typeof fetch;
    const upload = storageUpload({ error: null });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');

    expect(result).toMatchObject({ status: 'error', code: 'network', retryable: true });
    expect(upload).not.toHaveBeenCalled();
  });

  it("maps a storage error whose message contains 'network' to network", async () => {
    fetchYields();
    storageUpload({ error: { message: 'Network request failed' } });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'network' });
  });

  it("maps a storage error mentioning 'permission' to forbidden", async () => {
    fetchYields();
    storageUpload({ error: { message: 'permission denied for bucket' } });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it("maps a storage error mentioning 'unauthorized' to forbidden", async () => {
    fetchYields();
    storageUpload({ error: { message: 'Unauthorized' } });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it("maps a storage error mentioning 'row-level security' to forbidden", async () => {
    fetchYields();
    storageUpload({ error: { message: 'new row violates row-level security policy' } });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('maps an unclassifiable storage error to unknown', async () => {
    fetchYields();
    storageUpload({ error: { message: 'something odd happened' } });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'unknown' });
  });

  it('maps a storage error with no message to unknown', async () => {
    fetchYields();
    storageUpload({ error: {} });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'unknown' });
  });
});

// ---------------------------------------------------------------------------
// submitVerificationDocument
// ---------------------------------------------------------------------------

describe('submitVerificationDocument', () => {
  const row = {
    id: 'v1',
    user_id: 'u1',
    id_image_url: 'u1/id.jpg',
    license_image_url: null,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
  };

  it('RESUBMISSION: updates ONLY the image column, never user_id, and never inserts', async () => {
    const update = updateChain({ data: row, error: null });
    mockFrom.mockReturnValueOnce(update);

    const result = await submitVerificationDocument('u1', 'id', 'u1/id2.jpg');

    expect(result).toEqual({ status: 'ok', request: row });
    expect(mockFrom).toHaveBeenCalledWith('verification_requests');
    expect(update.update).toHaveBeenCalledWith({ id_image_url: 'u1/id2.jpg' });
    expect(update.eq).toHaveBeenCalledWith('user_id', 'u1');
    // Only one from() call: the update matched, so no INSERT was attempted.
    expect(mockFrom).toHaveBeenCalledTimes(1);

    // THE regression guardrail. `authenticated` holds column-level UPDATE on
    // the two image columns ONLY (migration 0015). Putting `user_id` — or any
    // trigger/admin-owned column — in an UPDATE payload reintroduces the 42501
    // that broke every resubmission.
    const payload = update.update.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['id_image_url']);
    expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('reviewed_by');
    expect(payload).not.toHaveProperty('reviewed_at');
  });

  it('RESUBMISSION: targets license_image_url for the license doc', async () => {
    const update = updateChain({ data: { id: 'v1', user_id: 'u1' }, error: null });
    mockFrom.mockReturnValueOnce(update);

    await submitVerificationDocument('u1', 'license', 'u1/license2.jpg');

    const payload = update.update.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['license_image_url']);
    expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('id_image_url');
  });

  it('FIRST SUBMISSION: no row to update, so inserts user_id + the image column', async () => {
    mockFrom.mockReturnValueOnce(updateChain({ data: null, error: null }));
    const insert = insertChain({ data: row, error: null });
    mockFrom.mockReturnValueOnce(insert);

    const result = await submitVerificationDocument('u1', 'id', 'u1/id.jpg');

    expect(result).toEqual({ status: 'ok', request: row });
    // INSERT *does* carry user_id — authenticated holds INSERT on it. This is
    // exactly the arm that always worked and masked the resubmission bug.
    expect(insert.insert).toHaveBeenCalledWith({ user_id: 'u1', id_image_url: 'u1/id.jpg' });
    const payload = insert.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['id_image_url', 'user_id']);
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('reviewed_by');
  });

  it('maps an RLS denial (42501) on the update to forbidden', async () => {
    mockFrom.mockReturnValueOnce(
      updateChain({
        data: null,
        error: { code: '42501', message: 'permission denied for table verification_requests' },
      })
    );

    const result = await submitVerificationDocument('u1', 'id', 'u1/id.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('RACE: a row inserted between our update and insert (23505) retries the update', async () => {
    mockFrom.mockReturnValueOnce(updateChain({ data: null, error: null }));
    mockFrom.mockReturnValueOnce(
      insertChain({ data: null, error: { code: '23505', message: 'duplicate key value' } })
    );
    mockFrom.mockReturnValueOnce(updateChain({ data: row, error: null }));

    const result = await submitVerificationDocument('u1', 'id', 'u1/id.jpg');
    expect(result).toEqual({ status: 'ok', request: row });
  });

  it('APPROVED row: 23505 plus a still-unmatched retry is a denial, not a race', async () => {
    // update_own is scoped to pending/rejected, so an approved row matches no
    // UPDATE while still colliding on UNIQUE(user_id).
    mockFrom.mockReturnValueOnce(updateChain({ data: null, error: null }));
    mockFrom.mockReturnValueOnce(
      insertChain({ data: null, error: { code: '23505', message: 'duplicate key value' } })
    );
    mockFrom.mockReturnValueOnce(updateChain({ data: null, error: null }));

    const result = await submitVerificationDocument('u1', 'id', 'u1/id.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});
