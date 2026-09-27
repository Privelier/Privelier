import { render, screen } from '@testing-library/react-native';
import { MessageReceipt } from '../MessageReceipt';

jest.mock('@expo/vector-icons', () => ({
  Feather: ({ color, style }: { color: string; style?: object }) => {
    const React = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return React.createElement(Text, { testID: 'receipt-check', style: [{ color }, style] }, '✓');
  },
}));

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { accentText: '#BFA06B', textSecondary: '#9A968C' },
  }),
}));

describe('MessageReceipt', () => {
  it('uses two neutral checks for a sent, unread message', async () => {
    await render(<MessageReceipt state="sent" testID="sent-receipt" />);

    expect(screen.getByTestId('sent-receipt').props.accessibilityLabel).toBe('Sent, not read');
    expect(screen.getAllByTestId('receipt-check')).toHaveLength(2);
    expect(screen.getAllByTestId('receipt-check')[0].props.style[0].color).toBe('#9A968C');
  });

  it('uses two brass checks when the counterpart read the message', async () => {
    await render(<MessageReceipt state="read" testID="read-receipt" />);

    expect(screen.getByTestId('read-receipt').props.accessibilityLabel).toBe('Read');
    expect(screen.getAllByTestId('receipt-check')).toHaveLength(2);
    expect(screen.getAllByTestId('receipt-check')[0].props.style[0].color).toBe('#BFA06B');
  });

  it('uses one neutral check to identify a retryable unsent message', async () => {
    await render(<MessageReceipt state="failed" testID="failed-receipt" />);

    expect(screen.getByTestId('failed-receipt').props.accessibilityLabel).toBe('Not sent, tap to retry');
    expect(screen.getAllByTestId('receipt-check')).toHaveLength(1);
    expect(screen.getAllByTestId('receipt-check')[0].props.style[0].color).toBe('#9A968C');
  });
});
