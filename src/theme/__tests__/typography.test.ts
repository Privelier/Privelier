import { fontFamily, numericText } from '../typography';

it('uses one lining, tabular numeral treatment across prices and stats', () => {
  expect(numericText.fontFamily).toBe(fontFamily.bodySemiBold);
  expect(numericText.fontVariant).toEqual(['lining-nums', 'tabular-nums']);
});
