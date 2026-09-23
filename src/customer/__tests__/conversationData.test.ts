/**
 * Unit tests for the customer conversation data layer
 * (src/customer/conversationData.ts, build-order step 15-16). Supabase is
 * fully mocked — same chainable approach as the other data-layer suites.
 */
import { supabase } from '../../../lib/supabase';
import { fetchConversation, fetchConversationNewerThan, sendMessage } from '../conversationData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

interface ChainableBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  or: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  insert: jest.Mock;
  single: jest.Mock;
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
}

function chainable(result: unknown) {
  const obj: ChainableBuilder = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    or: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

describe('fetchConversation', () => {
  it('reads the newest 41 rows and returns the page in ascending display order', async () => {
    const rows = [
      { id: 'm1', chat_id: 'r1', sender_id: 'u1', message: 'hi', created_at: '2026-07-09T10:00:00Z' },
    ];
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await fetchConversation('r1');

    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(builder.eq).toHaveBeenCalledWith('chat_id', 'r1');
    expect(builder.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(41);
    expect(result).toEqual({
      status: 'ok',
      messages: rows,
      hasEarlier: false,
      earliestCursor: { createdAt: rows[0].created_at, id: rows[0].id },
      latestCursor: { createdAt: rows[0].created_at, id: rows[0].id },
    });
  });

  it('uses a strict composite predicate for an older page, including timestamp ties', async () => {
    const builder = chainable({ data: [], error: null });
    mockFrom.mockReturnValueOnce(builder);
    const cursor = { createdAt: '2026-07-09T10:00:00Z', id: 'm_10' };

    const result = await fetchConversation('r1', cursor);

    expect(builder.or).toHaveBeenCalledWith(
      'created_at.lt.2026-07-09T10:00:00Z,and(created_at.eq.2026-07-09T10:00:00Z,id.lt.m_10)'
    );
    expect(result).toEqual({
      status: 'ok',
      messages: [],
      hasEarlier: false,
      earliestCursor: null,
      latestCursor: null,
    });
  });

  it('uses the 41st row only as an earlier-page probe and derives the cursor from row 40', async () => {
    const rows = Array.from({ length: 41 }, (_, index) => ({
      id: `m_${index}`,
      chat_id: 'r1',
      sender_id: 'u1',
      message: String(index),
      created_at: `2026-07-09T10:00:${String(59 - index).padStart(2, '0')}Z`,
    }));
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await fetchConversation('r1');

    expect(result).toEqual({
      status: 'ok',
      messages: rows.slice(0, 40).reverse(),
      hasEarlier: true,
      earliestCursor: { createdAt: rows[39].created_at, id: rows[39].id },
      latestCursor: { createdAt: rows[0].created_at, id: rows[0].id },
    });
  });

  it('rejects an unsafe cursor before making a request', async () => {
    const result = await fetchConversation('r1', {
      createdAt: '2026-07-09T10:00:00Z),id.lt.injected',
      id: 'm_10',
    });

    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({ data: null, error: { code: '42501', message: 'denied' } });
    mockFrom.mockReturnValueOnce(builder);

    const result = await fetchConversation('r1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});

describe('fetchConversationNewerThan', () => {
  it('pages strictly newer rows ascending with a tie-safe high-water and 41st-row probe', async () => {
    const rows = Array.from({ length: 41 }, (_, index) => ({
      id: `m_${index + 11}`,
      chat_id: 'r1',
      sender_id: 'u1',
      message: String(index),
      created_at: `2026-07-09T10:00:${String(index).padStart(2, '0')}Z`,
    }));
    rows[0].created_at = '2026-07-09T10:00:00Z';
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);
    const highWater = { createdAt: '2026-07-09T10:00:00Z', id: 'm_10' };

    const result = await fetchConversationNewerThan('r1', highWater);

    expect(builder.or).toHaveBeenCalledWith(
      'created_at.gt.2026-07-09T10:00:00Z,and(created_at.eq.2026-07-09T10:00:00Z,id.gt.m_10)'
    );
    expect(builder.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    expect(builder.limit).toHaveBeenCalledWith(41);
    expect(result).toEqual({
      status: 'ok',
      messages: rows.slice(0, 40),
      hasNewer: true,
      latestCursor: { createdAt: rows[39].created_at, id: rows[39].id },
    });
  });

  it('rejects a malformed high-water before making a request', async () => {
    const result = await fetchConversationNewerThan('r1', {
      createdAt: '2026-07-09T10:00:00Z',
      id: 'm_10),id.gt.injected',
    });

    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('sendMessage', () => {
  it('inserts trimmed text with the SESSION user as sender_id and returns the authoritative row', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'me' } } }, error: null });
    const created = {
      id: 'm9',
      chat_id: 'r1',
      sender_id: 'me',
      message: 'Hello there',
      created_at: '2026-07-09T10:05:00Z',
    };
    const builder = chainable({ data: created, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await sendMessage('r1', '  Hello there  ');

    expect(builder.insert).toHaveBeenCalledWith({
      chat_id: 'r1',
      sender_id: 'me',
      message: 'Hello there',
    });
    expect(result).toEqual({ status: 'ok', message: created });
  });

  it('rejects an empty/whitespace message as invalid_input without touching the network', async () => {
    const result = await sendMessage('r1', '   ');

    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns forbidden when there is no local session, without inserting', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    const result = await sendMessage('r1', 'hi');

    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('maps an insert RLS denial (42501 — e.g. not a room participant) to forbidden', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'me' } } }, error: null });
    const builder = chainable({ data: null, error: { code: '42501', message: 'denied' } });
    mockFrom.mockReturnValueOnce(builder);

    const result = await sendMessage('r1', 'hi');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
  });
});
