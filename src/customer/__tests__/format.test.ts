import {
  firstName,
  formatBookingWhen,
  formatMessageTime,
  formatMoney,
  timeOfDayGreeting,
} from '../format';

describe('timeOfDayGreeting', () => {
  it.each([
    [0, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('hour %i → %s', (hour, expected) => {
    expect(timeOfDayGreeting(new Date(2026, 6, 8, hour, 0, 0))).toBe(expected);
  });
});

describe('firstName', () => {
  it('takes the first word of a full name', () => {
    expect(firstName('Ada Lovelace King')).toBe('Ada');
  });
  it('trims surrounding whitespace', () => {
    expect(firstName('  Ada  Lovelace ')).toBe('Ada');
  });
  it.each([[null], [undefined], [''], ['   ']])('falls back to "there" for %p', (value) => {
    expect(firstName(value as string | null | undefined)).toBe('there');
  });
});

describe('formatBookingWhen', () => {
  it('formats a bookings date/time pair', () => {
    expect(formatBookingWhen('2026-07-08', '14:30:00')).toBe('Wed 8 Jul · 14:30');
  });
  it('falls back to raw strings when unparseable', () => {
    expect(formatBookingWhen('not-a-date', '14:30:00')).toBe('not-a-date · 14:30');
  });
});

describe('formatMoney', () => {
  it('renders whole euros without decimals', () => {
    expect(formatMoney(110)).toBe('€110');
  });
  it('keeps fractional cents exactly, never rounding', () => {
    expect(formatMoney(89.5)).toBe('€89.50');
    expect(formatMoney(42.25)).toBe('€42.25');
  });
});

describe('formatMessageTime', () => {
  const NOW = new Date(2026, 6, 9, 15, 0, 0); // 9 Jul 2026, local

  it('same local day → clock only, zero-padded', () => {
    expect(formatMessageTime(new Date(2026, 6, 9, 9, 5, 0).toISOString(), NOW)).toBe('09:05');
  });

  it('a different day → short date plus clock', () => {
    expect(formatMessageTime(new Date(2026, 6, 8, 14, 30, 0).toISOString(), NOW)).toBe(
      '8 Jul · 14:30'
    );
  });

  it('unparseable input → empty string, not a crash', () => {
    expect(formatMessageTime('not-a-date', NOW)).toBe('');
  });
});
