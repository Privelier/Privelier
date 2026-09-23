/**
 * Barber conversation data layer (build-order step 15-16). Mirrors the
 * customer module — RLS does all authorization (`messages_select_participants`
 * / `messages_insert_participants`); messages are immutable; rooms are
 * created server-side by trg_create_chat_room_for_booking (migration 0013).
 *
 * Counterpart identity: the barber cannot read the customer's name from
 * `users` (own-row-only RLS), so the conversation header resolves it via the
 * narrow `get_booking_counterparts` RPC (migration 0012) — the same
 * best-effort pattern the Requests tab uses: an RPC failure degrades to null
 * and the screen keeps its service-name title.
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
  BookingCounterpart,
  ConversationCursor,
  FetchConversationNewerResult,
  FetchConversationResult,
  SendMessageResult,
} from './types';

/** Row shape returned by the get_booking_counterparts RPC. */
interface CounterpartRpcRow extends BookingCounterpart {
  booking_id: string;
}

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
 * Send one message. `sender_id` comes from the LOCAL session (getSession, no
 * network round-trip — sends are frequent and latency-visible), matching the
 * RLS `with check`, which is the real authority either way.
 * `.select().single()` returns the authoritative row so the caller merges it
 * immediately and the realtime echo no-ops.
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

/**
 * Best-effort counterpart (customer) identity for one booking via the 0012
 * RPC. Returns null on any failure — the caller renders its fallback title
 * rather than failing the screen.
 */
export async function fetchBookingCounterpart(
  bookingId: string
): Promise<BookingCounterpart | null> {
  const { data, error } = await supabase.rpc('get_booking_counterparts', {
    p_booking_ids: [bookingId],
  });
  if (error) {
    mapPostgrestError('fetchBookingCounterpart', error);
    return null;
  }
  const row = ((data as CounterpartRpcRow[]) ?? [])[0];
  return row ? { id: row.id, name: row.name, profile_image: row.profile_image } : null;
}
