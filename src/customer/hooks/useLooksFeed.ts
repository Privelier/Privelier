/**
 * The Discover looks rail (Looks S3, behind the 'looks' flag): published
 * looks in the client's city with a signed first photo each, an optional
 * style filter, and portfolio images of directory barbers to fill a thin
 * feed. Proof looks always come first; portfolio tiles are labelled as not
 * verified. A failure hides the rail rather than showing an error on Discover.
 */
import { useCallback, useEffect, useState } from 'react';
import { getPublicPortfolioUrl } from '../../shared/portfolioImages';
import { fetchLooksFeed, fetchLookStyles, fetchPortfolioFallback, signLookPhotos, type PortfolioFallbackTile } from '../../looks/looksData';
import type { FeedLook, LookStyle } from '../../looks/types';

/** Below this many proof looks, portfolio tiles fill the rail. */
const THIN_FEED = 4;

export interface FeedTile {
  key: string;
  kind: 'proof' | 'portfolio';
  barberId: string;
  lookId: string | null;
  imageUri: string | null;
}

export function feedTiles(looks: readonly FeedLook[], urls: ReadonlyMap<string, string>, portfolio: readonly PortfolioFallbackTile[]): FeedTile[] {
  const proof: FeedTile[] = looks.map((look) => ({
    key: `look-${look.look_id}`,
    kind: 'proof',
    barberId: look.barber_id,
    lookId: look.look_id,
    imageUri: look.photo_paths[0] ? urls.get(look.photo_paths[0]) ?? null : null,
  }));
  if (proof.length >= THIN_FEED) return proof;
  const fill: FeedTile[] = portfolio.map((row) => ({
    key: `portfolio-${row.id}`,
    kind: 'portfolio',
    barberId: row.barber_id,
    lookId: null,
    imageUri: getPublicPortfolioUrl(row.image_url),
  }));
  return [...proof, ...fill];
}

export function useLooksFeed(directoryBarberIds: readonly string[]) {
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [style, setStyle] = useState<string | null>(null);
  const [looks, setLooks] = useState<FeedLook[]>([]);
  const [tiles, setTiles] = useState<FeedTile[]>([]);
  const [ready, setReady] = useState(false);
  const idsKey = directoryBarberIds.join(',');

  const load = useCallback(async (selectedStyle: string | null) => {
    const [feed, styleResult] = await Promise.all([fetchLooksFeed({ style: selectedStyle }), fetchLookStyles()]);
    if (styleResult.status === 'ok') setStyles(styleResult.value);
    const found = feed.status === 'ok' ? feed.value : [];
    const [urls, portfolio] = await Promise.all([
      signLookPhotos(found.map((look) => look.photo_paths[0]).filter((path): path is string => Boolean(path))),
      found.length < THIN_FEED && !selectedStyle ? fetchPortfolioFallback(idsKey ? idsKey.split(',') : []) : Promise.resolve([]),
    ]);
    setLooks(found);
    setTiles(feedTiles(found, urls, portfolio));
    setReady(feed.status === 'ok');
  }, [idsKey]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load(style);
    });
    return () => {
      active = false;
    };
  }, [load, style]);

  return { styles, style, setStyle, looks, tiles, ready };
}
