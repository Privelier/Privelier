/**
 * Unit tests for the reviews data layer (src/customer/reviewsData.ts, step 18).
 * The Supabase client is mocked entirely, matching bookingCreateData.test.ts.
 *
 * SCOPE CAVEAT (the twice-learned lesson): a mocked client cannot see the 0022
 * RLS predicate, the completed-booking trigger, or the aggregation trigger —
 * those are proven by the live rolled-back probes in the migration commit, NOT
 * here. What these tests DO pin is the client contract: the write payload shape
 * (customer_id sourced from the session, never a parameter; barber_id passed
 * through for RLS to judge; empty comment -> null), the 23505 -> already_reviewed
 * branch staying distinct from the generic mapper, and the best-effort name
 * enrichment degrading rather than failing the list.
 */
import { supabase } from '../../../lib/supabase';
import {
  fetchOwnReviewedBookingIds,
  fetchReviewsForBarber,
  submitReview,
} from '../reviewsData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * A chain object where every builder method returns itself, `single()`
 * resolves the result, and the object is itself awaitable (so terminal
 * `.order()`/`.in()` chains resolve too). Mirrors the other data-layer tests'
 * `chainable`, widened for this module's read+write shapes.
 */
function chainable(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'eq', 'in', 'order']) {
    obj[m] = jest.fn(() => obj);
  }
  obj.single = jest.fn(() => Promise.resolve(result));
  obj.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return obj;
}

const AUTHED = { data: { user: { id: 'cust-1' } }, error: null };

// ---------------------------------------------------------------------------
// submitReview
// ---------------------------------------------------------------------------

describe('submitReview', () => {
  const INPUT = { bookingId: 'bk-1', barberId: 'brb-1', rating: 4, comment: 'Great cut' };

  it('sources customer_id from the session and never from a parameter', async () => {
    mockGetUser.mockResolvedValue(AUTHED);
    const chain = chainable({ data: { id: 'rv-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await submitReview(INPUT);

    expect(result.status).toBe('ok');
    expect(mockFrom).toHaveBeenCalledWith('reviews');
    const payload = (chain.insert as jest.Mock).mock.calls[0][0];
    expect(payload).toEqual({
      booking_id: 'bk-1',
      customer_id: 'cust-1', // from the session, NOT the input
      barber_id: 'brb-1',
      rating: 4,
      comment: 'Great cut',
    });
  });

  it('stores an empty / whitespace-only comment as null (D4 optional comment)', async () => {
    mockGetUser.mockResolvedValue(AUTHED);
    const chain = chainable({ data: { id: 'rv-2' }, error: null });
    mockFrom.mockReturnValue(chain);

    await submitReview({ ...INPUT, comment: '   ' });

    expect((chain.insert as jest.Mock).mock.calls[0][0].comment).toBeNull();
  });

  it('maps a 23505 (booking_id UNIQUE) to already_reviewed, not the generic error', async () => {
    mockGetUser.mockResolvedValue(AUTHED);
    mockFrom.mockReturnValue(chainable({ data: null, error: { code: '23505' } }));

    const result = await submitReview(INPUT);

    expect(result.status).toBe('already_reviewed');
  });

  it('maps the RLS rejection (42501) through the shared mapper to forbidden', async () => {
    mockGetUser.mockResolvedValue(AUTHED);
    mockFrom.mockReturnValue(chainable({ data: null, error: { code: '42501' } }));

    const result = await submitReview(INPUT);

    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });

  it('returns forbidden when there is no session, without hitting the table', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await submitReview(INPUT);

    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fetchReviewsForBarber
// ---------------------------------------------------------------------------

describe('fetchReviewsForBarber', () => {
  it('returns reviews and a first-name map keyed by review id', async () => {
    const reviews = [
      { id: 'rv-1', barber_id: 'brb-1', customer_id: 'c-1', rating: 5 },
      { id: 'rv-2', barber_id: 'brb-1', customer_id: 'c-2', rating: 3 },
    ];
    mockFrom.mockReturnValue(chainable({ data: reviews, error: null }));
    mockRpc.mockResolvedValue({
      data: [
        { review_id: 'rv-1', first_name: 'Ali' },
        { review_id: 'rv-2', first_name: '' }, // blank -> omitted
      ],
      error: null,
    });

    const result = await fetchReviewsForBarber('brb-1');

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.reviews).toHaveLength(2);
    expect(result.firstNameByReviewId.get('rv-1')).toBe('Ali');
    expect(result.firstNameByReviewId.has('rv-2')).toBe(false); // blank name not stored
    expect(mockRpc).toHaveBeenCalledWith('get_review_authors', { p_review_ids: ['rv-1', 'rv-2'] });
  });

  it('degrades to no names (not a failure) when the author projection errors', async () => {
    mockFrom.mockReturnValue(chainable({ data: [{ id: 'rv-1', barber_id: 'brb-1' }], error: null }));
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await fetchReviewsForBarber('brb-1');

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.reviews).toHaveLength(1);
    expect(result.firstNameByReviewId.size).toBe(0);
  });

  it('does not call the author RPC when there are no reviews', async () => {
    mockFrom.mockReturnValue(chainable({ data: [], error: null }));

    const result = await fetchReviewsForBarber('brb-1');

    expect(result.status).toBe('ok');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fails the whole call when the reviews read itself errors', async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: { code: '42501' } }));

    const result = await fetchReviewsForBarber('brb-1');

    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});

// ---------------------------------------------------------------------------
// fetchOwnReviewedBookingIds
// ---------------------------------------------------------------------------

describe('fetchOwnReviewedBookingIds', () => {
  it('short-circuits on an empty input with no query', async () => {
    const result = await fetchOwnReviewedBookingIds([]);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.reviewedBookingIds.size).toBe(0);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns the subset of booking ids the caller has reviewed', async () => {
    mockGetUser.mockResolvedValue(AUTHED);
    mockFrom.mockReturnValue(
      chainable({ data: [{ booking_id: 'bk-1' }, { booking_id: 'bk-3' }], error: null })
    );

    const result = await fetchOwnReviewedBookingIds(['bk-1', 'bk-2', 'bk-3']);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.reviewedBookingIds.has('bk-1')).toBe(true);
    expect(result.reviewedBookingIds.has('bk-2')).toBe(false);
    expect(result.reviewedBookingIds.has('bk-3')).toBe(true);
  });

  it('returns forbidden with no session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await fetchOwnReviewedBookingIds(['bk-1']);

    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
