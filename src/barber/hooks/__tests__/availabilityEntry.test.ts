import { formatDateEntry, formatTimeEntry } from '../useAvailabilityForm';

describe('formatTimeEntry', () => {
  it.each([
    ['', ''],
    ['9', '9'],
    ['09', '09'],
    ['093', '09:3'],
    ['0930', '09:30'],
    ['09:30', '09:30'],
    ['09:305', '09:30'],
    ['9h30', '93:0'],
  ])('shapes %p into %p', (raw, expected) => {
    expect(formatTimeEntry(raw)).toBe(expected);
  });
});

describe('formatDateEntry', () => {
  it.each([
    ['2026', '2026'],
    ['20261', '2026-1'],
    ['202611', '2026-11'],
    ['2026113', '2026-11-3'],
    ['20261130', '2026-11-30'],
    ['2026-11-30', '2026-11-30'],
    ['2026-11-301', '2026-11-30'],
  ])('shapes %p into %p', (raw, expected) => {
    expect(formatDateEntry(raw)).toBe(expected);
  });
});
