/**
 * Unit tests for the barber portfolio data layer
 * (src/barber/portfolioData.ts, build-order step 17). The Supabase client
 * (`lib/supabase.ts`) and the global `fetch` used to read local image bytes
 * are mocked entirely, matching the mocking approach in
 * src/barber/__tests__/verificationData.test.ts — these tests never touch a
 * real network, storage bucket or database.
 *
 * The two things these tests pin hardest (flagged by the build stages as the
 * highest-value behaviours):
 *  - deletePortfolioImage's DB-ROW-FIRST ordering (design D5): the portfolio
 *    row delete is attempted before the storage-object remove, a row-delete
 *    failure short-circuits (the object is never touched), and a storage-object
 *    failure AFTER a successful row delete is logged + accepted as an orphan
 *    (design D4) — the caller still sees `{ status: 'ok' }`.
 *  - insertPortfolioRow's max-6 trigger mapping: the P0001 raise whose message
 *    contains "more than 6 portfolio images" surfaces as a typed
 *    'limit_reached' failure and does NOT fall through to the generic mapper,
 *    while any OTHER P0001 still maps via mapPostgrestError.
 */
import { supabase } from '../../../lib/supabase';
import {
  deletePortfolioImage,
  insertPortfolioRow,
  listOwnPortfolio,
  MAX_PORTFOLIO_IMAGES,
  uploadPortfolioImage,
} from '../portfolioData';
import type { PortfolioRow } from '../../types';

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

// Preserve and restore the real globalThis.fetch around the whole suite; each
// test installs its own jest.fn() so nothing leaks a real network call.
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

/** A minimal PostgREST insert().select().single() chain resolving to result. */
function insertChain(result: unknown) {
  const obj: { insert: jest.Mock; select: jest.Mock; single: jest.Mock } = {
    insert: jest.fn(() => obj),
    select: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

/** A minimal PostgREST select().eq() chain resolving to result. */
function selectEqChain(result: unknown) {
  const obj: { select: jest.Mock; eq: jest.Mock } = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

/** A minimal example portfolio row. */
function row(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return { id: 'p1', barber_id: 'b1', image_url: 'b1/img-1.jpg', ...overrides };
}

// ---------------------------------------------------------------------------
// MAX_PORTFOLIO_IMAGES
// ---------------------------------------------------------------------------

describe('MAX_PORTFOLIO_IMAGES', () => {
  it('mirrors the DB hard cap of 6', () => {
    expect(MAX_PORTFOLIO_IMAGES).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// uploadPortfolioImage
// ---------------------------------------------------------------------------

describe('uploadPortfolioImage', () => {
  // Unique-per-upload object name in the barber's own folder — never a fixed
  // path, and no upsert (nothing to overwrite). See uniqueObjectName.
  const IMG_PATH = /^b1\/img-\d+-[a-z0-9]+\.jpg$/;

  it('reads the file bytes and uploads a unique object under the barber folder', async () => {
    const fetchFn = fetchYields(4);
    const upload = storageUpload({ error: null });

    const result = await uploadPortfolioImage('b1', 'file:///tmp/pic.jpg');

    expect(result.status).toBe('ok');
    const path = (result as { status: 'ok'; path: string }).path;
    expect(path).toMatch(IMG_PATH);
    expect(fetchFn).toHaveBeenCalledWith('file:///tmp/pic.jpg');
    expect(mockStorageFrom).toHaveBeenCalledWith('portfolio');
    // The returned path is exactly the one uploaded, and no upsert is requested.
    expect(upload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
    });
    // Belt-and-suspenders: upload options must NOT ask for an upsert (unique
    // path means there is nothing to overwrite in place).
    expect(upload.mock.calls[0][2]).not.toHaveProperty('upsert');
  });

  it('produces a UNIQUE path per call (no fixed name / no in-place overwrite)', async () => {
    fetchYields();
    storageUpload({ error: null });
    const first = await uploadPortfolioImage('b1', 'file:///tmp/a.jpg');

    fetchYields();
    storageUpload({ error: null });
    const second = await uploadPortfolioImage('b1', 'file:///tmp/b.jpg');

    const p1 = (first as { status: 'ok'; path: string }).path;
    const p2 = (second as { status: 'ok'; path: string }).path;
    expect(p1).toMatch(IMG_PATH);
    expect(p2).toMatch(IMG_PATH);
    expect(p1).not.toBe(p2);
  });

  it('passes an explicit mimeType through as the contentType', async () => {
    fetchYields();
    const upload = storageUpload({ error: null });

    await uploadPortfolioImage('b1', 'file:///tmp/pic.png', 'image/png');

    expect(upload).toHaveBeenCalledWith(expect.stringMatching(IMG_PATH), expect.any(ArrayBuffer), {
      contentType: 'image/png',
    });
  });

  it('maps a thrown fetch/read to network (and never calls upload)', async () => {
    const fetchFn = jest.fn(() => Promise.reject(new Error('boom')));
    globalThis.fetch = fetchFn as unknown as typeof fetch;
    const upload = storageUpload({ error: null });

    const result = await uploadPortfolioImage('b1', 'file:///tmp/pic.jpg');

    expect(result).toMatchObject({ status: 'error', code: 'network', retryable: true });
    expect(upload).not.toHaveBeenCalled();
  });

  it("maps a storage error whose message contains 'network' to network", async () => {
    fetchYields();
    storageUpload({ error: { message: 'Network request failed' } });

    const result = await uploadPortfolioImage('b1', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'network' });
  });

  it("maps a storage error mentioning 'permission' to forbidden", async () => {
    fetchYields();
    storageUpload({ error: { message: 'permission denied for bucket' } });

    const result = await uploadPortfolioImage('b1', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('maps an unclassifiable storage error to unknown', async () => {
    fetchYields();
    storageUpload({ error: { message: 'something odd happened' } });

    const result = await uploadPortfolioImage('b1', 'file:///tmp/pic.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'unknown' });
  });
});

// ---------------------------------------------------------------------------
// insertPortfolioRow
// ---------------------------------------------------------------------------

describe('insertPortfolioRow', () => {
  it('inserts ONLY barber_id + image_url(path) and returns the row', async () => {
    const inserted = row({ id: 'p9', image_url: 'b1/img-x.jpg' });
    const builder = insertChain({ data: inserted, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await insertPortfolioRow('b1', 'b1/img-x.jpg');

    expect(result).toEqual({ status: 'ok', image: inserted });
    expect(mockFrom).toHaveBeenCalledWith('portfolio');
    expect(builder.insert).toHaveBeenCalledWith({ barber_id: 'b1', image_url: 'b1/img-x.jpg' });
    // Guardrail: the payload carries exactly the two keys, never an id/url.
    const payload = builder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['barber_id', 'image_url']);
  });

  it("maps the max-6 trigger (P0001 + 'more than 6 portfolio images') to limit_reached", async () => {
    const builder = insertChain({
      data: null,
      error: {
        code: 'P0001',
        message: 'Cannot add more than 6 portfolio images for this barber',
      },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await insertPortfolioRow('b1', 'b1/img-x.jpg');

    // The limit path must be TYPED, not the generic mapper's output.
    expect(result).toMatchObject({ status: 'error', code: 'limit_reached' });
    expect((result as { message: string }).message).toContain('6 portfolio images');
    // And it must NOT be surfaced as transition_rejected (the generic P0001 arm).
    expect(result).not.toMatchObject({ code: 'transition_rejected' });
  });

  it('does NOT treat a P0001 WITHOUT the max-six message as limit_reached (falls through to the mapper)', async () => {
    // A different P0001 (e.g. some other raise) must go via mapPostgrestError,
    // which maps a bare P0001 to transition_rejected — proving the limit guard
    // is message-specific, not code-only.
    const builder = insertChain({
      data: null,
      error: { code: 'P0001', message: 'some unrelated trigger raise' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await insertPortfolioRow('b1', 'b1/img-x.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'transition_rejected' });
  });

  it('maps an RLS denial (42501) to forbidden via mapPostgrestError', async () => {
    const builder = insertChain({
      data: null,
      error: { code: '42501', message: 'permission denied for table portfolio' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await insertPortfolioRow('b1', 'b1/img-x.jpg');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});

// ---------------------------------------------------------------------------
// deletePortfolioImage
// ---------------------------------------------------------------------------

describe('deletePortfolioImage', () => {
  /**
   * Build a delete chain (from('portfolio').delete().eq(...)) whose eq resolves
   * to `rowResult`, plus a storage.remove resolving to `storageResult`. Both
   * mocks push a label into `order` so call ordering can be asserted.
   */
  function deleteHarness(
    order: string[],
    rowResult: { error: unknown },
    storageResult: { error: unknown }
  ) {
    const eq = jest.fn(() => {
      order.push('row-delete');
      return Promise.resolve(rowResult);
    });
    const del = jest.fn(() => ({ eq }));
    mockFrom.mockReturnValue({ delete: del });

    const remove = jest.fn(() => {
      order.push('storage-remove');
      return Promise.resolve(storageResult);
    });
    mockStorageFrom.mockReturnValue({ remove });

    return { del, eq, remove };
  }

  it('deletes the DB row BEFORE the storage object, then returns ok', async () => {
    const order: string[] = [];
    const { eq, remove } = deleteHarness(order, { error: null }, { error: null });

    const result = await deletePortfolioImage(row({ id: 'p1', image_url: 'b1/img-1.jpg' }));

    expect(result).toEqual({ status: 'ok' });
    // Row-first ordering (design D5).
    expect(order).toEqual(['row-delete', 'storage-remove']);
    expect(mockFrom).toHaveBeenCalledWith('portfolio');
    expect(eq).toHaveBeenCalledWith('id', 'p1');
    expect(mockStorageFrom).toHaveBeenCalledWith('portfolio');
    expect(remove).toHaveBeenCalledWith(['b1/img-1.jpg']);
  });

  it('returns the failure and NEVER touches storage when the row delete errors', async () => {
    const order: string[] = [];
    const { remove } = deleteHarness(
      order,
      { error: { code: '42501', message: 'permission denied for table portfolio' } },
      { error: null }
    );

    const result = await deletePortfolioImage(row());

    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
    // The object is left untouched — no orphan-creating remove after a failed row delete.
    expect(remove).not.toHaveBeenCalled();
    expect(order).toEqual(['row-delete']);
  });

  it('accepts a storage-object failure AFTER a successful row delete as an orphan (still ok, and logs)', async () => {
    const order: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { remove } = deleteHarness(
      order,
      { error: null },
      { error: { message: 'object not found' } }
    );

    const result = await deletePortfolioImage(row({ image_url: 'b1/img-1.jpg' }));

    // The row is gone from every read path, so the caller still sees ok (D4).
    expect(result).toEqual({ status: 'ok' });
    expect(remove).toHaveBeenCalledWith(['b1/img-1.jpg']);
    // The orphaned object was logged (dev-only warn).
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('deletePortfolioImage.object'),
      expect.anything()
    );
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// listOwnPortfolio
// ---------------------------------------------------------------------------

describe('listOwnPortfolio', () => {
  it('returns ok with the images array on success, scoped to the barber', async () => {
    const rows = [row({ id: 'p1' }), row({ id: 'p2' })];
    const builder = selectEqChain({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnPortfolio('b1');

    expect(result).toEqual({ status: 'ok', images: rows });
    expect(mockFrom).toHaveBeenCalledWith('portfolio');
    expect(builder.eq).toHaveBeenCalledWith('barber_id', 'b1');
  });

  it('defaults to an empty array when data is null', async () => {
    const builder = selectEqChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnPortfolio('b1');
    expect(result).toEqual({ status: 'ok', images: [] });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = selectEqChain({
      data: null,
      error: { code: '42501', message: 'permission denied for table portfolio' },
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await listOwnPortfolio('b1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});
