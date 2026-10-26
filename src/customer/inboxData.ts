/**
 * Customer inbox data layer (Inbox tab of the UI rebuild).
 *
 * Read-only: full chat (sending, Realtime subscriptions) lives in
 * conversationData.ts. Authorization is RLS end to end —
 * `chat_rooms_select_participants` / `messages_select_participants` scope
 * every read to rooms the caller participates in, so no explicit user-id
 * filters are needed.
 *
 * Enrichment (barber identity via barber_directory, booking/service
 * context via bookings+services) is best-effort, same pattern as
 * bookingsData: a missing lookup renders a calm fallback, never an error.
 */
import { supabase } from '../../lib/supabase';
import type { BarberDirectoryRow, BookingRow, ChatRoomRow, MessageRow, ServiceRow } from '../types';
import { buildInboxThreads } from '../shared/threads';
import { mapPostgrestError } from './errors';
import type { OwnInboxViewResult, RoomForBookingResult } from './types';

// Pure assembly lives in shared/threads.ts (the barber Chats tab reuses
// it); re-exported here so existing imports and tests stay unchanged.
export { buildInboxThreads };

/**
 * Defensive cap on the batched last-message scan. Fine while chats are
 * young (MVP scale); add real pagination when it is not.
 */
const MESSAGES_SCAN_LIMIT = 200;

/** The signed-in customer's chat threads, assembled for the Inbox list. */
export async function fetchOwnInboxView(): Promise<OwnInboxViewResult> {
  const { data, error } = await supabase.from('chat_rooms').select('*');
  if (error) return mapPostgrestError('fetchOwnInboxView', error);
  const rooms = (data as ChatRoomRow[]) ?? [];
  if (rooms.length === 0) return { status: 'ok', threads: [] };

  const roomIds = rooms.map((r) => r.id);
  const bookingIds = [...new Set(rooms.map((r) => r.booking_id))];
  const barberIds = [...new Set(rooms.map((r) => r.barber_id))];

  const [messagesResult, bookingsResult, barbersResult] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .in('chat_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_SCAN_LIMIT),
    supabase.from('bookings').select('*').in('id', bookingIds),
    supabase.from('barber_directory').select('*').in('id', barberIds),
  ]);

  const bookingsById = new Map<string, BookingRow>();
  for (const row of (bookingsResult.data as BookingRow[]) ?? []) bookingsById.set(row.id, row);
  const barbersById = new Map<string, BarberDirectoryRow>();
  for (const row of (barbersResult.data as BarberDirectoryRow[]) ?? []) barbersById.set(row.id, row);

  const servicesById = new Map<string, ServiceRow>();
  const serviceIds = [...new Set([...bookingsById.values()].flatMap((b) => (b.service_id ? [b.service_id] : [])))];
  if (serviceIds.length > 0) {
    const servicesResult = await supabase.from('services').select('*').in('id', serviceIds);
    for (const row of (servicesResult.data as ServiceRow[]) ?? []) servicesById.set(row.id, row);
  }

  const threads = buildInboxThreads(
    rooms,
    (messagesResult.data as MessageRow[]) ?? [],
    bookingsById,
    barbersById,
    servicesById
  );
  return { status: 'ok', threads };
}

/**
 * The chat room attached to one of the customer's bookings, for "Message
 * barber" on the booking detail. trg_create_chat_room_for_booking (migration
 * 0013) creates exactly one room per booking at insert time; RLS returns it
 * only to the booking's participants. `null` means no visible room.
 */
export async function fetchRoomForBooking(bookingId: string): Promise<RoomForBookingResult> {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) return mapPostgrestError('fetchRoomForBooking', error);
  return { status: 'ok', room: (data as ChatRoomRow | null) ?? null };
}
