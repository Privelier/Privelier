import { cleanup, render, screen, waitFor } from '@testing-library/react-native';
import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../../../types';
import { fetchOwnBookingsView } from '../../bookingsData';
import { fetchOwnReviewedBookingIds } from '../../reviewsData';
import BookingsScreen from '../BookingsScreen';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
    useNavigation: () => ({ navigate: jest.fn() }),
  };
});

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'customer-1' } } },
      }),
    },
  },
}));

jest.mock('../../bookingsData', () => ({
  cancelBookingAsCustomer: jest.fn(),
  fetchOwnBookingsView: jest.fn(),
  isUpcomingBooking: jest.fn(() => true),
}));

jest.mock('../../reviewsData', () => ({
  fetchOwnReviewedBookingIds: jest.fn(),
}));

jest.mock('../../../shared/useBookingsRealtime', () => ({
  useBookingsRealtime: jest.fn(),
}));

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#121214',
      surface: '#1B1B1E',
      border: '#2A2A2E',
      textPrimary: '#F5F1E8',
      textSecondary: '#9A968C',
      accent: '#BFA06B',
      accentText: '#BFA06B',
      onAccent: '#121214',
      success: '#51785C',
      successText: '#7FA98B',
      error: '#A8453E',
      errorText: '#CE7A73',
    },
    fonts: {
      headingMedium: 'serif',
      body: 'sans',
      bodyMedium: 'sans',
      bodySemiBold: 'sans',
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement(View, props, children),
  };
});

const mockFetchBookings = jest.mocked(fetchOwnBookingsView);
const mockFetchReviewed = jest.mocked(fetchOwnReviewedBookingIds);

const BOOKING: BookingRow = {
  id: 'booking-1',
  customer_id: 'customer-1',
  barber_id: 'barber-1',
  service_id: 'service-1',
  date: '2099-09-25',
  time: '10:00:00',
  location: 'Alexanderplatz 1, Berlin',
  price: 45,
  duration_minutes: 45,
  status: 'pending',
  created_at: '2099-09-01T10:00:00.000Z',
};

const BARBER: BarberDirectoryRow = {
  id: 'barber-1',
  name: 'Tarek Mansour',
  city: 'Berlin',
  country: 'Germany',
  profile_image: null,
  bio: null,
  rating: 4.9,
  verified: true,
  display_latitude: null,
  display_longitude: null,
};

const SERVICE: ServiceRow = {
  id: 'service-1',
  barber_id: 'barber-1',
  name: 'Classic cut',
  price: 45,
  duration_minutes: 45,
};

beforeEach(() => {
  mockFetchBookings.mockResolvedValue({
    status: 'ok',
    bookings: [BOOKING],
    barbersById: new Map([[BARBER.id, BARBER]]),
    servicesById: new Map([[SERVICE.id, SERVICE]]),
  });
  mockFetchReviewed.mockResolvedValue({ status: 'ok', reviewedBookingIds: new Set() });
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

describe('BookingsScreen status presentation', () => {
  it('renders the booking state through an accessible semantic pill', async () => {
    await render(<BookingsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('customer-bookings-status-booking-1')).toBeTruthy()
    );
    const status = screen.getByTestId('customer-bookings-status-booking-1');

    expect(status.props.accessibilityLabel).toBe('Status: Pending');
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByTestId('customer-bookings-row-booking-1')).toBeTruthy();
    expect(screen.getByTestId('customer-bookings-avatar-booking-1-monogram').props.children).toBe('TM');
    expect(screen.getByTestId('customer-bookings-avatar-booking-1').props.accessible).toBe(false);
    expect(screen.getByTestId('booking-cancel-booking-1')).toBeTruthy();
  });
});
