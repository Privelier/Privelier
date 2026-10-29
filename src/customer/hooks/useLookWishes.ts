/**
 * The client's look wishes and the bookable offers on them (Looks S5,
 * flag-gated). Reloads whenever the screen gains focus, so an offer that
 * arrived by push is there on return.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchBookableService, fetchLookStyles } from '../../looks/looksData';
import type { LookStyle, LookWish, WishOffer } from '../../looks/types';
import { cancelWish, fetchMyWishes, fetchWishOffers } from '../../looks/wishData';

export function useLookWishes() {
  const [wishes, setWishes] = useState<LookWish[] | null>(null);
  const [offers, setOffers] = useState<WishOffer[]>([]);
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [mine, open, styleList] = await Promise.all([fetchMyWishes(), fetchWishOffers(), fetchLookStyles()]);
    if (styleList.status === 'ok') setStyles(styleList.value);
    if (mine.status !== 'ok') {
      setError(mine.message);
      setWishes((current) => current ?? []);
      return;
    }
    setError(open.status === 'ok' ? null : open.message);
    setWishes(mine.value);
    setOffers(open.status === 'ok' ? open.value : []);
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const cancel = useCallback(async (wishId: string) => {
    setBusyId(wishId);
    const result = await cancelWish(wishId);
    setBusyId(null);
    if (result.status !== 'ok') setError(result.message);
    await load();
  }, [load]);

  return {
    wishes,
    styles,
    error,
    busyId,
    cancel,
    offersFor: (wishId: string) => offers.filter((offer) => offer.wish_id === wishId),
    /** The real service row for booking an offer (null if it was removed). */
    serviceFor: (offer: WishOffer) => fetchBookableService(offer.service_id),
  };
}
