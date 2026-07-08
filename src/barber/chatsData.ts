/**
 * Barber chats data layer (Chats tab of the UI rebuild).
 *
 * Read-only mirror of the customer inbox data layer: sending messages and
 * Realtime subscriptions are build-order step 15-16. RLS
 * (`chat_rooms_select_participants` / `messages_select_participants`)
 * scopes every read to the caller's own rooms.
 *
 * No counterpart identity: users RLS is own-row-only, so a barber cannot
 * read the customer's name/photo (same gap as the Requests tab, tracked
 * for step 13-14 in CLAUDE.md). Threads carry `barber: null` and the
 * screen leads with the booking's service instead.
 */
import { supabase } from '../../lib/supabase';
import type { BookingRow, ChatRoomRow, MessageRow, ServiceRow } from '../types';
import { buildInboxThreads } from '../shared/threads';
import { mapPostgrestError } from './errors';
import type { OwnChatsViewResult } from './types';

/** Same MVP-scale cap rationale as the customer inbox scan. */
const MESSAGES_SCAN_LIMIT = 200;

/** The signed-in barber's chat threads, assembled for the Chats list. */
export async function fetchOwnChatsView(): Promise<OwnChatsViewResult> {
  const { data, error } = await supabase.from('chat_rooms').select('*');
  if (error) return mapPostgrestError('fetchOwnChatsView', error);
  const rooms = (data as ChatRoomRow[]) ?? [];
  if (rooms.length === 0) return { status: 'ok', threads: [] };

  const roomIds = rooms.map((r) => r.id);
  const bookingIds = [...new Set(rooms.map((r) => r.booking_id))];

  const [messagesResult, bookingsResult] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .in('chat_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_SCAN_LIMIT),
    supabase.from('bookings').select('*').in('id', bookingIds),
  ]);

  const bookingsById = new Map<string, BookingRow>();
  for (const row of (bookingsResult.data as BookingRow[]) ?? []) bookingsById.set(row.id, row);

  const servicesById = new Map<string, ServiceRow>();
  const serviceIds = [...new Set([...bookingsById.values()].map((b) => b.service_id))];
  if (serviceIds.length > 0) {
    const servicesResult = await supabase.from('services').select('*').in('id', serviceIds);
    for (const row of (servicesResult.data as ServiceRow[]) ?? []) servicesById.set(row.id, row);
  }

  const threads = buildInboxThreads(
    rooms,
    (messagesResult.data as MessageRow[]) ?? [],
    bookingsById,
    new Map(), // no counterpart lookup — see file header
    servicesById
  );
  return { status: 'ok', threads };
}
