/**
 * Look wishes and offers (Looks S5, migration 0067). Every write is a
 * SECURITY DEFINER function that re-checks the flag, the actor, the window,
 * the barber's proof and free time; nothing here is trusted. Barbers never
 * learn who wished; clients see offers on their own wishes only.
 */
import { supabase } from '../../lib/supabase';
import { mapLooksError, type LooksResult } from './looksData';
import type { LookWish, OpenWish, WishOffer } from './types';

const ok = <T,>(value: T): LooksResult<T> => ({ status: 'ok', value });

/** The fallback when a search finds nobody free: ask the city's proven barbers. */
export async function createWish(input: { style: string; day: string; from: string; to: string; photoPath: string | null }): Promise<LooksResult<LookWish>> {
  const { data, error } = await supabase.rpc('create_wish', {
    p_style: input.style,
    p_day: input.day,
    p_from: input.from,
    p_to: input.to,
    p_photo_path: input.photoPath ?? undefined,
  });
  if (error || !data) return mapLooksError('createWish', error);
  return ok(data as LookWish);
}

export async function cancelWish(wishId: string): Promise<LooksResult<null>> {
  const { error } = await supabase.rpc('cancel_wish', { p_wish_id: wishId });
  if (error) return mapLooksError('cancelWish', error);
  return ok(null);
}

/** The caller's recent wishes, newest first (RLS: own rows, flag on). */
export async function fetchMyWishes(): Promise<LooksResult<LookWish[]>> {
  const { data, error } = await supabase.from('look_wishes').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) return mapLooksError('fetchMyWishes', error);
  return ok((Array.isArray(data) ? data : []) as LookWish[]);
}

/** Bookable offers on all of the caller's open wishes, best hit rate first. */
export async function fetchWishOffers(): Promise<LooksResult<WishOffer[]>> {
  const { data, error } = await supabase.rpc('wish_offers');
  if (error) return mapLooksError('fetchWishOffers', error);
  return ok(Array.isArray(data) ? data : []);
}

/** Link the pending booking just made for an offer (after create_booking). */
export async function acceptOffer(offerId: string, bookingId: string): Promise<LooksResult<null>> {
  const { error } = await supabase.rpc('accept_offer', { p_offer_id: offerId, p_booking_id: bookingId });
  if (error) return mapLooksError('acceptOffer', error);
  return ok(null);
}

/** Barber: open wishes in their city for styles they have proven. */
export async function fetchOpenWishes(): Promise<LooksResult<OpenWish[]>> {
  const { data, error } = await supabase.rpc('open_wishes');
  if (error) return mapLooksError('fetchOpenWishes', error);
  return ok(Array.isArray(data) ? (data as OpenWish[]) : []);
}

/** Barber: offer (or change) one start in the window for one own service. */
export async function sendOffer(input: { wishId: string; serviceId: string; time: string; note: string }): Promise<LooksResult<null>> {
  const { error } = await supabase.rpc('offer_for_wish', {
    p_wish_id: input.wishId,
    p_service_id: input.serviceId,
    p_time: input.time,
    p_note: input.note.trim() || undefined,
  });
  if (error) return mapLooksError('sendOffer', error);
  return ok(null);
}

export async function withdrawOffer(offerId: string): Promise<LooksResult<null>> {
  const { error } = await supabase.rpc('withdraw_offer', { p_offer_id: offerId });
  if (error) return mapLooksError('withdrawOffer', error);
  return ok(null);
}
