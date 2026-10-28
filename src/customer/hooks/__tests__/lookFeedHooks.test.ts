import { renderHook } from '@testing-library/react-native';
import { attachLookReference } from '../../../looks/looksData';
import type { FeedLook } from '../../../looks/types';
import type { BookingRow } from '../../../types';
import { useAttachLookReference } from '../useAttachLookReference';
import { feedTiles } from '../useLooksFeed';

jest.mock('../../../looks/looksData', () => ({
  attachLookReference: jest.fn(async () => ({ status: 'ok', value: null })),
  fetchLooksFeed: jest.fn(),
  fetchLookStyles: jest.fn(),
  fetchPortfolioFallback: jest.fn(),
  signLookPhotos: jest.fn(),
}));
jest.mock('../../../shared/portfolioImages', () => ({ getPublicPortfolioUrl: (path: string) => `https://public/${path}` }));

const look = (id: string): FeedLook => ({
  look_id: id, barber_id: 'x', barber_name: 'Xavier', barber_image: null, barber_rating: 5, styles: ['taper'],
  service_id: 's', service_name: 'Fade', service_price: 35, service_duration: 60, published_at: '2026-10-28T10:00:00Z',
  review_rating: 5, arrival_confirmed: true, proof_count: 3, photo_paths: [`x/${id}.jpg`],
});
const portfolio = [{ id: 'p1', barber_id: 'y', image_url: 'y/p1.jpg' }];

describe('feedTiles', () => {
  it('puts proof looks first and fills a thin feed with labelled portfolio tiles', () => {
    const tiles = feedTiles([look('a')], new Map([['x/a.jpg', 'https://signed/a']]), portfolio);
    expect(tiles.map((t) => [t.kind, t.lookId, t.imageUri])).toEqual([
      ['proof', 'a', 'https://signed/a'],
      ['portfolio', null, 'https://public/y/p1.jpg'],
    ]);
  });

  it('shows only proof looks once the feed is not thin', () => {
    const tiles = feedTiles(['a', 'b', 'c', 'd'].map(look), new Map(), portfolio);
    expect(tiles.every((t) => t.kind === 'proof')).toBe(true);
    expect(tiles[0].imageUri).toBeNull();
  });
});

describe('useAttachLookReference', () => {
  const booking = { id: 'bk-1' } as BookingRow;

  it('does nothing for an ordinary booking', async () => {
    await renderHook(() => useAttachLookReference(booking, undefined));
    expect(attachLookReference).not.toHaveBeenCalled();
  });

  it('attaches once the request exists, and only once', async () => {
    const ref = { lookId: 'l-1', style: 'taper' };
    const hook = await renderHook(({ created }: { created: BookingRow | null }) => useAttachLookReference(created, ref), {
      initialProps: { created: null as BookingRow | null },
    });
    expect(attachLookReference).not.toHaveBeenCalled();
    await hook.rerender({ created: booking });
    await hook.rerender({ created: { ...booking } });
    expect(attachLookReference).toHaveBeenCalledTimes(1);
    expect(attachLookReference).toHaveBeenCalledWith({ bookingId: 'bk-1', lookId: 'l-1', style: 'taper' });
  });
});
