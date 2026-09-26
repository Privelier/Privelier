import type { MessageRow } from '../types';
import { formatChatDay } from './format';

export type ChatMessageListItem =
  | { kind: 'message'; message: MessageRow; showTimestamp: boolean }
  | { kind: 'day'; key: string; label: string };

function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Returns the chronological history in the order expected by an inverted list. */
export function buildInvertedChatItems(messages: MessageRow[]): ChatMessageListItem[] {
  const items: ChatMessageListItem[] = [];
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    const newer = messages[index + 1];
    const older = messages[index - 1];
    items.push({
      kind: 'message',
      message,
      showTimestamp: !newer || newer.sender_id !== message.sender_id || localDay(newer.created_at) !== localDay(message.created_at),
    });
    if (!older || localDay(older.created_at) !== localDay(message.created_at)) {
      items.push({ kind: 'day', key: `day-${localDay(message.created_at)}`, label: formatChatDay(message.created_at) });
    }
  }
  return items;
}
