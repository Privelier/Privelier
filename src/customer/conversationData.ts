/**
 * Customer conversation data layer (build-order step 15-16).
 *
 * Authorization is RLS end to end: `messages_select_participants` scopes the
 * read to rooms the caller belongs to, and `messages_insert_participants`
 * requires `sender_id = auth.uid()` AND room membership — so neither query
 * here re-implements authorization client-side. Messages are immutable (no
 * UPDATE/DELETE policies exist), so this module is fetch + send only.
 *
 * The room itself is created server-side by trg_create_chat_room_for_booking
 * (migration 0013) the moment a booking is inserted — nothing here creates
 * rooms.
 */
import { supabase } from '../../lib/supabase';
import type { MessageRow } from '../types';
import {
  buildConversationHistoryPage,
  buildConversationRecoveryPage,
  conversationKeysetFilter,
  conversationNewerKeysetFilter,
  isConversationCursor,
  MESSAGE_HISTORY_PAGE_SIZE,
} from '../shared/conversationPagination';
import { failure, mapPostgrestError } from './errors';
import type {
  ConversationCursor,
  FetchConversationNewerResult,
  FetchConversationResult,
  SendMessageResult,
} from './types';

/** Reads a bounded newest-first database page and returns ascending display rows. */
export async function fetchConversation(
  roomId: string,
  cursor?: ConversationCursor
): Promise<FetchConversationResult> {
  if (cursor && !isConversationCursor(cursor)) return failure('invalid_input');

  const query = supabase
    .from('messages')
    .select('*')
    .eq('chat_id', roomId);
  const { data, error } = cursor
    ? await query
        .or(conversationKeysetFilter(cursor))
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(MESSAGE_HISTORY_PAGE_SIZE + 1)
    : await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(MESSAGE_HISTORY_PAGE_SIZE + 1);

  if (error) return mapPostgrestError('fetchConversation', error);
  const page = buildConversationHistoryPage((data as MessageRow[]) ?? []);
  return page ? { status: 'ok', ...page } : failure('unknown');
}

/**
 * One ascending, bounded recovery page strictly after a previous REST high-water.
 * The caller merges by id and repeats with `latestCursor` while `hasNewer` is true.
 */
export async function fetchConversationNewerThan(
  roomId: string,
  highWater: ConversationCursor
): Promise<FetchConversationNewerResult> {
  if (!isConversationCursor(highWater)) return failure('invalid_input');

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', roomId)
    .or(conversationNewerKeysetFilter(highWater))
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(MESSAGE_HISTORY_PAGE_SIZE + 1);

  if (error) return mapPostgrestError('fetchConversationNewerThan', error);
  const page = buildConversationRecoveryPage((data as MessageRow[]) ?? []);
  return page ? { status: 'ok', ...page } : failure('unknown');
}

/**
 * Send one message. `sender_id` is never a parameter — it is read from the
 * LOCAL session (getSession, no network round-trip — sends are frequent and
 * latency-visible, unlike booking creation's getUser), matching the RLS
 * `with check`, which is the real authority either way. `.select().single()`
 * returns the authoritative row (server id + created_at) so the caller can
 * merge it immediately; the realtime echo then reconciles to a no-op.
 */
export async function sendMessage(roomId: string, text: string): Promise<SendMessageResult> {
  const message = text.trim();
  if (message.length === 0) return failure('invalid_input');

  const { data: sessionData } = await supabase.auth.getSession();
  const senderId = sessionData.session?.user.id;
  if (!senderId) return failure('forbidden');

  const { data, error } = await supabase
    .from('messages')
    .insert({ chat_id: roomId, sender_id: senderId, message })
    .select()
    .single();

  if (error) return mapPostgrestError('sendMessage', error);
  return { status: 'ok', message: data as MessageRow };
}
