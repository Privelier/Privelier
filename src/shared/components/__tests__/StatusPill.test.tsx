import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { BookingStatus } from '../../../types';
import { StatusPill } from '../StatusPill';

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#BFA06B',
      accentText: '#BFA06B',
      success: '#51785C',
      successText: '#7FA98B',
      error: '#A8453E',
      errorText: '#CE7A73',
      textSecondary: '#9A968C',
    },
    fonts: { bodyMedium: 'Inter_500Medium' },
  }),
}));

const CASES: [BookingStatus, string, string, string, string][] = [
  ['pending', 'Pending', '#BFA06B14', '#BFA06B52', '#BFA06B'],
  ['accepted', 'Accepted', '#51785C14', '#51785C52', '#7FA98B'],
  ['rejected', 'Rejected', '#A8453E14', '#A8453E52', '#CE7A73'],
  ['completed', 'Completed', '#9A968C14', '#9A968C52', '#9A968C'],
  ['cancelled', 'Cancelled', '#9A968C14', '#9A968C52', '#9A968C'],
];

describe('StatusPill', () => {
  it.each(CASES)(
    'renders %s with its semantic tone',
    async (status, label, background, border, text) => {
      await render(<StatusPill status={status} testID={`status-${status}`} />);
      const pill = screen.getByTestId(`status-${status}`);
      const labelNode = screen.getByText(label);

      expect(pill.props.accessibilityRole).toBe('text');
      expect(pill.props.accessibilityLabel).toBe(`Status: ${label}`);
      expect(pill.props.accessibilityLiveRegion).toBe('polite');
      expect(StyleSheet.flatten(pill.props.style)).toMatchObject({
        backgroundColor: background,
        borderColor: border,
        borderRadius: 999,
      });
      expect(StyleSheet.flatten(labelNode.props.style).color).toBe(text);
    }
  );

  it('allows the capsule and label to grow with Dynamic Type', async () => {
    await render(<StatusPill status="cancelled" testID="status" />);
    const pillStyle = StyleSheet.flatten(screen.getByTestId('status').props.style);
    const label = screen.getByText('Cancelled');

    expect(pillStyle.height).toBeUndefined();
    expect(pillStyle.minHeight).toBeUndefined();
    expect(label.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(label.props.style).letterSpacing).toBeUndefined();
  });
});
