import { supabase } from '../../../lib/supabase';
import { blockUser, deleteOwnAccount, reportUser, unblockUser } from '../moderationData';

jest.mock('../locale', () => ({ getAppLanguage: () => 'en' }));

const mockRemove = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
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
    await reportUser({ reportedId: 'them', reason: 'safety', details: `  ${'x'.repeat(1200)}  `, bookingId: 'b-1' });
    const payload = query.insert.mock.calls[0][0];
    expect(payload).toMatchObject({ reporter_id: 'me', reported_id: 'them', reason: 'safety', booking_id: 'b-1' });
    expect(payload.details).toHaveLength(1000);
  });

  it('maps an RLS denial to calm copy, never raw server text', async () => {
    mockFrom.mockReturnValueOnce(builder({ error: { code: '42501', message: 'new row violates row-level security policy' } }));
    await expect(reportUser({ reportedId: 'them', reason: 'other' })).resolves.toEqual({
      status: 'error', message: 'You do not have permission to do that.',
    });
  });
});

describe('deleteOwnAccount', () => {
  it('removes public portfolio images first, then deletes through the server function', async () => {
    mockFrom.mockReturnValueOnce(builder({ data: [{ image_url: 'me/a.jpg' }, { image_url: 'me/b.jpg' }], error: null }));
    mockRpc.mockResolvedValueOnce({ error: null });
    await expect(deleteOwnAccount()).resolves.toEqual({ status: 'ok' });
    expect(mockRemove).toHaveBeenCalledWith(['me/a.jpg', 'me/b.jpg']);
    expect(mockRpc).toHaveBeenCalledWith('delete_own_account');
  });

  it('explains active bookings (PA001) instead of failing generically', async () => {
    mockFrom.mockReturnValueOnce(builder({ data: [], error: null }));
    mockRpc.mockResolvedValueOnce({ error: { code: 'PA001', message: 'cancel your active bookings' } });
    const result = await deleteOwnAccount();
    expect(result.status).toBe('active_bookings');
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
