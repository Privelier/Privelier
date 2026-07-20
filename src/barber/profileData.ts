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
import type {
  FetchOwnBarberProfileResult,
  FetchOwnVerificationRequestResult,
  UpdateBioResult,
} from './types';

/**
 * Max bio length (characters, after trim). Mirrors the DB CHECK
 * `chk_barber_profile_bio_len` (migration 0018); the screen also caps the raw
 * input at this length so the server bound can never be the thing that rejects.
 */
export const MAX_BIO_LENGTH = 500;

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
 * Update the signed-in barber's own bio (build-order step 17, bio-edit run).
 * Per architect-review C1/C2:
 * - Writes ONLY `bio` — never the admin-owned columns (verified/rating/
 *   verification_status are trigger-frozen anyway) nor any identity column.
 *   RLS `barber_profile_update_own` (user_id = auth.uid()) is the sole
 *   authority; `userId` is a row key, not a client-side authorization check.
 * - Normalizes: trims, and an empty/whitespace-only bio is stored as NULL — a
 *   valid "no bio" state and the shape the DB CHECK (`chk_barber_profile_bio_len`,
 *   migration 0018) permits. An over-length bio (only reachable past the
 *   screen's MAX_BIO_LENGTH guard, e.g. a raw caller) is rejected by that CHECK
 *   and surfaces as a mapped 'invalid_input' failure, never raw server text.
 *
 * `not_found` means the update matched no visible row — defensive only, since
 * provisioning creates the row at signup.
 */
export async function updateOwnBio(userId: string, bio: string): Promise<UpdateBioResult> {
  const trimmed = bio.trim();
  const value = trimmed === '' ? null : trimmed;

  const { data, error } = await supabase
    .from('barber_profile')
    .update({ bio: value })
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  // The default 'invalid_input' copy names day/date/times — written for
  // availability windows and meaningless on the bio screen. Same code, bio
  // words (finding L1 from the bio-edit T8 security gate).
  if (error) {
    return mapPostgrestError('updateOwnBio', error, {
      invalid_input: `That bio is not valid. Keep it under ${MAX_BIO_LENGTH} characters and try again.`,
    });
  }
  if (!data) return { status: 'not_found' };
  return { status: 'ok', profile: data as BarberProfileRow };
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
