import { supabase } from '../../../lib/supabase';
import { fetchOwnAccountStats } from '../accountStatsData';

jest.mock('../../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

function chain(result: unknown) {
  const builder: Record<string, jest.Mock> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.limit = jest.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

it('counts completed cuts, distinct barbers and the average rating given', async () => {
  const bookings = chain({ data: [{ barber_id: 'x' }, { barber_id: 'x' }, { barber_id: 'y' }, { barber_id: null }], error: null });
  const reviews = chain({ data: [{ rating: 5 }, { rating: 4 }], error: null });
  mockFrom.mockImplementation((table: string) => (table === 'bookings' ? bookings : reviews));

  expect(await fetchOwnAccountStats('me')).toEqual({ cuts: 4, barbers: 2, averageRating: 4.5 });
  expect(bookings.eq).toHaveBeenCalledWith('customer_id', 'me');
  expect(bookings.eq).toHaveBeenCalledWith('status', 'completed');
  expect(reviews.eq).toHaveBeenCalledWith('customer_id', 'me');
});

it('has no average before the first review', async () => {
  mockFrom.mockImplementation((table: string) =>
    chain(table === 'bookings' ? { data: [{ barber_id: 'x' }], error: null } : { data: [], error: null })
  );

  expect(await fetchOwnAccountStats('me')).toEqual({ cuts: 1, barbers: 1, averageRating: null });
});

it('returns null when a read fails, so no wrong number is shown', async () => {
  mockFrom.mockImplementation((table: string) =>
    chain(table === 'bookings' ? { data: null, error: { code: '42501', message: 'denied' } } : { data: [], error: null })
  );

  expect(await fetchOwnAccountStats('me')).toBeNull();
});
