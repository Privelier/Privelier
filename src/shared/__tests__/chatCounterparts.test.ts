import { supabase } from '../../../lib/supabase';
import {
  fetchBookingCounterpart,
  fetchBookingCounterparts,
} from '../chatCounterparts';

jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('chat counterpart identity', () => {
  it('batches unique booking ids and maps trimmed identities by booking', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { booking_id: 'b1', id: 'u1', name: ' Julian M. ', profile_image: 'avatar.jpg' },
        { booking_id: 'not-requested', id: 'u2', name: 'Other', profile_image: null },
      ],
      error: null,
    });

    const result = await fetchBookingCounterparts(['b1', 'b1']);

    expect(mockRpc).toHaveBeenCalledWith('get_booking_counterparts', {
      p_booking_ids: ['b1'],
    });
    expect(result).toEqual(
      new Map([
        ['b1', { id: 'u1', name: 'Julian M.', profile_image: 'avatar.jpg' }],
      ])
    );
  });

  it.each([
    ['a returned RPC error', () => mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })],
    ['a thrown network error', () => mockRpc.mockRejectedValueOnce(new Error('offline'))],
  ])('degrades to an empty map after %s', async (_label, arrange) => {
    arrange();
    await expect(fetchBookingCounterparts(['b1'])).resolves.toEqual(new Map());
  });

  it('ignores blank names and skips the RPC for an empty request', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ booking_id: 'b1', id: 'u1', name: '   ', profile_image: null }],
      error: null,
    });
    expect(await fetchBookingCounterparts(['b1'])).toEqual(new Map());

    jest.clearAllMocks();
    await expect(fetchBookingCounterpart('')).resolves.toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
