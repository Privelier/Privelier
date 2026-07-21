/**
 * Tests for the reusable StarRating display + StarRatingInput picker
 * (build-order step 18, reviews). Both are presentation-only; the theme hook
 * and the icon font are mocked and each is driven purely through props/testIDs.
 *
 * NB: @testing-library/react-native v14's `render()` is async — every test
 * `await`s it before touching the global `screen` (repo convention).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StarRating } from '../StarRating';
import { StarRatingInput } from '../StarRatingInput';

// @expo/vector-icons pulls expo-font -> expo-asset at import; render each glyph
// as its name in a Text node so tests can read which glyph (filled 'star' vs
// 'star-outline') each star drew, in order.
jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({ isDark: true, colors: { accent: '#BFA06B', border: '#2A2A2E' } }),
}));

function starNames(): string[] {
  return screen.getAllByText(/^star(-outline)?$/).map((n) => n.props.children as string);
}

describe('StarRating (display)', () => {
  it('fills the rounded number of stars and outlines the rest', async () => {
    await render(<StarRating rating={3} testID="stars" />);
    expect(starNames()).toEqual(['star', 'star', 'star', 'star-outline', 'star-outline']);
  });

  it('rounds to the nearest whole star', async () => {
    await render(<StarRating rating={3.6} />);
    // 3.6 -> 4 filled
    expect(starNames().filter((n) => n === 'star')).toHaveLength(4);
  });

  it('renders five outlines for a zero rating', async () => {
    await render(<StarRating rating={0} />);
    expect(starNames().filter((n) => n === 'star-outline')).toHaveLength(5);
  });

  it('clamps a rating above five to five filled stars', async () => {
    await render(<StarRating rating={9} />);
    expect(starNames().every((n) => n === 'star')).toBe(true);
  });

  it('exposes an accessible label with the rounded value', async () => {
    await render(<StarRating rating={4.2} testID="stars" />);
    expect(screen.getByTestId('stars').props.accessibilityLabel).toBe('Rated 4 out of 5');
  });
});

describe('StarRatingInput (picker)', () => {
  it('calls onChange with the tapped star value', async () => {
    const onChange = jest.fn();
    await render(<StarRatingInput value={0} onChange={onChange} testID="rate" />);

    fireEvent.press(screen.getByTestId('rate-star-4'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('marks stars up to the current value as selected', async () => {
    const onChange = jest.fn();
    await render(<StarRatingInput value={2} onChange={onChange} testID="rate" />);

    expect(screen.getByTestId('rate-star-2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('rate-star-3').props.accessibilityState.selected).toBe(false);
  });

  it('does not fire onChange when disabled', async () => {
    const onChange = jest.fn();
    await render(<StarRatingInput value={0} onChange={onChange} disabled testID="rate" />);

    fireEvent.press(screen.getByTestId('rate-star-1'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('announces the current value on the group', async () => {
    const onChange = jest.fn();
    await render(<StarRatingInput value={5} onChange={onChange} testID="rate" />);
    expect(screen.getByTestId('rate').props.accessibilityValue).toEqual({ text: '5 out of 5 stars' });
  });
});
