import { matchProofLine, SEARCH_WINDOWS, searchDays, shortTime } from '../searchPresentation';
import type { LookMatch } from '../types';

const match = (hit_rate: number | null): LookMatch => ({
  barber_id: 'x', barber_name: 'Xavier', barber_image: null, barber_rating: 4.8, proof_count: 6, feedback_count: 9, hit_rate,
  service_id: 's', service_name: 'Fade', service_price: 35, service_duration: 60, first_free_time: '18:30:00',
});

describe('searchDays', () => {
  it('lists local calendar days from today, across a month end', () => {
    expect(searchDays(3, new Date(2026, 9, 30, 23, 30))).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
});

describe('SEARCH_WINDOWS', () => {
  it('stays within the server limit of twelve hours and never wraps midnight', () => {
    for (const window of SEARCH_WINDOWS) {
      expect(window.from < window.to).toBe(true);
      const hours = Number(window.to.slice(0, 2)) - Number(window.from.slice(0, 2));
      expect(hours).toBeLessThanOrEqual(12);
    }
  });
});

describe('match copy', () => {
  it('shortens the time and prefers the revealed exact-hit rate', () => {
    expect(shortTime('18:30:00')).toBe('18:30');
    expect(matchProofLine(match(0.89), 'Taper', false)).toBe('Taper: 89% exact, 9 ratings');
    expect(matchProofLine(match(0.89), 'Taper', true)).toBe('Taper: 89 % genau getroffen, 9 Bewertungen');
  });

  it('falls back to the proof count while the rate is hidden', () => {
    expect(matchProofLine(match(null), 'Taper', false)).toBe('6 confirmed Taper looks');
    expect(matchProofLine(match(null), 'Taper', true)).toBe('6 bestätigte Taper-Looks');
  });
});
