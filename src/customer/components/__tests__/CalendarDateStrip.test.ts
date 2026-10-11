import { densityDots } from '../CalendarDateStrip';

jest.mock('../../../shared/haptics', () => ({ haptics: { selection: jest.fn() } }));

it('maps real slot counts to 0–3 dots and never shows dots for zero', () => {
  expect([0, 1, 2, 3, 5, 6, 12].map(densityDots)).toEqual([0, 1, 1, 2, 2, 3, 3]);
});
