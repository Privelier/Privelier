/**
 * Chat-thread view assembly shared by the customer Inbox tab and the barber
 * Chats tab. Pure — no I/O; each side's data layer feeds it RLS-scoped rows.
 *
 * `barber` is the counterpart lookup for the CUSTOMER side (via
 * barber_directory). The barber side has no counterpart read path yet
 * (users RLS is own-row-only — gap tracked for step 13-14 in CLAUDE.md), so
 * it passes an empty map and its threads carry `barber: null` by design.
 */
import type {
  BarberDirectoryRow,
  BookingRow,
  ChatRoomRow,
  MessageRow,
  ServiceRow,
} from '../types';

/**
 * One thread row: a chat room plus best-effort context. Every lookup field
 * can legitimately be null; `lastActivityIso` drives sorting and the row's
 * timestamp — latest message when one exists, else the linked booking's
 * date.
 */
export interface InboxThread {
  room: ChatRoomRow;
  barber: BarberDirectoryRow | null;
  booking: BookingRow | null;
  service: ServiceRow | null;
  lastMessage: MessageRow | null;
  lastActivityIso: string | null;
}

/**
 * Newest message per room wins as the preview; rooms sort by last activity
 * (latest message, else the linked booking's slot date), most recent first.
 * `messages` may arrive in any order.
 */
export function buildInboxThreads(
  rooms: ChatRoomRow[],
  messages: MessageRow[],
  bookingsById: Map<string, BookingRow>,
  barbersById: Map<string, BarberDirectoryRow>,
  servicesById: Map<string, ServiceRow>
): InboxThread[] {
  const lastMessageByRoom = new Map<string, MessageRow>();
  for (const m of messages) {
    const current = lastMessageByRoom.get(m.chat_id);
    if (!current || m.created_at > current.created_at) lastMessageByRoom.set(m.chat_id, m);
  }

  const threads = rooms.map((room): InboxThread => {
    const booking = bookingsById.get(room.booking_id) ?? null;
    const lastMessage = lastMessageByRoom.get(room.id) ?? null;
    return {
      room,
      barber: barbersById.get(room.barber_id) ?? null,
      booking,
      service: booking ? (servicesById.get(booking.service_id) ?? null) : null,
      lastMessage,
      lastActivityIso: lastMessage?.created_at ?? booking?.date ?? null,
    };
  });

  return threads.sort((a, b) =>
    (b.lastActivityIso ?? '').localeCompare(a.lastActivityIso ?? '')
  );
}
