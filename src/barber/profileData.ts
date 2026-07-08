/**
 * Barber own-profile read (Studio/Verify tabs of the UI rebuild).
 *
 * Read-only. `barber_profile` RLS
 * (`barber_profile_select_own_or_admin_or_approved`) lets a barber read
 * their own row, which is all this module ever asks for. The admin-owned
 * columns (`verified`, `verification_status`, `rating`) are display-only
 * here — writes to them are trigger-reverted for app clients by design
 * (migration 0005), and nothing in the UI layer may attempt one.
 */
import { supabase } from '../../lib/supabase';
import type { BarberProfileRow, VerificationRequestRow } from '../types';
import { mapPostgrestError } from './errors';
import type { FetchOwnBarberProfileResult, FetchOwnVerificationRequestResult } from './types';

/**
 * The signed-in barber's own barber_profile row. `profile: null` means the
 * row does not exist yet (provisioning creates it at signup, so this is a
 * defensive case, not an expected state).
 */
export async function fetchOwnBarberProfile(
  userId: string
): Promise<FetchOwnBarberProfileResult> {
  const { data, error } = await supabase
    .from('barber_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return mapPostgrestError('fetchOwnBarberProfile', error);
  return { status: 'ok', profile: (data as BarberProfileRow | null) ?? null };
}

/**
 * The signed-in barber's verification request, if any (newest first if
 * several exist). Read-only — submitting documents is build-order step 17;
 * reviewing them is the founders', via the dashboard, never the app's.
 */
export async function fetchOwnVerificationRequest(
  userId: string
): Promise<FetchOwnVerificationRequestResult> {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) return mapPostgrestError('fetchOwnVerificationRequest', error);
  return { status: 'ok', request: (data as VerificationRequestRow | null) ?? null };
}
