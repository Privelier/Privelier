import { supabase } from '../../lib/supabase';
import type { UsersRow } from '../types';
import { failure, mapPostgrestError, type CustomerDataFailure } from './errors';

export type UpdateOwnProfileResult = { status: 'ok'; profile: UsersRow } | CustomerDataFailure;

export async function updateOwnProfile(input: {
  name: string;
  city: string;
  country?: string;
}): Promise<UpdateOwnProfileResult> {
  const name = input.name.trim();
  const city = input.city.trim();
  const country = input.country?.trim() || null;
  if (name.length < 2 || city.length < 2) return failure('invalid_input');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return failure(userError ? 'network' : 'forbidden');

  const { data, error } = await supabase
    .from('users')
    .update({ name, city, country })
    .eq('id', userData.user.id)
    .select('*')
    .single();
  if (error) return mapPostgrestError('updateOwnProfile', error);
  return { status: 'ok', profile: data as UsersRow };
}
