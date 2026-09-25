import { act, render, screen, waitFor } from '@testing-library/react-native';
import { listBarberAvailability, listBarberBusySlots } from '../../availabilityData';
import BookingDateTimeScreen from '../BookingDateTimeScreen';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return { useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]) };
});
jest.mock('../../availabilityData', () => ({
  listBarberAvailability: jest.fn(),
  listBarberBusySlots: jest.fn(),
}));
jest.mock('../../../shared/components/ScreenBackHeader', () => ({ ScreenBackHeader: () => null }));
jest.mock('../../components/BookingStepIndicator', () => ({ BookingStepIndicator: () => null }));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { background: '#121214', surface: '#1B1B1E', border: '#333', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B', errorText: '#CE7A73', onAccent: '#121214' },
    fonts: { headingMedium: 'Playfair', body: 'Inter', bodyMedium: 'Inter' },
  }),
}));

const route = {
  params: {
    barberId: 'barber-1', barberName: 'Ada',
    service: { id: 'service-1', name: 'Haircut', price: 30, duration_minutes: 30 },
  },
};
const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.mocked(listBarberAvailability).mockReset();
  jest.mocked(listBarberBusySlots).mockReset();
});

it('shows neutral date and slot shapes until real availability is known', async () => {
  let finish!: (value: Awaited<ReturnType<typeof listBarberAvailability>>) => void;
  jest.mocked(listBarberAvailability).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await render(<BookingDateTimeScreen route={route as never} navigation={navigation as never} />);

  expect(screen.getByTestId('customer-booking-datetime-loading').props.accessibilityLabel).toBe('Loading availability');
  expect(screen.queryByTestId('customer-booking-datetime-empty')).toBeNull();
  expect(screen.queryByTestId('customer-booking-datetime-day-0')).toBeNull();
  expect(listBarberBusySlots).not.toHaveBeenCalled();

  await act(async () => finish({ status: 'error', code: 'network', retryable: true, message: 'Could not load availability.' }));
  await waitFor(() => expect(screen.getByTestId('customer-booking-datetime-error')).toBeTruthy());
  expect(screen.queryByTestId('customer-booking-datetime-loading')).toBeNull();
});
