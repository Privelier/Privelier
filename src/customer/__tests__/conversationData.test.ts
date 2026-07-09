/**
 * Unit tests for the customer conversation data layer
 * (src/customer/conversationData.ts, build-order step 15-16). Supabase is
 * fully mocked — same chainable approach as the other data-layer suites.
 */
import { supabase } from '../../../lib/supabase';
import { fetchConversation, sendMessage } from '../conversationData';

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
  order: jest.Mock;
  insert: jest.Mock;
  single: jest.Mock;
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
}

function chainable(result: unknown) {
  const obj: ChainableBuilder = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    order: jest.fn(() => obj),
    insert: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

describe('fetchConversation', () => {
  it('reads the room ascending by created_at and returns the rows', async () => {
    const rows = [
      { id: 'm1', chat_id: 'r1', sender_id: 'u1', message: 'hi', created_at: '2026-07-09T10:00:00Z' },
    ];
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await fetchConversation('r1');

    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(builder.eq).toHaveBeenCalledWith('chat_id', 'r1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toEqual({ status: 'ok', messages: rows });
  });

  it('maps an RLS denial (42501) to forbidden', async () => {
    const builder = chainable({ data: null, error: { code: '42501', message: 'denied' } });
    mockFrom.mockReturnValueOnce(builder);

    const result = await fetchConversation('r1');
    expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
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
