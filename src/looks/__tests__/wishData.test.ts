import { supabase } from '../../../lib/supabase';
import { acceptOffer, cancelWish, createWish, fetchMyWishes, fetchOpenWishes, fetchWishOffers, sendOffer, withdrawOffer } from '../wishData';

jest.mock('../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../shared/devLog', () => ({ devWarn: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));

const mockRpc = supabase.rpc as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('client side', () => {
  it('sends a wish with the window and the optional photo', async () => {
    mockRpc.mockResolvedValueOnce({ data: { id: 'w-1' }, error: null });
    await expect(createWish({ style: 'taper', day: '2026-10-30', from: '18:00:00', to: '21:00:00', photoPath: 'me/ref.jpg' }))
      .resolves.toEqual({ status: 'ok', value: { id: 'w-1' } });
    expect(mockRpc).toHaveBeenCalledWith('create_wish', { p_style: 'taper', p_day: '2026-10-30', p_from: '18:00:00', p_to: '21:00:00', p_photo_path: 'me/ref.jpg' });
  });

  it('explains the open-wish limit', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PA002', message: 'too many open wishes' } });
    await expect(createWish({ style: 'taper', day: '2026-10-30', from: '18:00:00', to: '21:00:00', photoPath: null }))
      .resolves.toMatchObject({ status: 'error', code: 'limit_reached' });
  });

  it('reads the own wishes newest first and all bookable offers', async () => {
    type Query = { select: jest.Mock; order: jest.Mock; limit: jest.Mock };
    const query: Query = { select: jest.fn(), order: jest.fn(), limit: jest.fn(async () => ({ data: [{ id: 'w-1' }], error: null })) };
    query.select.mockReturnValue(query);
    query.order.mockReturnValue(query);
    mockFrom.mockReturnValueOnce(query);
    await expect(fetchMyWishes()).resolves.toEqual({ status: 'ok', value: [{ id: 'w-1' }] });
    expect(mockFrom).toHaveBeenCalledWith('look_wishes');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });

    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchWishOffers()).resolves.toEqual({ status: 'ok', value: [] });
    expect(mockRpc).toHaveBeenCalledWith('wish_offers', undefined);
  });

  it('links the booking to the offer, and withdraws a wish', async () => {
    mockRpc.mockResolvedValue({ data: {}, error: null });
    await acceptOffer('o-1', 'bk-1');
    expect(mockRpc).toHaveBeenLastCalledWith('accept_offer', { p_offer_id: 'o-1', p_booking_id: 'bk-1' });
    await cancelWish('w-1');
    expect(mockRpc).toHaveBeenLastCalledWith('cancel_wish', { p_wish_id: 'w-1' });
  });
});

describe('barber side', () => {
  it('lists open wishes', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ wish_id: 'w-1' }], error: null });
    await expect(fetchOpenWishes()).resolves.toEqual({ status: 'ok', value: [{ wish_id: 'w-1' }] });
    expect(mockRpc).toHaveBeenCalledWith('open_wishes', undefined);
  });

  it('sends an offer and drops an empty note', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });
    await expect(sendOffer({ wishId: 'w-1', serviceId: 's-1', time: '18:30:00', note: '   ' })).resolves.toEqual({ status: 'ok', value: null });
    expect(mockRpc).toHaveBeenCalledWith('offer_for_wish', { p_wish_id: 'w-1', p_service_id: 's-1', p_time: '18:30:00', p_note: null });
  });

  it.each([
    ['PA041', 'not_free', 'You are not free at that time. Pick another start.'],
    ['PA030', 'blocked_language', 'This contains language that is not allowed on Privelier. Edit it and try again.'],
    ['P0002', 'not_found', 'This look is no longer available.'],
  ])('maps %s to %s', async (code, expected, message) => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code, message: 'raw' } });
    await expect(sendOffer({ wishId: 'w-1', serviceId: 's-1', time: '18:30:00', note: 'Clean fade' })).resolves.toEqual({
      status: 'error', code: expected, message, retryable: false,
    });
  });

  it('withdraws an offer', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });
    await withdrawOffer('o-1');
    expect(mockRpc).toHaveBeenCalledWith('withdraw_offer', { p_offer_id: 'o-1' });
  });
});
