import { busiestWindow, busyNow, isFastResponder, responseCopy, weekdayIndex, type PopularGrid } from '../barberStats';
import { visibleHours, clockLabel } from '../components/stats/PopularTimesChart';

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

const grid = (): PopularGrid => Array.from({ length: 7 }, () => Array<number>(24).fill(0));

describe('responseCopy', () => {
  it('speaks in minutes, hours, or days, and hides unknowns', () => {
    expect(responseCopy(null, false)).toBeNull();
    expect(responseCopy(4, false)).toBe('Usually replies in ~4 min');
    expect(responseCopy(17, false)).toBe('Usually replies in ~15 min');
    expect(responseCopy(17, true)).toBe('Antwortet meist in ~15 Min.');
    expect(responseCopy(130, false)).toBe('Usually replies within 3 h');
    expect(responseCopy(3000, false)).toBe('Usually replies within a day');
  });
  it('rewards replies within 30 minutes', () => {
    expect(isFastResponder(30)).toBe(true);
    expect(isFastResponder(31)).toBe(false);
    expect(isFastResponder(null)).toBe(false);
  });
});

describe('popular-times helpers', () => {
  it('finds the busiest contiguous window across the week', () => {
    const g = grid();
    g[5][14] = 0.8; g[5][15] = 1; g[5][16] = 0.75; g[5][17] = 0.2;
    g[1][10] = 0.6;
    expect(busiestWindow(g)).toEqual({ day: 5, start: 14, end: 17 });
    expect(busiestWindow(grid())).toBeNull();
  });

  it('maps JS weekdays (Sunday first) onto Monday-first rows and reads the current hour', () => {
    const saturday3pm = new Date(2026, 9, 24, 15, 10);
    expect(weekdayIndex(saturday3pm)).toBe(5);
    const g = grid();
    g[5][15] = 0.9;
    expect(busyNow(g, saturday3pm)).toBe('busy');
    g[5][15] = 0.4;
    expect(busyNow(g, saturday3pm)).toBe('moderate');
    expect(busyNow(grid(), saturday3pm)).toBe('quiet');
  });

  it('draws only hours with demand, padded and clamped', () => {
    const g = grid();
    g[2][9] = 0.3; g[4][19] = 1;
    expect(visibleHours(g)).toEqual([8, 20]);
    expect(visibleHours(grid())).toEqual([9, 20]);
    expect(clockLabel(14, false)).toBe('2 pm');
    expect(clockLabel(0, false)).toBe('12 am');
    expect(clockLabel(14, true)).toBe('14 Uhr');
  });
});
