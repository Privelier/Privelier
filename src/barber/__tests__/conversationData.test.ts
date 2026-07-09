/**
 * Unit tests for the barber conversation data layer
 * (src/barber/conversationData.ts, build-order step 15-16). Mirrors the
 * customer suite, plus the best-effort counterpart lookup via the
 * get_booking_counterparts RPC (migration 0012).
 */
import { supabase } from '../../../lib/supabase';
import { fetchBookingCounterpart, fetchConversation, sendMessage } from '../conversationData';

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

describe('fetchConversation / sendMessage', () => {
  it('reads ascending by created_at scoped to the room', async () => {
    const builder = chainable({ data: [], error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await fetchConversation('r1');

    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(builder.eq).toHaveBeenCalledWith('chat_id', 'r1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toEqual({ status: 'ok', messages: [] });
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
