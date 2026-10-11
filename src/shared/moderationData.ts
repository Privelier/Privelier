/**
 * Block, report and account-deletion data layer shared by both apps
 * (Wave 7; migrations 0042 and 0043). Authorization lives in the database:
 * - user_blocks: a user only sees, adds and removes their OWN blocks, and
 *   RESTRICTIVE policies refuse new messages/bookings across a block in
 *   either direction.
 * - user_reports: insert-only for the reporter; founders review them.
 * - delete_own_account(): deletes only auth.uid(), refuses (PA001) while a
 *   pending/accepted booking exists, and cascades everything else.
 *
 * Every function returns a small typed result with calm, already-localized
 * copy; raw server text never reaches the UI.
 */
import { supabase } from '../../lib/supabase';
import { getAppLanguage } from './locale';

export type ReportReason = 'harassment' | 'safety' | 'no_show' | 'inappropriate_content' | 'fraud' | 'other';

export const REPORT_REASONS: readonly ReportReason[] = [
  'harassment',
  'safety',
  'no_show',
  'inappropriate_content',
  'fraud',
  'other',
];

export function reportReasonLabel(reason: ReportReason, language = getAppLanguage()): string {
  const de = language === 'de';
  switch (reason) {
    case 'harassment': return de ? 'Belästigung' : 'Harassment';
    case 'safety': return de ? 'Sicherheitsbedenken' : 'Safety concern';
    case 'no_show': return de ? 'Nicht erschienen' : 'No-show';
    case 'inappropriate_content': return de ? 'Unangemessene Inhalte' : 'Inappropriate content';
    case 'fraud': return de ? 'Betrug oder Spam' : 'Fraud or spam';
    case 'other': return de ? 'Etwas anderes' : 'Something else';
  }
}

export const REPORT_DETAILS_MAX = 1000;

export type ModerationResult = { status: 'ok' } | { status: 'error'; message: string };
export type DeleteAccountResult =
  | { status: 'ok' }
  | { status: 'active_bookings'; message: string }
  | { status: 'error'; message: string };

function errorCopy(raw: { code?: string | null; message?: string | null } | null): string {
  const de = getAppLanguage() === 'de';
  const message = (raw?.message ?? '').toLowerCase();
  if (message.includes('network request failed') || message.includes('failed to fetch')) {
    return de ? 'Keine Verbindung zum Server. Prüfe deine Verbindung.' : 'We could not reach the server. Check your connection and try again.';
  }
  if (raw?.code === '42501' || message.includes('row-level security')) {
    return de ? 'Das ist nicht erlaubt.' : 'You do not have permission to do that.';
  }
  return de ? 'Etwas ist schiefgelaufen. Versuch es gleich noch einmal.' : 'Something went wrong on our side. Try again in a moment.';
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Whether the signed-in user has blocked `userId` (their own blocks only). */
export async function hasBlocked(userId: string): Promise<boolean> {
  const me = await currentUserId();
  if (!me) return false;
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', me)
    .eq('blocked_id', userId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function blockUser(userId: string): Promise<ModerationResult> {
  const me = await currentUserId();
  if (!me) return { status: 'error', message: errorCopy({ code: '42501' }) };
  const { error } = await supabase.from('user_blocks').insert({ blocker_id: me, blocked_id: userId });
  // Already blocked (primary key) is the state the user asked for.
  if (error && error.code !== '23505') return { status: 'error', message: errorCopy(error) };
  return { status: 'ok' };
}

export async function unblockUser(userId: string): Promise<ModerationResult> {
  const me = await currentUserId();
  if (!me) return { status: 'error', message: errorCopy({ code: '42501' }) };
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', me).eq('blocked_id', userId);
  if (error) return { status: 'error', message: errorCopy(error) };
  return { status: 'ok' };
}

export async function reportUser(input: {
  reportedId: string;
  reason: ReportReason;
  details?: string;
  bookingId?: string | null;
}): Promise<ModerationResult> {
  const me = await currentUserId();
  if (!me) return { status: 'error', message: errorCopy({ code: '42501' }) };
  const details = input.details?.trim().slice(0, REPORT_DETAILS_MAX) || null;
  const { error } = await supabase.from('user_reports').insert({
    reporter_id: me,
    reported_id: input.reportedId,
    reason: input.reason,
    details,
    booking_id: input.bookingId ?? null,
  });
  if (error) return { status: 'error', message: errorCopy(error) };
  return { status: 'ok' };
}

/**
 * Delete the signed-in account. Public portfolio images are removed through
 * the Storage API first (SQL cannot reach storage); a failure there does not
 * block deletion, because the rows that reference them are deleted anyway.
 */
export async function deleteOwnAccount(): Promise<DeleteAccountResult> {
  const me = await currentUserId();
  if (!me) return { status: 'error', message: errorCopy({ code: '42501' }) };

  const portfolio = await supabase.from('portfolio').select('image_url').eq('barber_id', me);
  const paths = ((portfolio.data as { image_url: string }[] | null) ?? []).map((row) => row.image_url);
  if (paths.length > 0) await supabase.storage.from('portfolio').remove(paths);

  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    if (error.code === 'PA001') {
      const de = getAppLanguage() === 'de';
      return {
        status: 'active_bookings',
        message: de
          ? 'Du hast noch offene oder bestätigte Termine. Sage sie zuerst ab, dann kannst du dein Konto löschen.'
          : 'You still have pending or accepted bookings. Cancel them first, then you can delete your account.',
      };
    }
    return { status: 'error', message: errorCopy(error) };
  }
  return { status: 'ok' };
}
