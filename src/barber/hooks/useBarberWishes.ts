/**
 * Look wishes a barber may answer (Looks S5, flag-gated): open wishes in
 * their city for styles they have proven, their own services, the wish
 * photos (short-lived signed links) and the offer form state. The server
 * re-checks everything; a refused start ("not free") comes back as calm copy.
 */
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { fetchLookStyles, signReferencePhoto } from '../../looks/looksData';
import type { LookStyle, OpenWish } from '../../looks/types';
import { fetchOpenWishes, sendOffer, withdrawOffer } from '../../looks/wishData';
import type { ServiceRow } from '../../types';
import { listOwnServices } from '../servicesData';

export interface OfferDraft {
  serviceId: string | null;
  time: string | null;
  note: string;
}

const EMPTY_DRAFT: OfferDraft = { serviceId: null, time: null, note: '' };

export function useBarberWishes() {
  const [wishes, setWishes] = useState<OpenWish[] | null>(null);
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, OfferDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const barberId = data.session?.user.id;
    const [open, styleList, own] = await Promise.all([
      fetchOpenWishes(),
      fetchLookStyles(),
      barberId ? listOwnServices(barberId) : Promise.resolve(null),
    ]);
    if (styleList.status === 'ok') setStyles(styleList.value);
    if (own?.status === 'ok') setServices(own.services);
    if (open.status !== 'ok') {
      setLoadError(open.message);
      setWishes((current) => current ?? []);
      return;
    }
    setLoadError(null);
    setWishes(open.value);
    const signed = await Promise.all(open.value
      .filter((wish) => wish.photo_path)
      .map(async (wish) => [wish.wish_id, await signReferencePhoto(wish.photo_path as string)] as const));
    setPhotos(Object.fromEntries(signed.filter((entry): entry is readonly [string, string] => entry[1] !== null)));
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const draftFor = (wish: OpenWish): OfferDraft => drafts[wish.wish_id]
    ?? (wish.my_offer_status === 'open'
      ? { serviceId: wish.my_offer_service_id, time: wish.my_offer_time, note: wish.my_offer_note ?? '' }
      : EMPTY_DRAFT);

  const editDraft = (wish: OpenWish, patch: Partial<OfferDraft>) => {
    setDrafts((current) => ({ ...current, [wish.wish_id]: { ...draftFor(wish), ...patch } }));
  };

  const run = async (wishId: string, work: () => Promise<{ status: 'ok' } | { status: 'error'; message: string }>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(wishId);
    setErrors((current) => ({ ...current, [wishId]: '' }));
    const result = await work();
    busyRef.current = false;
    setBusyId(null);
    if (result.status !== 'ok') {
      setErrors((current) => ({ ...current, [wishId]: result.message }));
      return;
    }
    setDrafts((current) => {
      const { [wishId]: _done, ...rest } = current;
      return rest;
    });
    await load();
  };

  return {
    wishes,
    styles,
    services,
    photos,
    loadError,
    busyId,
    errorFor: (wishId: string) => errors[wishId] || null,
    draftFor,
    editDraft,
    send: (wish: OpenWish) => {
      const draft = draftFor(wish);
      if (!draft.serviceId || !draft.time) return Promise.resolve();
      const { serviceId, time, note } = draft;
      return run(wish.wish_id, () => sendOffer({ wishId: wish.wish_id, serviceId, time, note }));
    },
    withdraw: (wish: OpenWish) => (wish.my_offer_id ? run(wish.wish_id, () => withdrawOffer(wish.my_offer_id as string)) : Promise.resolve()),
  };
}
