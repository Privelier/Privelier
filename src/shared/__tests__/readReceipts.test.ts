/**
 * Tests for the pure read-receipt logic (src/shared/readReceipts.ts).
 * Decision D3 is the load-bearing part: comparison is NUMERIC (epoch ms),
 * because the two sides cross the PostgREST/Realtime serialization boundary
 * — the cross-format cases below are the reason string compare was rejected.
 */
import {
  deriveIsRead,
  deriveReadMarkerId,
  findNewestOwnMessage,
  mergeLastReadAt,
  parseTimestampMs,
} from '../readReceipts';
import type { MessageRow } from '../../types';

function m(id: string, senderId: string, createdAt: string): MessageRow {
  return { id, chat_id: 'r1', sender_id: senderId, message: 'x', created_at: createdAt };
}

describe('parseTimestampMs', () => {
  it('parses ISO timestamps to epoch ms', () => {
    expect(parseTimestampMs('2026-07-14T10:00:00.000Z')).toBe(
      Date.parse('2026-07-14T10:00:00.000Z')
    );
  });

  it('returns null for null, undefined, empty, and garbage', () => {
    expect(parseTimestampMs(null)).toBeNull();
    expect(parseTimestampMs(undefined)).toBeNull();
    expect(parseTimestampMs('')).toBeNull();
    expect(parseTimestampMs('not-a-timestamp')).toBeNull();
  });
});

describe('deriveIsRead (D3: numeric, cross-format safe)', () => {
  it('true when the marker is at or after the message', () => {
    expect(deriveIsRead('2026-07-14T10:00:01Z', '2026-07-14T10:00:00Z')).toBe(true);
    expect(deriveIsRead('2026-07-14T10:00:00Z', '2026-07-14T10:00:00Z')).toBe(true);
  });

  it('false when the marker is before the message', () => {
    expect(deriveIsRead('2026-07-14T09:59:59Z', '2026-07-14T10:00:00Z')).toBe(false);
  });

  it('compares the same instant across serialization variants as equal', () => {
    // Z-suffix (Realtime style) vs +00:00 offset (PostgREST style) — the
    // exact boundary a string compare would get wrong ('+' < 'Z' in ASCII).
    expect(deriveIsRead('2026-07-14T10:00:00+00:00', '2026-07-14T10:00:00Z')).toBe(true);
    expect(deriveIsRead('2026-07-14T10:00:00Z', '2026-07-14T10:00:00.000+00:00')).toBe(true);
  });

  it('degrades to "not read" on absent or malformed input (honest default)', () => {
    expect(deriveIsRead(null, '2026-07-14T10:00:00Z')).toBe(false);
    expect(deriveIsRead('garbage', '2026-07-14T10:00:00Z')).toBe(false);
    expect(deriveIsRead('2026-07-14T10:00:00Z', 'garbage')).toBe(false);
  });
});

describe('mergeLastReadAt (C3: monotonic, same-reference no-op)', () => {
  it('adopts an incoming value when nothing is established', () => {
    expect(mergeLastReadAt(null, '2026-07-14T10:00:00Z')).toBe('2026-07-14T10:00:00Z');
  });

  it('moves forward on a newer incoming value', () => {
    expect(mergeLastReadAt('2026-07-14T10:00:00Z', '2026-07-14T10:00:01Z')).toBe(
      '2026-07-14T10:00:01Z'
    );
  });

  it('returns the SAME current value on older, equal, or malformed incoming', () => {
    const current = '2026-07-14T10:00:00Z';
    expect(mergeLastReadAt(current, '2026-07-14T09:00:00Z')).toBe(current); // older
    expect(mergeLastReadAt(current, current)).toBe(current); // equal
    expect(mergeLastReadAt(current, 'garbage')).toBe(current); // malformed
    expect(mergeLastReadAt(current, null)).toBe(current); // absent
    expect(mergeLastReadAt(current, undefined)).toBe(current); // absent
  });

  it('treats the same instant in a different serialization as a no-op (keeps current)', () => {
    const current = '2026-07-14T10:00:00Z';
    expect(mergeLastReadAt(current, '2026-07-14T10:00:00+00:00')).toBe(current);
  });

  it('is idempotent: re-applying the same event changes nothing', () => {
    const once = mergeLastReadAt(null, '2026-07-14T10:00:00Z');
    expect(mergeLastReadAt(once, '2026-07-14T10:00:00Z')).toBe(once);
  });
});

describe('findNewestOwnMessage (D5: the single marker anchor)', () => {
  it('returns the last own message of an ascending-sorted list', () => {
    const rows = [m('m1', 'me', 't1'), m('m2', 'them', 't2'), m('m3', 'me', 't3')];
    expect(findNewestOwnMessage(rows, 'me')?.id).toBe('m3');
  });

  it('returns null when the caller sent nothing, the list is empty, or myId is unknown', () => {
    expect(findNewestOwnMessage([m('m1', 'them', 't1')], 'me')).toBeNull();
    expect(findNewestOwnMessage([], 'me')).toBeNull();
    expect(findNewestOwnMessage([m('m1', 'me', 't1')], null)).toBeNull();
  });
});

describe('deriveReadMarkerId (the one derivation both screens share — L2)', () => {
  const rows = [
    m('m1', 'me', '2026-07-14T10:00:00Z'),
    m('m2', 'them', '2026-07-14T10:01:00Z'),
    m('m3', 'me', '2026-07-14T10:02:00Z'),
  ];

  it('anchors to the newest own message once the marker covers it', () => {
    expect(deriveReadMarkerId(rows, 'me', '2026-07-14T10:02:00Z')).toBe('m3');
    expect(deriveReadMarkerId(rows, 'me', '2026-07-14T11:00:00Z')).toBe('m3');
  });

  it('returns null when the marker covers only OLDER own messages (no partial ticks)', () => {
    expect(deriveReadMarkerId(rows, 'me', '2026-07-14T10:01:30Z')).toBeNull();
  });

  it('returns null with no marker, no own messages, or no identity', () => {
    expect(deriveReadMarkerId(rows, 'me', null)).toBeNull();
    expect(deriveReadMarkerId([m('m1', 'them', '2026-07-14T10:00:00Z')], 'me', '2026-07-14T11:00:00Z')).toBeNull();
    expect(deriveReadMarkerId(rows, null, '2026-07-14T11:00:00Z')).toBeNull();
  });
});
