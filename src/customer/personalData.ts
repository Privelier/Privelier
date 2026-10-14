/**
 * Customer favorites and saved addresses (migration 0045). Both are
 * owner-only by RLS; a favorite can only point at an approved barber, and at
 * most 10 addresses can be saved (PA002). Nothing here is visible to barbers.
 */
import { supabase } from '../../lib/supabase';
import { failure, mapPostgrestError, type CustomerDataFailure } from './errors';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
}

export type FavoriteIdsResult = { status: 'ok'; ids: Set<string> } | CustomerDataFailure;
export type SavedAddressesResult = { status: 'ok'; addresses: SavedAddress[] } | CustomerDataFailure;
export type WriteResult = { status: 'ok' } | { status: 'limit_reached' } | CustomerDataFailure;

async function sessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function listFavoriteBarberIds(): Promise<FavoriteIdsResult> {
  const { data, error } = await supabase.from('customer_favorites').select('barber_id');
  if (error) return mapPostgrestError('listFavoriteBarberIds', error);
  return { status: 'ok', ids: new Set(((data as { barber_id: string }[]) ?? []).map((row) => row.barber_id)) };
}

export async function setFavorite(barberId: string, favorite: boolean): Promise<WriteResult> {
  const me = await sessionUserId();
  if (!me) return failure('forbidden');
  if (favorite) {
    const { error } = await supabase.from('customer_favorites').insert({ customer_id: me, barber_id: barberId });
    // Already saved is the requested state.
    if (error && error.code !== '23505') return mapPostgrestError('setFavorite.add', error);
  } else {
    const { error } = await supabase.from('customer_favorites').delete().eq('customer_id', me).eq('barber_id', barberId);
    if (error) return mapPostgrestError('setFavorite.remove', error);
  }
  return { status: 'ok' };
}

export async function listSavedAddresses(): Promise<SavedAddressesResult> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('id, label, address')
    .order('updated_at', { ascending: false });
  if (error) return mapPostgrestError('listSavedAddresses', error);
  return { status: 'ok', addresses: (data as SavedAddress[]) ?? [] };
}

export async function saveAddress(label: string, address: string): Promise<WriteResult> {
  const me = await sessionUserId();
  if (!me) return failure('forbidden');
  const { error } = await supabase
    .from('customer_addresses')
    .insert({ customer_id: me, label: label.trim(), address: address.trim() });
  if (error?.code === 'PA002') return { status: 'limit_reached' };
  if (error) return mapPostgrestError('saveAddress', error);
  return { status: 'ok' };
}

export async function deleteSavedAddress(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
  if (error) return mapPostgrestError('deleteSavedAddress', error);
  return { status: 'ok' };
}
