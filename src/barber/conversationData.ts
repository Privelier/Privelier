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
import { failure, mapPostgrestError } from './errors';
import type {
  BookingCounterpart,
  FetchConversationResult,
  SendMessageResult,
} from './types';

/** Row shape returned by the get_booking_counterparts RPC. */
interface CounterpartRpcRow extends BookingCounterpart {
  booking_id: string;
}

/** Newest-last: the conversation screen renders ascending by created_at. */
export async function fetchConversation(roomId: string): Promise<FetchConversationResult> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', roomId)
    .order('created_at', { ascending: true });

  if (error) return mapPostgrestError('fetchConversation', error);
  return { status: 'ok', messages: (data as MessageRow[]) ?? [] };
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
