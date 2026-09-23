import type { MessageRow } from '../types';

export const MESSAGE_HISTORY_PAGE_SIZE = 40;

export interface ConversationCursor {
  createdAt: string;
  id: string;
}

export interface ConversationHistoryPage {
  messages: MessageRow[];
  hasEarlier: boolean;
  earliestCursor: ConversationCursor | null;
  /** REST-derived high-water for reconnect recovery, never inferred from UI state. */
  latestCursor: ConversationCursor | null;
}

export interface ConversationRecoveryPage {
  messages: MessageRow[];
  hasNewer: boolean;
  latestCursor: ConversationCursor | null;
}

const SAFE_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Cursors are database-derived; validate before interpolating into PostgREST's filter grammar. */
export function isConversationCursor(value: unknown): value is ConversationCursor {
  if (!value || typeof value !== 'object') return false;

  const { createdAt, id } = value as Partial<ConversationCursor>;
  return (
    typeof createdAt === 'string' &&
    SAFE_TIMESTAMP.test(createdAt) &&
    Number.isFinite(Date.parse(createdAt)) &&
    typeof id === 'string' &&
    SAFE_ID.test(id)
  );
}

export function conversationKeysetFilter(cursor: ConversationCursor): string {
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

export function conversationNewerKeysetFilter(cursor: ConversationCursor): string {
  return `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`;
}

/** Converts the database's newest-first page into the existing ascending UI state contract. */
export function buildConversationHistoryPage(rows: MessageRow[]): ConversationHistoryPage | null {
  const pageRows = rows.slice(0, MESSAGE_HISTORY_PAGE_SIZE);
  const oldest = pageRows.at(-1);
  const newest = pageRows[0];
  const earliestCursor = oldest
    ? { createdAt: oldest.created_at, id: oldest.id }
    : null;
  const latestCursor = newest
    ? { createdAt: newest.created_at, id: newest.id }
    : null;

  if (
    (earliestCursor && !isConversationCursor(earliestCursor)) ||
    (latestCursor && !isConversationCursor(latestCursor))
  ) {
    return null;
  }

  return {
    messages: [...pageRows].reverse(),
    hasEarlier: rows.length > MESSAGE_HISTORY_PAGE_SIZE,
    earliestCursor,
    latestCursor,
  };
}

/** Converts an ascending newer-than page into an exhaustion-loop cursor contract. */
export function buildConversationRecoveryPage(rows: MessageRow[]): ConversationRecoveryPage | null {
  const pageRows = rows.slice(0, MESSAGE_HISTORY_PAGE_SIZE);
  const newest = pageRows.at(-1);
  const latestCursor = newest
    ? { createdAt: newest.created_at, id: newest.id }
    : null;

  if (latestCursor && !isConversationCursor(latestCursor)) return null;

  return {
    messages: pageRows,
    hasNewer: rows.length > MESSAGE_HISTORY_PAGE_SIZE,
    latestCursor,
  };
}
