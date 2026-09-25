import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { fetchOwnProfile } from '../../../auth/authService';
import BookingLocationScreen from '../BookingLocationScreen';

jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
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
    date: '2026-09-28', time: '12:00:00',
  },
};
const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  navigation.navigate.mockReset();
  jest.mocked(fetchOwnProfile).mockReset().mockResolvedValue({
    status: 'ok',
    profile: { city: 'Berlin' } as never,
  });
});

it('waits for blur before showing street validation despite a real city prefill', async () => {
  await render(<BookingLocationScreen route={route as never} navigation={navigation as never} />);
  await waitFor(() => expect(screen.getByTestId('customer-booking-location-city').props.value).toBe('Berlin'));

  expect(screen.queryByTestId('customer-booking-location-street-error')).toBeNull();
  expect(screen.queryByTestId('customer-booking-location-city-error')).toBeNull();
  const street = screen.getByTestId('customer-booking-location-input');
  expect(street.props.placeholder).toBe('Street and building number');
  await fireEvent.changeText(street, '12');
  expect(screen.queryByTestId('customer-booking-location-street-error')).toBeNull();
  await fireEvent(street, 'blur');
  expect(screen.getByTestId('customer-booking-location-street-error').props.accessibilityRole).toBe('alert');

  await fireEvent.changeText(street, 'Main Street 12');
  expect(screen.queryByTestId('customer-booking-location-street-error')).toBeNull();
  expect(street.props.returnKeyType).toBe('next');
  expect(screen.getByTestId('customer-booking-location-city').props.returnKeyType).toBe('next');
  expect(screen.getByTestId('customer-booking-location-unit').props.returnKeyType).toBe('next');
  expect(screen.getByTestId('customer-booking-location-instructions').props.returnKeyType).toBe('done');
  await fireEvent(screen.getByTestId('customer-booking-location-instructions'), 'submitEditing');
  expect(navigation.navigate).toHaveBeenCalledWith('BookingConfirm', expect.objectContaining({
    location: 'Main Street 12, Berlin',
  }));
});

it('shows a city error only after the city field is touched', async () => {
  await render(<BookingLocationScreen route={route as never} navigation={navigation as never} />);
  await waitFor(() => expect(screen.getByTestId('customer-booking-location-city').props.value).toBe('Berlin'));
  const city = screen.getByTestId('customer-booking-location-city');
  await fireEvent.changeText(city, '');
  expect(screen.queryByTestId('customer-booking-location-city-error')).toBeNull();
  await fireEvent(city, 'blur');
  expect(screen.getByTestId('customer-booking-location-city-error').props.accessibilityRole).toBe('alert');
});

it('the last keyboard action reveals missing required fields without navigating', async () => {
  jest.mocked(fetchOwnProfile).mockImplementation(() => new Promise(() => {}));
  await render(<BookingLocationScreen route={route as never} navigation={navigation as never} />);

  await fireEvent(screen.getByTestId('customer-booking-location-instructions'), 'submitEditing');
  expect(screen.getByTestId('customer-booking-location-street-error')).toBeTruthy();
  expect(screen.getByTestId('customer-booking-location-city-error')).toBeTruthy();
  expect(navigation.navigate).not.toHaveBeenCalled();
});
