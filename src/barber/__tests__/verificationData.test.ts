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
 *    at `{userId}/{docType}.jpg` with upsert, and classifies storage/read
 *    failures into the closed BarberDataErrorCode set.
 *  - submitVerificationDocument writes ONLY `user_id` + the one image column
 *    and NEVER `status` / `reviewed_by` / `reviewed_at` (those are DB-trigger /
 *    admin-owned). The payload-shape assertions are the guardrail against a
 *    future edit accidentally sending a privileged column.
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

/** A minimal PostgREST upsert().select().single() chain resolving to result. */
function upsertChain(result: unknown) {
  const obj: { upsert: jest.Mock; select: jest.Mock; single: jest.Mock } = {
    upsert: jest.fn(() => obj),
    select: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

// ---------------------------------------------------------------------------
// uploadVerificationDocument
// ---------------------------------------------------------------------------

describe('uploadVerificationDocument', () => {
  it('reads the file bytes and uploads to the private bucket at {userId}/id.jpg', async () => {
    const fetchFn = fetchYields(4);
    const upload = storageUpload({ error: null });

    const result = await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.jpg');

    expect(result).toEqual({ status: 'ok', path: 'u1/id.jpg' });
    expect(fetchFn).toHaveBeenCalledWith('file:///tmp/pic.jpg');
    expect(mockStorageFrom).toHaveBeenCalledWith('verification-docs');
    expect(upload).toHaveBeenCalledWith('u1/id.jpg', expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
      upsert: true,
    });
  });

  it('uploads the license doc to {userId}/license.jpg', async () => {
    fetchYields();
    const upload = storageUpload({ error: null });

    const result = await uploadVerificationDocument('u1', 'license', 'file:///tmp/lic.jpg');

    expect(result).toEqual({ status: 'ok', path: 'u1/license.jpg' });
    expect(upload).toHaveBeenCalledWith('u1/license.jpg', expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
      upsert: true,
    });
  });

  it('passes an explicit mimeType through as the contentType', async () => {
    fetchYields();
    const upload = storageUpload({ error: null });

    await uploadVerificationDocument('u1', 'id', 'file:///tmp/pic.png', 'image/png');

    expect(upload).toHaveBeenCalledWith('u1/id.jpg', expect.any(ArrayBuffer), {
      contentType: 'image/png',
      upsert: true,
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
  it('upserts ONLY user_id + id_image_url for the id doc and returns the row', async () => {
    const row = {
      id: 'v1',
      user_id: 'u1',
      id_image_url: 'u1/id.jpg',
      license_image_url: null,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
    };
    const builder = upsertChain({ data: row, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await submitVerificationDocument('u1', 'id', 'u1/id.jpg');

    expect(result).toEqual({ status: 'ok', request: row });
    expect(mockFrom).toHaveBeenCalledWith('verification_requests');
    expect(builder.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', id_image_url: 'u1/id.jpg' },
      { onConflict: 'user_id' }
    );

    // Guardrail: the payload must carry exactly two keys and NEVER a
    // trigger/admin-owned column, even if the row it selects back does.
    const payload = builder.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['id_image_url', 'user_id']);
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('reviewed_by');
    expect(payload).not.toHaveProperty('reviewed_at');
    expect(payload).not.toHaveProperty('license_image_url');
  });

  it('upserts ONLY user_id + license_image_url for the license doc', async () => {
    const builder = upsertChain({ data: { id: 'v1', user_id: 'u1' }, error: null });
    mockFrom.mockReturnValueOnce(builder);

    await submitVerificationDocument('u1', 'license', 'u1/license.jpg');

    expect(builder.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', license_image_url: 'u1/license.jpg' },
      { onConflict: 'user_id' }
    );
    const payload = builder.upsert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['license_image_url', 'user_id']);
    expect(payload).not.toHaveProperty('id_image_url');
    expect(payload).not.toHaveProperty('status');
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = upsertChain({
      data: null,
      error: { code: '42501', message: 'permission denied for table verification_requests' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await submitVerificationDocument('u1', 'id', 'u1/id.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});
