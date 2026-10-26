import { supabase } from '../../../lib/supabase';
import { blockUser, deleteOwnAccount, reportUser, unblockUser } from '../moderationData';

jest.mock('../locale', () => ({ getAppLanguage: () => 'en' }));

const mockRemove = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
    storage: { from: jest.fn(() => ({ remove: (...args: unknown[]) => mockRemove(...args) })) },
  },
}));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

type Builder = Record<'insert' | 'delete' | 'select' | 'eq', jest.Mock> & { then: (resolve: (v: unknown) => void) => void };
function builder(result: unknown): Builder {
  const obj = {} as Builder;
  for (const key of ['insert', 'delete', 'select', 'eq'] as const) obj[key] = jest.fn(() => obj);
  obj.then = (resolve) => resolve(result);
  return obj;
}

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'me' } } } });
});

describe('block / unblock', () => {
  it('blocks as the signed-in user and treats an existing block as done', async () => {
    const query = builder({ error: { code: '23505', message: 'duplicate' } });
    mockFrom.mockReturnValueOnce(query);
    await expect(blockUser('them')).resolves.toEqual({ status: 'ok' });
    expect(query.insert).toHaveBeenCalledWith({ blocker_id: 'me', blocked_id: 'them' });
  });

  it('unblocks only the caller\'s own block row', async () => {
    const query = builder({ error: null });
    mockFrom.mockReturnValueOnce(query);
    await expect(unblockUser('them')).resolves.toEqual({ status: 'ok' });
    expect(query.eq).toHaveBeenCalledWith('blocker_id', 'me');
    expect(query.eq).toHaveBeenCalledWith('blocked_id', 'them');
  });
});

describe('reportUser', () => {
  it('sends a bounded, trimmed report as the signed-in user', async () => {
    const query = builder({ error: null });
    mockFrom.mockReturnValueOnce(query);
    await reportUser({ target: { type: 'user', userId: 'them' }, reason: 'safety', details: `  ${'x'.repeat(1200)}  `, bookingId: 'b-1' });
    const payload = query.insert.mock.calls[0][0];
    expect(payload).toMatchObject({
      reporter_id: 'me', reported_id: 'them', target_type: 'user', target_id: null, reason: 'safety', booking_id: 'b-1',
    });
    expect(payload.details).toHaveLength(1000);
  });

  it('reports a message or review by id and lets the server resolve its author', async () => {
    const query = builder({ error: null });
    mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(query);
    await reportUser({ target: { type: 'message', messageId: 'm-1' }, reason: 'harassment' });
    await reportUser({ target: { type: 'review', reviewId: 'r-1' }, reason: 'inappropriate_content' });
    expect(query.insert.mock.calls[0][0]).toMatchObject({ reported_id: null, target_type: 'message', target_id: 'm-1' });
    expect(query.insert.mock.calls[1][0]).toMatchObject({ reported_id: null, target_type: 'review', target_id: 'r-1' });
  });

  it('turns the hourly report limit into calm copy', async () => {
    mockFrom.mockReturnValueOnce(builder({ error: { code: 'PA429', message: 'Too many requests' } }));
    await expect(reportUser({ target: { type: 'user', userId: 'them' }, reason: 'other' })).resolves.toEqual({
      status: 'error', message: 'That was a lot in a short time. Wait a little, then try again.',
    });
  });

  it('maps an RLS denial to calm copy, never raw server text', async () => {
    mockFrom.mockReturnValueOnce(builder({ error: { code: '42501', message: 'new row violates row-level security policy' } }));
    await expect(reportUser({ target: { type: 'user', userId: 'them' }, reason: 'other' })).resolves.toEqual({
      status: 'error', message: 'You do not have permission to do that.',
    });
  });
});

describe('deleteOwnAccount', () => {
  const mockInvoke = supabase.functions.invoke as jest.Mock;

  it('deletes through the server function and never removes storage from the client', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { status: 'deleted' }, error: null });
    await expect(deleteOwnAccount()).resolves.toEqual({ status: 'ok' });
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('maps a rate-limited deletion (429) to calm copy', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { context: { status: 429 } } });
    await expect(deleteOwnAccount()).resolves.toEqual({
      status: 'error', message: 'That was a lot in a short time. Wait a little, then try again.',
    });
  });

  it('returns a typed error when the function fails', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { context: { status: 500 } } });
    await expect(deleteOwnAccount()).resolves.toMatchObject({ status: 'error' });
  });
});
