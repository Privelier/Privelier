/**
 * Unit tests for the pure slot-derivation algorithm
 * (src/shared/slots.ts::deriveAvailableSlots). No mocking needed — this
 * function takes fixed inputs (including an injectable `now`) and returns a
 * plain string array, so every scenario is driven directly through fixture
 * data. Algorithm is locked by design review (see the module's own header
 * comment) — these tests verify the existing behavior, they do not propose
 * changes to it.
 */
import { deriveAvailableSlots, type BusySlot } from '../slots';
import type { AvailabilityRow } from '../../types';

/** Minimal AvailabilityRow builder — only the fields deriveAvailableSlots reads. */
function window(overrides: Partial<AvailabilityRow>): AvailabilityRow {
  return {
    id: 'w-1',
    barber_id: 'b-1',
    day_of_week: null,
    specific_date: null,
    start_time: '09:00:00',
    end_time: '17:00:00',
    ...overrides,
  };
}

describe('deriveAvailableSlots', () => {
  // Pin the clock (tracked hygiene item, fixed 2026-07-15): most tests here
  // omit `now`, so the function falls back to the real clock — and the
  // today-only past-time filter engages whenever the real run date equals a
  // fixture date (this whole suite failed on exactly 2026-07-13 for that
  // reason). 2026-07-12 is a Sunday no fixture uses, so the filter can only
  // engage where a test injects `now` deliberately.
  beforeAll(() => {
    jest.useFakeTimers({ now: new Date(2026, 6, 12, 12, 0) });
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  describe('recurring day_of_week windows', () => {
    it('generates back-to-back slots for a matching weekday window', () => {
      // 2026-07-13 is a Monday (day_of_week 1).
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' })];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual(['09:00:00', '09:30:00']);
    });

    it('produces no slots when the date is a different weekday than any window', () => {
      // 2026-07-14 is a Tuesday; only Monday (1) windows exist.
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' })];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-14',
        durationMinutes: 30,
      });

      expect(result).toEqual([]);
    });
  });

  describe('specific_date full override', () => {
    it('uses only the specific_date window for that exact date, ignoring same-weekday day_of_week windows (not merged)', () => {
      // 2026-07-13 is a Monday. A day_of_week=1 window exists, plus a
      // specific_date window for that same calendar date with different
      // hours — the specific_date row must fully replace, not merge with,
      // the recurring one.
      const windows = [
        window({ id: 'recurring', day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' }),
        window({
          id: 'override',
          day_of_week: null,
          specific_date: '2026-07-13',
          start_time: '14:00:00',
          end_time: '15:00:00',
        }),
      ];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual(['14:00:00', '14:30:00']);
    });

    it('does not apply a specific_date window to a different date, even with a matching weekday', () => {
      // 2026-07-20 is also a Monday; the specific_date override is only for
      // 2026-07-13, so 2026-07-20 must fall back to the day_of_week window.
      const windows = [
        window({ id: 'recurring', day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' }),
        window({
          id: 'override',
          day_of_week: null,
          specific_date: '2026-07-13',
          start_time: '14:00:00',
          end_time: '15:00:00',
        }),
      ];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-20',
        durationMinutes: 30,
      });

      expect(result).toEqual(['09:00:00', '09:30:00']);
    });

    it('falling back to an empty slot list when a specific_date row exists for the date but has no candidate room', () => {
      const windows = [
        window({
          day_of_week: null,
          specific_date: '2026-07-13',
          start_time: '09:00:00',
          end_time: '09:15:00',
        }),
      ];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual([]);
    });
  });

  describe('multiple windows per day (split shifts)', () => {
    it('generates candidates independently for each window and merges the results', () => {
      const windows = [
        window({ id: 'morning', day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' }),
        window({ id: 'afternoon', day_of_week: 1, start_time: '14:00:00', end_time: '15:00:00' }),
      ];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual(['09:00:00', '09:30:00', '14:00:00', '14:30:00']);
    });

    it('sorts the merged result chronologically regardless of window input order', () => {
      const windows = [
        window({ id: 'afternoon', day_of_week: 1, start_time: '14:00:00', end_time: '14:30:00' }),
        window({ id: 'morning', day_of_week: 1, start_time: '09:00:00', end_time: '09:30:00' }),
      ];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual(['09:00:00', '14:00:00']);
    });
  });

  describe('candidate generation: back-to-back increments, no partial slots', () => {
    it('steps by durationMinutes and drops a final partial slot that would overrun the window end', () => {
      // 80-minute window, 25-minute duration: 09:00, 09:25, 09:50 fit
      // (09:50 + 25 = 10:15, within the 10:20 window end); the next
      // candidate at 10:15 would end at 10:40, past the window end, so it
      // is dropped rather than truncated — leaving a 5-minute remainder
      // unused.
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '10:20:00' })];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 25,
      });

      expect(result).toEqual(['09:00:00', '09:25:00', '09:50:00']);
    });

    it('produces exactly one slot when the window is exactly one duration long', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '09:30:00' })];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual(['09:00:00']);
    });

    it('produces no slots when the window is shorter than one duration', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '09:20:00' })];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual([]);
    });
  });

  describe('conflict subtraction (half-open interval overlap)', () => {
    it('removes a candidate slot that exactly matches a busy entry of the same duration', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' })];
      const busy: BusySlot[] = [{ startTime: '09:30:00', durationMinutes: 30 }];

      const result = deriveAvailableSlots({
        windows,
        busy,
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual(['09:00:00']);
    });

    it('removes any candidate that partially overlaps a longer busy entry', () => {
      // A 90-minute busy block from 09:00-10:30 should remove every
      // 30-minute candidate that overlaps it at all: 09:00, 09:30, 10:00.
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '11:00:00' })];
      const busy: BusySlot[] = [{ startTime: '09:00:00', durationMinutes: 90 }];

      const result = deriveAvailableSlots({
        windows,
        busy,
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual(['10:30:00']);
    });

    it('does not remove a candidate that is exactly back-to-back with a busy entry (half-open, touching is not overlapping)', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' })];
      // Busy block ends exactly when the 09:30 candidate would start.
      const busy: BusySlot[] = [{ startTime: '09:00:00', durationMinutes: 30 }];

      const result = deriveAvailableSlots({
        windows,
        busy,
        date: '2026-07-13',
        durationMinutes: 30,
      });

      expect(result).toEqual(['09:30:00']);
    });

    it('subtracts multiple busy entries of varying durationMinutes independently', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '13:00:00' })];
      const busy: BusySlot[] = [
        { startTime: '09:00:00', durationMinutes: 30 },
        { startTime: '10:00:00', durationMinutes: 60 },
        { startTime: '12:00:00', durationMinutes: 15 },
      ];

      const result = deriveAvailableSlots({
        windows,
        busy,
        date: '2026-07-13',
        durationMinutes: 30,
      });

      // Candidates: 09:00 09:30 10:00 10:30 11:00 11:30 12:00 12:30
      // Removed: 09:00 (busy 09:00-09:30), 10:00 & 10:30 (busy 10:00-11:00),
      // 12:00 (busy 12:00-12:15 overlaps the 12:00-12:30 candidate).
      expect(result).toEqual(['09:30:00', '11:00:00', '11:30:00', '12:30:00']);
    });

    it('is unaffected by a busy entry on a day that produced no candidates in the first place', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' })];
      const busy: BusySlot[] = [{ startTime: '09:00:00', durationMinutes: 30 }];

      // Tuesday has no matching window at all.
      const result = deriveAvailableSlots({
        windows,
        busy,
        date: '2026-07-14',
        durationMinutes: 30,
      });

      expect(result).toEqual([]);
    });
  });

  describe('past-time exclusion (today only)', () => {
    it('filters out slots that start at or before the current local time on the matching "today" date', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '11:00:00' })];
      // 2026-07-13 09:45 local.
      const now = new Date(2026, 6, 13, 9, 45);

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
        now,
      });

      expect(result).toEqual(['10:00:00', '10:30:00']);
    });

    it('excludes a slot that starts exactly at the current time (boundary is exclusive)', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '11:00:00' })];
      const now = new Date(2026, 6, 13, 9, 30);

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
        now,
      });

      expect(result).toEqual(['10:00:00', '10:30:00']);
    });

    it('does not filter any slot on a future date, even if it would be "in the past" relative to now\'s time-of-day', () => {
      const windows = [window({ day_of_week: 2, start_time: '09:00:00', end_time: '10:00:00' })];
      // now is 2026-07-13 (Monday) at 23:00; the queried date is the next
      // day, so no past-time filtering should apply regardless of now's
      // clock time.
      const now = new Date(2026, 6, 13, 23, 0);

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-14',
        durationMinutes: 30,
        now,
      });

      expect(result).toEqual(['09:00:00', '09:30:00']);
    });

    it('does not filter any slot on a past date (not "today"), even though every slot is chronologically in the past', () => {
      const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00' })];
      const now = new Date(2026, 6, 20, 12, 0); // a week after the queried date

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: '2026-07-13',
        durationMinutes: 30,
        now,
      });

      expect(result).toEqual(['09:00:00', '09:30:00']);
    });

    it('defaults now to the real current time when not provided', () => {
      // Use a window that spans "all day" so the exact wall-clock instant
      // of the test run does not create flakiness in which slots remain.
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const today = `${y}-${m}-${d}`;

      const windows = [
        window({ day_of_week: now.getDay(), start_time: '00:00:00', end_time: '23:59:00' }),
      ];

      const result = deriveAvailableSlots({
        windows,
        busy: [],
        date: today,
        durationMinutes: 30,
      });

      // Every returned slot must be strictly after the current time.
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      for (const slot of result) {
        const [h, min] = slot.split(':').map(Number);
        expect(h * 60 + min).toBeGreaterThan(nowMinutes);
      }
    });
  });

  describe('local-date weekday parsing (not UTC)', () => {
    // Demonstrated by direct experiment before writing this test: on this
    // host (Node/V8 with ICU timezone data cached at process start),
    // reassigning process.env.TZ mid-test has NO effect on subsequent
    // Date/Intl behavior — Date and Intl.DateTimeFormat keep resolving to
    // the process's original startup timezone regardless. That rules out
    // a genuine "run under a different host timezone" black-box test here.
    // Under this host's own timezone (positive UTC offset), the UTC-string-
    // parsing bug this rule guards against cannot even manifest (midnight
    // UTC never rolls back to the previous local calendar day for a
    // positive offset) — so a same-host comparison would pass whether or
    // not the implementation used the buggy `new Date(dateString)` form.
    //
    // Instead, this spies on the global `Date` constructor to directly
    // observe HOW deriveAvailableSlots resolves the weekday: it must never
    // construct a Date from a single date string (`new Date('YYYY-MM-DD')`,
    // which V8 always parses as UTC midnight per the ECMA-262 Date Time
    // String Format — the exact form that is wrong on any negative-UTC-
    // offset host), and must construct one from the three separate
    // (year, monthIndex, day) numeric components instead (interpreted in
    // local time on every host, by spec).
    it('parses the weekday from (year, monthIndex, day) components, never from a raw date string', () => {
      const RealDate = globalThis.Date;
      const ctorCalls: unknown[][] = [];

      class SpyDate extends RealDate {
        constructor(...args: unknown[]) {
          // @ts-expect-error -- forwarding a variadic args array to the
          // Date constructor is not directly expressible in TS's overload
          // set, but is safe here: RealDate accepts the same argument
          // shapes deriveAvailableSlots ever passes (no-arg or 3 numbers).
          super(...args);
          ctorCalls.push(args);
        }
      }
      globalThis.Date = SpyDate as DateConstructor;

      let result: string[];
      try {
        const windows = [window({ day_of_week: 1, start_time: '09:00:00', end_time: '09:30:00' })];
        result = deriveAvailableSlots({
          windows,
          busy: [],
          date: '2026-07-13', // a Monday
          durationMinutes: 30,
        });
      } finally {
        globalThis.Date = RealDate;
      }

      // The correct behavior: the day_of_week=1 (Monday) window matches.
      expect(result).toEqual(['09:00:00']);

      // No Date was ever constructed from a single date string (the
      // UTC-parsing form this rule forbids).
      const stringArgCalls = ctorCalls.filter(
        (args) => args.length === 1 && typeof args[0] === 'string'
      );
      expect(stringArgCalls).toEqual([]);

      // The weekday-resolution Date was constructed from local numeric
      // components: 2026, monthIndex 6 (July), day 13.
      expect(ctorCalls).toContainEqual([2026, 6, 13]);
    });
  });
});
