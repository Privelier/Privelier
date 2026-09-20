import { supabase } from '../../lib/supabase';
import type { UsersRow } from '../types';
import { failure, mapPostgrestError, type CustomerDataFailure } from './errors';

export type UpdateOwnProfileResult = { status: 'ok'; profile: UsersRow } | CustomerDataFailure;

/**
 * Location is derived by the foreground eligibility gate, never manually
 * editable in profile settings. This surface intentionally permits name only.
 */
export async function updateOwnProfile(input: { name: string }): Promise<UpdateOwnProfileResult> {
  const name = input.name.trim();
  if (name.length < 2) return failure('invalid_input');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return failure(userError ? 'network' : 'forbidden');

  const { data, error } = await supabase
    .from('users')
    .update({ name })
    .eq('id', userData.user.id)
    .select('*')
    .single();
  if (error) return mapPostgrestError('updateOwnProfile', error);
  return { status: 'ok', profile: data as UsersRow };
}
