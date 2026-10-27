/**
 * The message reads and the send shared by both apps' conversation data
 * layers. Each app passes its own error mappers, so failures keep the app's
 * code set and wording.
 *
 * Authorization is RLS end to end: `messages_select_participants` scopes
 * reads to rooms the caller belongs to, and `messages_insert_participants`
 * requires `sender_id = auth.uid()` AND room membership — nothing here
 * re-implements it. Messages are immutable (no UPDATE/DELETE policies), and
 * rooms are created server-side by trg_create_chat_room_for_booking
 * (migration 0013), so this is fetch + send only.
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
  type ConversationCursor,
  type ConversationHistoryPage,
  type ConversationRecoveryPage,
} from './conversationPagination';
import { UNIQUE_VIOLATION, type PostgrestErrorLike } from './dataErrors';

/** latestCursor stays optional so page mocks without it still type-check. */
type HistoryPageResult = { status: 'ok' } & Omit<ConversationHistoryPage, 'latestCursor'> & { latestCursor?: ConversationCursor | null };

interface ErrorMappers<F> {
  failure: (code: 'invalid_input' | 'forbidden' | 'unknown') => F;
  mapPostgrestError: (context: string, raw: PostgrestErrorLike | null) => F;
}

export function createConversationData<F>({ failure, mapPostgrestError }: ErrorMappers<F>) {
  /** Reads a bounded newest-first database page and returns ascending display rows. */
  async function fetchConversation(roomId: string, cursor?: ConversationCursor): Promise<HistoryPageResult | F> {
    if (cursor && !isConversationCursor(cursor)) return failure('invalid_input');

    let query = supabase.from('messages').select('*').eq('chat_id', roomId);
    if (cursor) query = query.or(conversationKeysetFilter(cursor));
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MESSAGE_HISTORY_PAGE_SIZE + 1);

    if (error) return mapPostgrestError('fetchConversation', error);
    const page = buildConversationHistoryPage((data as MessageRow[]) ?? []);
    return page ? { status: 'ok', ...page } : failure('unknown');
  }

  /**
   * One ascending, bounded recovery page strictly after a previous REST
   * high-water. The caller merges by id and repeats with `latestCursor`
   * while `hasNewer` is true.
   */
  async function fetchConversationNewerThan(roomId: string, highWater: ConversationCursor): Promise<({ status: 'ok' } & ConversationRecoveryPage) | F> {
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
   * Send one message. `sender_id` comes from the LOCAL session (getSession,
   * no network round-trip — sends are frequent and latency-visible),
   * matching the RLS `with check`, which is the real authority either way.
   * `.select().single()` returns the authoritative row so the caller merges
   * it immediately and the realtime echo no-ops. A retried send with the
   * same client id that already landed returns the stored row.
   */
  async function sendMessage(roomId: string, text: string, messageId: string): Promise<{ status: 'ok'; message: MessageRow } | F> {
    const message = text.trim();
    if (message.length === 0) return failure('invalid_input');

    const { data: sessionData } = await supabase.auth.getSession();
    const senderId = sessionData.session?.user.id;
    if (!senderId) return failure('forbidden');

    const { data, error } = await supabase
      .from('messages')
      .insert({ id: messageId, chat_id: roomId, sender_id: senderId, message })
      .select()
      .single();

    if (error?.code === UNIQUE_VIOLATION) {
      const existing = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .eq('chat_id', roomId)
        .eq('sender_id', senderId)
        .maybeSingle();
      if (existing.error) return mapPostgrestError('sendMessage.retry', existing.error);
      if (existing.data && existing.data.message === message) {
        return { status: 'ok', message: existing.data as MessageRow };
      }
    }

    if (error) return mapPostgrestError('sendMessage', error);
    return { status: 'ok', message: data as MessageRow };
  }

  return { fetchConversation, fetchConversationNewerThan, sendMessage };
}
