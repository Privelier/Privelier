import { ratingDistribution } from '../BarberProfileScreen';

jest.mock('../../../../lib/supabase', () => ({ supabase: {} }));

it('counts each star level from the loaded reviews, 5 to 1', () => {
  const result = ratingDistribution([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 1 }]);
  expect(result.map((r) => [r.stars, r.count])).toEqual([[5, 2], [4, 1], [3, 0], [2, 0], [1, 1]]);
  expect(result[0].share).toBe(0.5);
});

it('reports zero shares instead of dividing by zero', () => {
  expect(ratingDistribution([]).every((r) => r.count === 0 && r.share === 0)).toBe(true);
});
