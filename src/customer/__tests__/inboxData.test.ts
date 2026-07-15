/**
 * Tests for the pure thread-assembly rule of the inbox data layer. The
 * Supabase client is mocked out (same approach as bookingsData.test.ts) —
 * fetchOwnInboxView is a thin RLS-scoped read exercised on-device.
 */
import type {
  BarberDirectoryRow,
  BookingRow,
  ChatRoomRow,
  MessageRow,
} from '../../types';
import { buildInboxThreads } from '../inboxData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const room = (id: string, bookingId: string, barberId = 'brb1'): ChatRoomRow => ({
  id,
  booking_id: bookingId,
  customer_id: 'c1',
  barber_id: barberId,
});

const message = (chatId: string, createdAt: string, text = 'hi'): MessageRow => ({
  id: `m-${chatId}-${createdAt}`,
  chat_id: chatId,
  sender_id: 'c1',
  message: text,
  created_at: createdAt,
});

const booking = (id: string, date: string): BookingRow => ({
  id,
  customer_id: 'c1',
  barber_id: 'brb1',
  service_id: 'svc1',
  date,
  time: '10:00:00',
  location: 'Home',
  price: 40,
  status: 'accepted',
  created_at: '2026-07-01T00:00:00Z',
});

const barber: BarberDirectoryRow = {
  id: 'brb1',
  name: 'Atlas',
  city: 'Eckental',
  country: 'Germany',
  profile_image: null,
  bio: null,
  rating: 0,
  verified: true,
  display_latitude: null,
  display_longitude: null,
};

describe('buildInboxThreads', () => {
  it('picks the newest message per room regardless of input order', () => {
    const rooms = [room('r1', 'bk1')];
    const messages = [
      message('r1', '2026-07-08T10:00:00Z', 'newest'),
      message('r1', '2026-07-07T10:00:00Z', 'older'),
      message('r1', '2026-07-08T09:00:00Z', 'middle'),
    ];
    const threads = buildInboxThreads(rooms, messages, new Map(), new Map(), new Map());
    expect(threads[0].lastMessage?.message).toBe('newest');
    expect(threads[0].lastActivityIso).toBe('2026-07-08T10:00:00Z');
  });

  it('sorts rooms by last activity, most recent first, using booking date when messageless', () => {
    const rooms = [room('quiet', 'bk-old'), room('active', 'bk-new'), room('recent-booking', 'bk-recent')];
    const bookingsById = new Map([
      ['bk-old', booking('bk-old', '2026-06-01')],
      ['bk-new', booking('bk-new', '2026-06-15')],
      ['bk-recent', booking('bk-recent', '2026-07-07')],
    ]);
    const messages = [message('active', '2026-07-08T10:00:00Z')];
    const threads = buildInboxThreads(rooms, messages, bookingsById, new Map(), new Map());
    expect(threads.map((t) => t.room.id)).toEqual(['active', 'recent-booking', 'quiet']);
  });

  it('degrades to nulls when enrichment lookups are missing', () => {
    const threads = buildInboxThreads([room('r1', 'bk1')], [], new Map(), new Map(), new Map());
    expect(threads[0]).toMatchObject({
      barber: null,
      booking: null,
      service: null,
      lastMessage: null,
      lastActivityIso: null,
    });
  });

  it('attaches barber and service context when present', () => {
    const bookingsById = new Map([['bk1', booking('bk1', '2026-07-07')]]);
    const barbersById = new Map([['brb1', barber]]);
    const servicesById = new Map([
      ['svc1', { id: 'svc1', barber_id: 'brb1', name: 'Signature cut', price: 40, duration_minutes: 45 }],
    ]);
    const threads = buildInboxThreads([room('r1', 'bk1')], [], bookingsById, barbersById, servicesById);
    expect(threads[0].barber?.name).toBe('Atlas');
    expect(threads[0].service?.name).toBe('Signature cut');
    expect(threads[0].lastActivityIso).toBe('2026-07-07');
  });
});
