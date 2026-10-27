/**
 * Barber conversation data layer: the shared message reads and send
 * (src/shared/conversationData), with barber error codes and wording.
 *
 * Counterpart identity: the barber cannot read the customer's name from
 * `users` (own-row-only RLS), so the conversation header resolves it via the
 * narrow `get_booking_counterparts` RPC (migration 0012) — the same
 * best-effort pattern the Requests tab uses: an RPC failure degrades to null
 * and the screen keeps its service-name title.
 */
import { supabase } from '../../lib/supabase';
import { createConversationData } from '../shared/conversationData';
import { failure, mapPostgrestError } from './errors';
import type { BookingCounterpart } from './types';

export const { fetchConversation, fetchConversationNewerThan, sendMessage } = createConversationData({ failure, mapPostgrestError });

/** Row shape returned by the get_booking_counterparts RPC. */
interface CounterpartRpcRow extends BookingCounterpart {
  booking_id: string;
}

/**
 * Best-effort counterpart (customer) identity for one booking via the 0012
 * RPC. Returns null on any failure — the caller renders its fallback title
 * rather than failing the screen.
 */
export async function fetchBookingCounterpart(bookingId: string): Promise<BookingCounterpart | null> {
  const { data, error } = await supabase.rpc('get_booking_counterparts', { p_booking_ids: [bookingId] });
  if (error) {
    mapPostgrestError('fetchBookingCounterpart', error);
    return null;
  }
  const row = ((data as CounterpartRpcRow[]) ?? [])[0];
  return row ? { id: row.id, name: row.name, profile_image: row.profile_image } : null;
}
