/**
 * Unit tests for the pure unread-state core (src/shared/unread.ts) — the
 * logic behind the tab badge and bold thread rows (design:
 * docs/design/step-15-16-unread-indicator-design.md).
 */
import {
  computeUnreadRoomIds,
  latestMessageByRoom,
  resolveReadMarker,
  type UnreadMessageInput,
} from '../unread';

const ME = 'me';
const THEM = 'them';

function msg(chatId: string, senderId: string, createdAt: string): UnreadMessageInput {
  return { chat_id: chatId, sender_id: senderId, created_at: createdAt };
}

describe('computeUnreadRoomIds', () => {
  it('a room whose latest message is from the counterpart and never read is unread', () => {
    const unread = computeUnreadRoomIds({
      roomIds: ['r1'],
      messages: [msg('r1', THEM, '2026-07-10T10:00:00+00:00')],
      readStates: [],
      myId: ME,
    });
    expect(unread).toEqual(new Set(['r1']));
  });

  it('own latest message never makes a room unread — even with no read state', () => {
    const unread = computeUnreadRoomIds({
      roomIds: ['r1'],
      messages: [
        msg('r1', THEM, '2026-07-10T09:00:00+00:00'),
        msg('r1', ME, '2026-07-10T10:00:00+00:00'), // I replied last
      ],
      readStates: [],
      myId: ME,
    });
    expect(unread.size).toBe(0);
  });

  it('read state at/after the latest message means read; before it means unread', () => {
    const messages = [msg('r1', THEM, '2026-07-10T10:00:00+00:00')];
    const readAtSame = computeUnreadRoomIds({
      roomIds: ['r1'],
      messages,
      readStates: [{ chat_id: 'r1', last_read_at: '2026-07-10T10:00:00+00:00' }],
      myId: ME,
    });
    expect(readAtSame.size).toBe(0); // strictly-greater comparison

    const readBefore = computeUnreadRoomIds({
      roomIds: ['r1'],
      messages,
      readStates: [{ chat_id: 'r1', last_read_at: '2026-07-10T09:59:59+00:00' }],
      myId: ME,
    });
    expect(readBefore).toEqual(new Set(['r1']));
  });

  it('an empty room is never unread, and rooms are independent', () => {
    const unread = computeUnreadRoomIds({
      roomIds: ['empty', 'unreadRoom', 'readRoom'],
      messages: [
        msg('unreadRoom', THEM, '2026-07-10T10:00:00+00:00'),
        msg('readRoom', THEM, '2026-07-10T08:00:00+00:00'),
      ],
      readStates: [{ chat_id: 'readRoom', last_read_at: '2026-07-10T09:00:00+00:00' }],
      myId: ME,
    });
    expect(unread).toEqual(new Set(['unreadRoom']));
  });

  it('only the LATEST message decides: an old counterpart message under my newer reply is read', () => {
    const unread = computeUnreadRoomIds({
      roomIds: ['r1'],
      messages: [
        msg('r1', ME, '2026-07-10T11:00:00+00:00'),
        msg('r1', THEM, '2026-07-10T10:00:00+00:00'),
      ],
      readStates: [],
      myId: ME,
    });
    expect(unread.size).toBe(0);
  });
});

describe('latestMessageByRoom', () => {
  it('keeps the newest message per room regardless of input order', () => {
    const latest = latestMessageByRoom([
      msg('r1', THEM, '2026-07-10T09:00:00+00:00'),
      msg('r2', ME, '2026-07-10T08:00:00+00:00'),
      msg('r1', ME, '2026-07-10T10:00:00+00:00'),
    ]);
    expect(latest.get('r1')?.created_at).toBe('2026-07-10T10:00:00+00:00');
    expect(latest.get('r2')?.sender_id).toBe(ME);
  });
});

describe('resolveReadMarker (clock-skew guard)', () => {
  it('uses device time when it is at/after the newest message', () => {
    expect(resolveReadMarker('2026-07-10T10:05:00+00:00', '2026-07-10T10:00:00+00:00')).toBe(
      '2026-07-10T10:05:00+00:00'
    );
  });

  it('uses the newest message time when the device clock is BEHIND the server — the marker may never undercut what was just read', () => {
    expect(resolveReadMarker('2026-07-10T09:00:00+00:00', '2026-07-10T10:00:00+00:00')).toBe(
      '2026-07-10T10:00:00+00:00'
    );
  });

  it('falls back to device time for an empty room', () => {
    expect(resolveReadMarker('2026-07-10T10:00:00+00:00', null)).toBe('2026-07-10T10:00:00+00:00');
  });
});
