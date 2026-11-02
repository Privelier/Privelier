import { barberLookStatus, canSendLook, hitRateLine, lookStage, styleList, toggleStyle } from '../lookPresentation';
import type { BarberLookStat, LookStyle } from '../types';

const NOW = new Date('2026-10-28T12:00:00Z');
const STYLES: LookStyle[] = [
  { key: 'skin_fade', label_en: 'Skin fade', label_de: 'Skin Fade', sort_order: 1 },
  { key: 'scissor_cut', label_en: 'Scissor cut', label_de: 'Scherenschnitt', sort_order: 7 },
];

describe('lookStage', () => {
  it('maps a missing look, an unsent draft and a sent draft', () => {
    expect(lookStage(null, NOW)).toBe('none');
    expect(lookStage({ status: 'draft', submitted_at: null }, NOW)).toBe('editing');
    expect(lookStage({ status: 'draft', submitted_at: '2026-10-27T12:00:00Z' }, NOW)).toBe('awaiting_customer');
  });

  it('expires an unanswered draft after 14 days, like the server', () => {
    expect(lookStage({ status: 'draft', submitted_at: '2026-10-14T13:00:00Z' }, NOW)).toBe('awaiting_customer');
    expect(lookStage({ status: 'draft', submitted_at: '2026-10-14T11:00:00Z' }, NOW)).toBe('expired');
  });

  it('passes answered statuses through', () => {
    for (const status of ['confirmed', 'published', 'declined', 'withdrawn'] as const) {
      expect(lookStage({ status, submitted_at: '2026-10-01T00:00:00Z' }, NOW)).toBe(status);
    }
  });
});

describe('toggleStyle', () => {
  it('adds, removes and caps at three styles', () => {
    expect(toggleStyle([], 'a')).toEqual(['a']);
    expect(toggleStyle(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleStyle(['a', 'b', 'c'], 'd')).toEqual(['a', 'b', 'c']);
  });
});

describe('canSendLook', () => {
  it('needs a style, one to three photos and the no-face confirmation', () => {
    expect(canSendLook({ styles: ['a'], photoCount: 1, noFace: true })).toBe(true);
    expect(canSendLook({ styles: [], photoCount: 1, noFace: true })).toBe(false);
    expect(canSendLook({ styles: ['a'], photoCount: 0, noFace: true })).toBe(false);
    expect(canSendLook({ styles: ['a'], photoCount: 4, noFace: true })).toBe(false);
    expect(canSendLook({ styles: ['a'], photoCount: 2, noFace: false })).toBe(false);
  });
});

describe('style labels', () => {
  it('uses the app language and falls back to the key', () => {
    expect(styleList(STYLES, ['skin_fade', 'scissor_cut'], true)).toBe('Skin Fade, Scherenschnitt');
    expect(styleList(STYLES, ['skin_fade', 'unknown'], false)).toBe('Skin fade, unknown');
  });
});

describe('hitRateLine', () => {
  const stat = (hit_rate: number | null, feedback_count: number): BarberLookStat => ({
    style: 'skin_fade', label_en: 'Skin fade', label_de: 'Skin Fade', feedback_count, exact_count: 0, close_count: 0, hit_rate, proof_count: 0,
  });

  it('shows the exact-only rate once the server reveals it', () => {
    expect(hitRateLine(stat(0.94, 31), false)).toBe('Skin fade: 94% exact, 31 ratings');
    expect(hitRateLine(stat(0.94, 31), true)).toBe('Skin Fade: 94 % genau getroffen, 31 Bewertungen');
  });

  it('says honestly when there are not enough ratings yet', () => {
    expect(hitRateLine(stat(null, 3), false)).toBe('Skin fade: not enough ratings yet (3)');
    expect(hitRateLine(stat(null, 3), true)).toBe('Skin Fade: noch zu wenige Bewertungen (3)');
  });
});

describe('barberLookStatus', () => {
  it('has German and English copy for every stage', () => {
    for (const stage of ['none', 'editing', 'awaiting_customer', 'expired', 'confirmed', 'published', 'declined', 'withdrawn'] as const) {
      expect(barberLookStatus(stage, true).title).not.toBe('');
      expect(barberLookStatus(stage, false).body).not.toBe('');
    }
  });
});
