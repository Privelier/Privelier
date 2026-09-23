/**
 * Unit tests for the barber conversation data layer
 * (src/barber/conversationData.ts, build-order step 15-16). Mirrors the
 * customer suite, plus the best-effort counterpart lookup via the
 * get_booking_counterparts RPC (migration 0012).
 */
import { supabase } from '../../../lib/supabase';
import {
  fetchBookingCounterpart,
  fetchConversation,
  fetchConversationNewerThan,
  sendMessage,
} from '../conversationData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

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

describe('fetchConversation / sendMessage', () => {
  it('reads a bounded newest-first page scoped to the room and returns ascending rows', async () => {
    const builder = chainable({ data: [], error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await fetchConversation('r1');

    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(builder.eq).toHaveBeenCalledWith('chat_id', 'r1');
    expect(builder.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(41);
    expect(result).toEqual({
      status: 'ok',
      messages: [],
      hasEarlier: false,
      earliestCursor: null,
      latestCursor: null,
    });
  });

  it('uses the strict keyset predicate for a cursor page and rejects malformed cursors locally', async () => {
    const builder = chainable({ data: [], error: null });
    mockFrom.mockReturnValueOnce(builder);
    const cursor = { createdAt: '2026-07-09T10:00:00+00:00', id: 'm-10' };

    await fetchConversation('r1', cursor);

    expect(builder.or).toHaveBeenCalledWith(
      'created_at.lt.2026-07-09T10:00:00+00:00,and(created_at.eq.2026-07-09T10:00:00+00:00,id.lt.m-10)'
    );

    const invalid = await fetchConversation('r1', {
      createdAt: '2026-07-09T10:00:00Z',
      id: 'm-10),chat_id.eq.other-room',
    });
    expect(invalid).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('sends with the session user as sender_id and trims the text', async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'barber-1' } } },
      error: null,
    });
    const created = { id: 'm1', chat_id: 'r1', sender_id: 'barber-1', message: 'On my way', created_at: 't' };
    const builder = chainable({ data: created, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await sendMessage('r1', ' On my way ');

    expect(builder.insert).toHaveBeenCalledWith({
      chat_id: 'r1',
      sender_id: 'barber-1',
      message: 'On my way',
    });
    expect(result).toEqual({ status: 'ok', message: created });
  });

  it('rejects an empty message as invalid_input without touching the network', async () => {
    const result = await sendMessage('r1', '');
    expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('fetchConversationNewerThan', () => {
  it('uses an ascending strict-greater keyset page for reconnect recovery', async () => {
    const rows = [
      {
        id: 'm-11',
        chat_id: 'r1',
        sender_id: 'barber-1',
        message: 'Missed while offline',
        created_at: '2026-07-09T10:00:00+00:00',
      },
    ];
    const builder = chainable({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await fetchConversationNewerThan('r1', {
      createdAt: '2026-07-09T10:00:00+00:00',
      id: 'm-10',
    });

    expect(builder.or).toHaveBeenCalledWith(
      'created_at.gt.2026-07-09T10:00:00+00:00,and(created_at.eq.2026-07-09T10:00:00+00:00,id.gt.m-10)'
    );
    expect(builder.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    expect(result).toEqual({
      status: 'ok',
      messages: rows,
      hasNewer: false,
      latestCursor: { createdAt: rows[0].created_at, id: rows[0].id },
    });
  });
});

describe('fetchBookingCounterpart (best-effort, 0012 RPC)', () => {
  it('returns the counterpart display identity for the booking', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ booking_id: 'b1', id: 'c1', name: 'Tito', profile_image: null }],
      error: null,
    });

    const result = await fetchBookingCounterpart('b1');

    expect(mockRpc).toHaveBeenCalledWith('get_booking_counterparts', { p_booking_ids: ['b1'] });
    expect(result).toEqual({ id: 'c1', name: 'Tito', profile_image: null });
  });

  it('degrades to null on RPC failure — never throws, never fails the screen', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } });
    expect(await fetchBookingCounterpart('b1')).toBeNull();
  });

  it('degrades to null when the RPC returns no row', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await fetchBookingCounterpart('b1')).toBeNull();
  });
});
