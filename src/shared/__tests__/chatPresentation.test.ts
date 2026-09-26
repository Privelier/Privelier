import type { MessageRow } from '../../types';
import { buildInvertedChatItems } from '../chatPresentation';

const message = (id: string, sender_id: string, created_at: string): MessageRow => ({
  id, chat_id: 'chat-1', sender_id, created_at, message: id,
});

describe('buildInvertedChatItems', () => {
  it('separates local days and shows one clock at the end of a consecutive sender group', () => {
    const result = buildInvertedChatItems([
      message('1', 'customer', '2026-09-25T10:00:00.000Z'),
      message('2', 'customer', '2026-09-25T10:02:00.000Z'),
      message('3', 'barber', '2026-09-26T10:03:00.000Z'),
    ]);
    expect(result.map((item) => item.kind)).toEqual(['message', 'day', 'message', 'message', 'day']);
    expect(result.filter((item) => item.kind === 'message').map((item) => item.kind === 'message' && item.showTimestamp)).toEqual([true, true, false]);
    expect(result.find((item) => item.kind === 'day' && item.label === 'Today')).toBeDefined();
  });
});
