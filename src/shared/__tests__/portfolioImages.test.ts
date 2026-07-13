/**
 * Unit test for the cross-app portfolio image read helper
 * (src/shared/portfolioImages.ts, build-order step 17). The Supabase client is
 * mocked; the helper is a synchronous public-URL derivation (the `portfolio`
 * bucket is PUBLIC — no signing, no expiry), so there is nothing async to wait
 * on. It only ever derives the URL for a stored object PATH.
 */
import { supabase } from '../../../lib/supabase';
import { getPublicPortfolioUrl } from '../portfolioImages';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

const mockStorageFrom = supabase.storage.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getPublicPortfolioUrl', () => {
  it('derives the public URL for a stored object PATH from the portfolio bucket', () => {
    const getPublicUrl = jest.fn(() => ({
      data: { publicUrl: 'https://cdn.example.com/portfolio/b1/img-1.jpg' },
    }));
    mockStorageFrom.mockReturnValue({ getPublicUrl });

    const url = getPublicPortfolioUrl('b1/img-1.jpg');

    expect(url).toBe('https://cdn.example.com/portfolio/b1/img-1.jpg');
    expect(mockStorageFrom).toHaveBeenCalledWith('portfolio');
    // Passes the PATH straight through — the DB stores the path, never a URL.
    expect(getPublicUrl).toHaveBeenCalledWith('b1/img-1.jpg');
  });
});
