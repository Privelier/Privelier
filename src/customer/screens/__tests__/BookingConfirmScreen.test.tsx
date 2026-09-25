import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import BookingConfirmScreen from '../BookingConfirmScreen';
import { insertBooking } from '../../bookingCreateData';
import { haptics } from '../../../shared/haptics';

jest.mock('../../bookingCreateData', () => ({ insertBooking: jest.fn() }));
jest.mock('../../../shared/haptics', () => ({
  haptics: { confirm: jest.fn(), success: jest.fn() },
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../../../shared/components/PrimaryButton', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    PrimaryButton: ({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) =>
      React.createElement(Pressable, { testID, onPress }, React.createElement(Text, null, label)),
  };
});
jest.mock('../../../shared/components/ScreenBackHeader', () => ({ ScreenBackHeader: () => null }));
jest.mock('../../components/BookingStepIndicator', () => ({ BookingStepIndicator: () => null }));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { background: '#121214', surface: '#1B1B1E', border: '#333', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B' },
    fonts: { headingMedium: 'Playfair', body: 'Inter', bodyMedium: 'Inter' },
  }),
}));

const route = {
  params: {
    barberId: 'barber-1', barberName: 'Ada',
    service: { id: 'service-1', name: 'Haircut', price: 30, duration_minutes: 30 },
    date: '2026-09-28', time: '12:00:00', location: 'Main Street 1',
  },
};
const navigation = { goBack: jest.fn(), pop: jest.fn(), reset: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
});

it('confirms on tap and plays success feedback only after a real booking insert', async () => {
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'ok', booking: { price: 30 } });
  await render(<BookingConfirmScreen route={route as never} navigation={navigation as never} />);

  expect(StyleSheet.flatten(screen.getByText('€30').props.style)).toMatchObject({
    fontFamily: 'Inter_600SemiBold',
    fontVariant: ['lining-nums', 'tabular-nums'],
  });

  await fireEvent.press(screen.getByTestId('customer-booking-confirm-submit'));
  expect(haptics.confirm).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByTestId('customer-booking-confirm-success')).toBeTruthy());
  expect(haptics.success).toHaveBeenCalledTimes(1);
  expect(insertBooking).toHaveBeenCalledWith({
    barberId: 'barber-1', serviceId: 'service-1', date: '2026-09-28',
    time: '12:00:00', location: 'Main Street 1',
  });
});

it('does not play success feedback when the slot conflicts', async () => {
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'conflict' });
  await render(<BookingConfirmScreen route={route as never} navigation={navigation as never} />);

  await fireEvent.press(screen.getByTestId('customer-booking-confirm-submit'));
  await waitFor(() => expect(screen.getByTestId('customer-booking-confirm-error')).toBeTruthy());
  expect(haptics.confirm).toHaveBeenCalledTimes(1);
  expect(haptics.success).not.toHaveBeenCalled();
});
