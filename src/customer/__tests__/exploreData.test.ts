/**
 * Unit tests for the Explore tab's pure logic (src/customer/exploreData.ts).
 * No mocking — everything derives from fixture rows. The two things pinned
 * hardest:
 *  - toMapPin's honesty rule (founder decision D4): missing display
 *    coordinates NEVER produce a pin — no default, no fake position;
 *  - windowCoversToday follows slots.ts's window-selection semantics
 *    (specific_date precedence) with a pinned clock (the date-fragility
 *    lesson: fixtures + real clocks don't mix).
 */
import type { AvailabilityRow, BarberDirectoryRow, ServiceRow } from '../../types';
import {
  applyExploreFilter,
  fromPrice,
  toMapPin,
  UNDER_PRICE_THRESHOLD,
  windowCoversToday,
} from '../exploreData';

// Monday 2026-07-13, noon local — matches no "today" drift ever.
const NOW = new Date(2026, 6, 13, 12, 0);

function barber(overrides: Partial<BarberDirectoryRow> = {}): BarberDirectoryRow {
  return {
    id: 'b1',
    name: 'Atlas',
    city: 'Amsterdam',
    country: 'Netherlands',
    profile_image: null,
    bio: null,
    rating: 0,
    verified: true,
    display_latitude: 52.372,
    display_longitude: 4.897,
    ...overrides,
  };
}

function service(overrides: Partial<ServiceRow> = {}): ServiceRow {
  return { id: 's1', barber_id: 'b1', name: 'Fade', price: 40, duration_minutes: 45, ...overrides };
}

function window(overrides: Partial<AvailabilityRow> = {}): AvailabilityRow {
  return {
    id: 'w1',
    barber_id: 'b1',
    day_of_week: null,
    specific_date: null,
    start_time: '09:00:00',
    end_time: '17:00:00',
    ...overrides,
  };
}

describe('fromPrice', () => {
  it('returns the cheapest price, ignoring non-finite values, and null for none', () => {
    expect(fromPrice([service({ price: 60 }), service({ price: 35 }), service({ price: 80 })])).toBe(35);
    expect(fromPrice([service({ price: Number.NaN }), service({ price: 50 })])).toBe(50);
    expect(fromPrice([])).toBeNull();
  });
});

describe('windowCoversToday', () => {
  it('matches a recurring weekday window (2026-07-13 is a Monday)', () => {
    expect(windowCoversToday([window({ day_of_week: 1 })], NOW)).toBe(true);
    expect(windowCoversToday([window({ day_of_week: 2 })], NOW)).toBe(false);
  });

  it('matches a specific_date window for exactly today', () => {
    expect(windowCoversToday([window({ specific_date: '2026-07-13' })], NOW)).toBe(true);
    expect(windowCoversToday([window({ specific_date: '2026-07-14' })], NOW)).toBe(false);
  });

  it('gives specific_date rows precedence and handles the empty list', () => {
    // A specific row for today plus an off-weekday recurring row: available.
    expect(
      windowCoversToday(
        [window({ specific_date: '2026-07-13' }), window({ day_of_week: 5 })],
        NOW
      )
    ).toBe(true);
    expect(windowCoversToday([], NOW)).toBe(false);
  });
});

describe('applyExploreFilter', () => {
  const a = barber({ id: 'a', verified: true });
  const b = barber({ id: 'b', verified: false });
  const c = barber({ id: 'c', verified: true });
  const barbers = [a, b, c];

  const ctx = {
    servicesByBarber: new Map([
      ['a', [service({ barber_id: 'a', price: 120 })]],
      ['b', [service({ barber_id: 'b', price: 85 })]],
      // c: no services known
    ]),
    windowsByBarber: new Map([
      ['a', [window({ barber_id: 'a', day_of_week: 1 })]], // Monday -> today
      ['b', [window({ barber_id: 'b', day_of_week: 3 })]],
      // c: no windows known
    ]),
    now: NOW,
  };

  it("'all' passes everything through untouched", () => {
    expect(applyExploreFilter(barbers, 'all', ctx)).toEqual(barbers);
  });

  it("'today' keeps only barbers with working hours covering today", () => {
    expect(applyExploreFilter(barbers, 'today', ctx).map((x) => x.id)).toEqual(['a']);
  });

  it("'under100' keeps only barbers whose cheapest KNOWN price beats the threshold", () => {
    // a: from €120 (out), b: from €85 (in), c: no known prices (out — never
    // assume a price that was not loaded).
    expect(applyExploreFilter(barbers, 'under100', ctx).map((x) => x.id)).toEqual(['b']);
    expect(UNDER_PRICE_THRESHOLD).toBe(100);
  });

  it("'verified' filters on the directory's verified flag", () => {
    expect(applyExploreFilter(barbers, 'verified', ctx).map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('toMapPin (the D4 honesty rule)', () => {
  it('builds a pin from display coordinates + real from-price', () => {
    expect(toMapPin(barber(), [service({ price: 42.5 })])).toEqual({
      barberId: 'b1',
      latitude: 52.372,
      longitude: 4.897,
      fromPrice: 42.5,
    });
  });

  it('returns null — never a default position — when either display coordinate is missing', () => {
    expect(toMapPin(barber({ display_latitude: null }), [service()])).toBeNull();
    expect(toMapPin(barber({ display_longitude: null }), [service()])).toBeNull();
    expect(toMapPin(barber({ display_latitude: null, display_longitude: null }), [])).toBeNull();
    expect(toMapPin(barber({ display_latitude: Number.NaN }), [service()])).toBeNull();
  });

  it('keeps the pin but nulls the price when no priced services are known', () => {
    expect(toMapPin(barber(), [])).toMatchObject({ fromPrice: null });
  });
});
