/**
 * Block, report and account-deletion data layer shared by both apps
 * (migrations 0042 and 0043). Authorization lives in the database:
 * - user_blocks: a user only sees, adds and removes their OWN blocks, and
 *   RESTRICTIVE policies refuse new messages/bookings across a block in
 *   either direction.
 * - user_reports: insert-only for the reporter; founders review them.
 * - delete_own_account(): deletes only auth.uid(), cancels their upcoming
 *   bookings and keeps the other party's history anonymized (0057).
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
export type DeleteAccountResult = { status: 'ok' } | { status: 'error'; message: string };

function errorCopy(raw: { code?: string | null; message?: string | null } | null): string {
  const de = getAppLanguage() === 'de';
  const message = (raw?.message ?? '').toLowerCase();
  if (message.includes('network request failed') || message.includes('failed to fetch')) {
    return de ? 'Keine Verbindung zum Server. Prüfe deine Verbindung.' : 'We could not reach the server. Check your connection and try again.';
  }
  if (raw?.code === 'PA429') {
    return de ? 'Das war viel in kurzer Zeit. Warte etwas und versuch es dann erneut.' : 'That was a lot in a short time. Wait a little, then try again.';
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

/** What a report points at; the server resolves who wrote a message or review. */
export type ReportTarget =
  | { type: 'user'; userId: string }
  | { type: 'message'; messageId: string }
  | { type: 'review'; reviewId: string }
  | { type: 'look'; lookId: string };

export async function reportUser(input: {
  target: ReportTarget;
  reason: ReportReason;
  details?: string;
  bookingId?: string | null;
}): Promise<ModerationResult> {
  const me = await currentUserId();
  if (!me) return { status: 'error', message: errorCopy({ code: '42501' }) };
  const details = input.details?.trim().slice(0, REPORT_DETAILS_MAX) || null;
  const { target } = input;
  const { error } = await supabase.from('user_reports').insert({
    reporter_id: me,
    reported_id: target.type === 'user' ? target.userId : null,
    target_type: target.type,
    target_id: target.type === 'message' ? target.messageId
      : target.type === 'review' ? target.reviewId
      : target.type === 'look' ? target.lookId
      : null,
    reason: input.reason,
    details,
    booking_id: input.bookingId ?? null,
  });
  if (error) return { status: 'error', message: errorCopy(error) };
  return { status: 'ok' };
}

/**
 * Delete the signed-in account through the `delete-account` Edge Function:
 * it runs delete_own_account() as this user (cancelling upcoming bookings
 * and anonymizing shared history) and then erases the user's portfolio
 * images and verification documents with server-side rights the app never
 * has.
 */
export async function deleteOwnAccount(): Promise<DeleteAccountResult> {
  const me = await currentUserId();
  if (!me) return { status: 'error', message: errorCopy({ code: '42501' }) };

  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    const code = status === 401 ? '42501' : status === 429 ? 'PA429' : undefined;
    return { status: 'error', message: errorCopy({ code }) };
  }
  return { status: 'ok' };
}
