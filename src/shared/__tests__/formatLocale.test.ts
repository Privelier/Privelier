import { formatBookingWhen, formatChatDay, formatMoney, timeOfDayGreeting } from '../format';
import { getAppLanguage } from '../locale';

jest.mock('../locale', () => ({ getAppLanguage: jest.fn(() => 'de') }));

it('uses German currency, appointment dates and chat day labels together', () => {
  expect(formatMoney(35)).toBe('35\u00a0€');
  expect(formatMoney(35.5)).toBe('35,50\u00a0€');
  expect(formatBookingWhen('2026-07-08', '14:30:00')).toBe('Mi., 8. Juli · 14:30');
  const now = new Date(2026, 6, 8, 18);
  expect(formatChatDay(new Date(2026, 6, 8, 12).toISOString(), now)).toBe('Heute');
  expect(formatChatDay(new Date(2026, 6, 7, 12).toISOString(), now)).toBe('Gestern');
  expect(timeOfDayGreeting(now)).toBe('Guten Abend');
});

it('preserves the English fallback', () => {
  jest.mocked(getAppLanguage).mockReturnValue('en');
  expect(formatMoney(35.5)).toBe('€35.50');
  expect(formatBookingWhen('2026-07-08', '14:30:00')).toBe('Wed 8 Jul · 14:30');
});
