/**
 * Unit tests for the pure realtime-merge reducer (src/shared/bookingRealtime.ts,
 * build-order step 13-14). No Supabase involvement at all — the reducer is
 * deliberately framework-free, and these tests pin down the contract the
 * screens (and the step 15-16 chat code that copies this shape) depend on:
 *
 * 1. IDEMPOTENCY — re-applying the same event yields an equal list, which is
 *    what makes the realtime echo of an optimistic write a no-op and makes
 *    snapshot/stream overlap harmless (the "open channel before refetch"
 *    ordering relies on this).
 * 2. REFERENTIAL EQUALITY on proven no-ops — the reducer returns the SAME
 *    array reference so React bail-outs hold and lists don't flicker on echoes.
 * 3. POSITION PRESERVATION on replace — ordering is the callers' job, the
 *    reducer must not reorder.
 */
import type { BookingRow } from '../../types';
import {
  applyBookingChange,
  applyBookingChangeSorted,
  type BookingChangeEvent,
} from '../bookingRealtime';

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    customer_id: 'c1',
    barber_id: 'brb1',
    service_id: 's1',
    date: '2026-07-13',
    time: '10:00:00',
    location: 'Home',
    price: 30,
    status: 'pending',
    created_at: '2026-07-09T00:00:00Z',
    ...overrides,
  };
}

const event = (
  eventType: BookingChangeEvent['eventType'],
  row: BookingRow
): BookingChangeEvent => ({ eventType, row });

describe('applyBookingChange', () => {
  describe('INSERT / UPDATE upsert path', () => {
    it('appends an unknown row (INSERT)', () => {
      const a = booking({ id: 'a' });
      const b = booking({ id: 'b' });
      expect(applyBookingChange([a], event('INSERT', b))).toEqual([a, b]);
    });

    it('appends an unknown row on UPDATE too — INSERT and UPDATE are interchangeable, so replayed/out-of-order events converge', () => {
      const a = booking({ id: 'a' });
      const b = booking({ id: 'b' });
      expect(applyBookingChange([a], event('UPDATE', b))).toEqual([a, b]);
      expect(applyBookingChange([a], event('UPDATE', b))).toEqual(
        applyBookingChange([a], event('INSERT', b))
      );
    });

    it('replaces a known row IN PLACE, preserving its position', () => {
      const a = booking({ id: 'a' });
      const b = booking({ id: 'b' });
      const c = booking({ id: 'c' });
      const bAccepted = { ...b, status: 'accepted' as const };

      const next = applyBookingChange([a, b, c], event('UPDATE', bAccepted));

      expect(next).toEqual([a, bAccepted, c]);
    });

    it('does not mutate the input array on replace', () => {
      const a = booking({ id: 'a' });
      const input = [a];
      applyBookingChange(input, event('UPDATE', { ...a, status: 'accepted' }));
      expect(input[0].status).toBe('pending');
    });

    it('returns the SAME array reference when the row is already deeply equal (echo of an optimistic write)', () => {
      const a = booking({ id: 'a' });
      const input = [a, booking({ id: 'b' })];
      // A structurally-equal clone, as a realtime echo would deliver it.
      const echo = { ...a };
      expect(applyBookingChange(input, event('UPDATE', echo))).toBe(input);
      expect(applyBookingChange(input, event('INSERT', echo))).toBe(input);
    });

    it('is idempotent: applying the same event twice equals applying it once', () => {
      const a = booking({ id: 'a' });
      const accepted = { ...a, status: 'accepted' as const };
      const once = applyBookingChange([a], event('UPDATE', accepted));
      const twice = applyBookingChange(once, event('UPDATE', accepted));
      expect(twice).toEqual(once);
      // And the second application is a proven no-op (same reference).
      expect(twice).toBe(once);
    });

    it('detects a change in any single column, not just status', () => {
      const a = booking({ id: 'a' });
      const moved = { ...a, location: 'Somewhere else' };
      const next = applyBookingChange([a], event('UPDATE', moved));
      expect(next).not.toBe([a] as unknown);
      expect(next[0].location).toBe('Somewhere else');
    });
  });

  describe('DELETE path', () => {
    it('removes the matching row', () => {
      const a = booking({ id: 'a' });
      const b = booking({ id: 'b' });
      expect(applyBookingChange([a, b], event('DELETE', a))).toEqual([b]);
    });

    it('relies only on the id — a PK-only DELETE payload (replica identity DEFAULT) still removes the row', () => {
      const a = booking({ id: 'a' });
      // Supabase delivers only the primary key in payload.old under
      // REPLICA IDENTITY DEFAULT; the reducer must not need anything else.
      const pkOnly = { id: 'a' } as BookingRow;
      expect(applyBookingChange([a], event('DELETE', pkOnly))).toEqual([]);
    });

    it('returns the SAME array reference when deleting an absent id', () => {
      const input = [booking({ id: 'a' })];
      expect(applyBookingChange(input, event('DELETE', booking({ id: 'zzz' })))).toBe(input);
    });

    it('does not mutate the input array on delete', () => {
      const a = booking({ id: 'a' });
      const b = booking({ id: 'b' });
      const input = [a, b];
      applyBookingChange(input, event('DELETE', a));
      expect(input).toEqual([a, b]);
    });
  });

  it('works from an empty list (first event before any snapshot row)', () => {
    const a = booking({ id: 'a' });
    expect(applyBookingChange([], event('INSERT', a))).toEqual([a]);
    expect(applyBookingChange([], event('DELETE', a))).toEqual([]);
  });
});

describe('applyBookingChangeSorted (review finding F2)', () => {
  const sortAsc = (rows: BookingRow[]) =>
    [...rows].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  it('skips the sort entirely on a proven no-op, preserving the array reference', () => {
    const a = booking({ id: 'a' });
    const input = [a];
    const sort = jest.fn(sortAsc);

    const next = applyBookingChangeSorted(input, event('UPDATE', { ...a }), sort);

    expect(next).toBe(input);
    expect(sort).not.toHaveBeenCalled();
  });

  it('sorts through the provided comparator on a real change', () => {
    const early = booking({ id: 'early', time: '09:00:00' });
    const late = booking({ id: 'late', time: '12:00:00' });
    // Reducer appends unknown INSERTs at the end; the sort must move it.
    const next = applyBookingChangeSorted([late], event('INSERT', early), sortAsc);

    expect(next.map((b) => b.id)).toEqual(['early', 'late']);
  });

  it('a no-op DELETE (absent id) also preserves the reference without sorting', () => {
    const input = [booking({ id: 'a' })];
    const sort = jest.fn(sortAsc);

    const next = applyBookingChangeSorted(input, event('DELETE', booking({ id: 'zzz' })), sort);

    expect(next).toBe(input);
    expect(sort).not.toHaveBeenCalled();
  });
});
