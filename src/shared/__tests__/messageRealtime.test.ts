/**
 * Unit tests for the pure message-merge reducer
 * (src/shared/messageRealtime.ts, build-order step 15-16) — the chat copy of
 * bookingRealtime, pinning the same contract: idempotency, referential
 * equality on proven no-ops, position preservation, and the F2
 * reference-preserving sorted merge.
 */
import type { MessageRow } from '../../types';
import {
  applyMessageChange,
  applyMessageChangeSorted,
  type MessageChangeEvent,
} from '../messageRealtime';

function msg(overrides: Partial<MessageRow>): MessageRow {
  return {
    id: 'm1',
    chat_id: 'room1',
    sender_id: 'u1',
    message: 'Hello',
    created_at: '2026-07-09T10:00:00.000Z',
    ...overrides,
  };
}

const event = (
  eventType: MessageChangeEvent['eventType'],
  row: MessageRow
): MessageChangeEvent => ({ eventType, row });

const sortAsc = (rows: MessageRow[]) =>
  [...rows].sort((a, b) => {
    const c = a.created_at.localeCompare(b.created_at);
    return c !== 0 ? c : a.id.localeCompare(b.id);
  });

describe('applyMessageChange', () => {
  it('appends an unknown row (INSERT), including from an empty list', () => {
    const a = msg({ id: 'a' });
    const b = msg({ id: 'b' });
    expect(applyMessageChange([], event('INSERT', a))).toEqual([a]);
    expect(applyMessageChange([a], event('INSERT', b))).toEqual([a, b]);
  });

  it('INSERT and UPDATE are interchangeable — replayed/out-of-order events converge', () => {
    const a = msg({ id: 'a' });
    const b = msg({ id: 'b' });
    expect(applyMessageChange([a], event('UPDATE', b))).toEqual(
      applyMessageChange([a], event('INSERT', b))
    );
  });

  it('returns the SAME array reference on a deeply-equal echo (the sent-message echo case)', () => {
    const a = msg({ id: 'a' });
    const input = [a, msg({ id: 'b' })];
    expect(applyMessageChange(input, event('INSERT', { ...a }))).toBe(input);
  });

  it('is idempotent: applying the same event twice equals applying it once, and the second is a no-op reference', () => {
    const a = msg({ id: 'a' });
    const once = applyMessageChange([], event('INSERT', a));
    const twice = applyMessageChange(once, event('INSERT', { ...a }));
    expect(twice).toEqual(once);
    expect(twice).toBe(once);
  });

  it('replaces a known row IN PLACE without mutating the input', () => {
    const a = msg({ id: 'a' });
    const b = msg({ id: 'b' });
    const input = [a, b];
    const edited = { ...a, message: 'Edited' };

    const next = applyMessageChange(input, event('UPDATE', edited));

    expect(next).toEqual([edited, b]);
    expect(input[0].message).toBe('Hello');
  });

  it('DELETE removes by id only (PK-only payload under replica identity DEFAULT) and no-ops with the same reference when absent', () => {
    const a = msg({ id: 'a' });
    const input = [a];
    expect(applyMessageChange(input, event('DELETE', { id: 'a' } as MessageRow))).toEqual([]);
    expect(applyMessageChange(input, event('DELETE', msg({ id: 'zzz' })))).toBe(input);
  });
});

describe('applyMessageChangeSorted (F2 reference bailout)', () => {
  it('skips the sort entirely on a proven no-op, preserving the array reference', () => {
    const a = msg({ id: 'a' });
    const input = [a];
    const sort = jest.fn(sortAsc);

    expect(applyMessageChangeSorted(input, event('INSERT', { ...a }), sort)).toBe(input);
    expect(sort).not.toHaveBeenCalled();
  });

  it('sorts through the provided comparator on a real change', () => {
    const early = msg({ id: 'early', created_at: '2026-07-09T09:00:00.000Z' });
    const late = msg({ id: 'late', created_at: '2026-07-09T11:00:00.000Z' });

    const next = applyMessageChangeSorted([late], event('INSERT', early), sortAsc);

    expect(next.map((m) => m.id)).toEqual(['early', 'late']);
  });

  it('id tiebreak keeps equal timestamps stable', () => {
    const t = '2026-07-09T10:00:00.000Z';
    const b = msg({ id: 'b', created_at: t });
    const a = msg({ id: 'a', created_at: t });

    const next = applyMessageChangeSorted([b], event('INSERT', a), sortAsc);

    expect(next.map((m) => m.id)).toEqual(['a', 'b']);
  });
});
