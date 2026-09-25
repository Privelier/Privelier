import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../../../types';
import { cancelBookingAsCustomer, fetchOwnBookingsView } from '../../bookingsData';
import type { ToastOptions } from '../../../shared/components/ToastProvider';
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

const mockShowToast = jest.fn();
jest.mock('../../../shared/components/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../../../shared/components/ConfirmSheet', () => {
  const React = jest.requireActual('react');
  const { Pressable } = jest.requireActual('react-native');
  return {
    ConfirmSheet: ({ open, onConfirm, testID }: { open: boolean; onConfirm: () => void; testID: string }) =>
      open ? React.createElement(Pressable, { testID: `${testID}-confirm`, onPress: onConfirm }) : null,
  };
});

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
const mockCancelBooking = jest.mocked(cancelBookingAsCustomer);
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
  mockShowToast.mockReset();
  mockCancelBooking.mockReset();
  mockCancelBooking.mockResolvedValue({ status: 'ok', booking: { ...BOOKING, status: 'cancelled' } });
  mockFetchBookings.mockReset();
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
  it('waits for the undo window before sending cancellation', async () => {
    await render(<BookingsScreen />);
    await waitFor(() => expect(screen.getByTestId('booking-cancel-booking-1')).toBeTruthy());

    await act(async () => fireEvent.press(screen.getByTestId('booking-cancel-booking-1')));
    expect(screen.getByTestId('customer-bookings-cancel-sheet-confirm')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('customer-bookings-cancel-sheet-confirm')));
    const first = mockShowToast.mock.calls[0][0] as ToastOptions;
    expect(first.durationMs).toBe(5000);
    expect(first.action?.label).toBe('Undo');
    expect(mockCancelBooking).not.toHaveBeenCalled();
    expect(screen.getByTestId('customer-bookings-row-undo-window-booking-1')).toBeTruthy();

    await act(async () => first.onClose?.('action'));
    expect(mockCancelBooking).not.toHaveBeenCalled();
    expect(screen.getByTestId('booking-cancel-booking-1')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByTestId('booking-cancel-booking-1')));
    await act(async () => fireEvent.press(screen.getByTestId('customer-bookings-cancel-sheet-confirm')));
    const second = mockShowToast.mock.calls[1][0] as ToastOptions;
    await act(async () => second.onClose?.('timeout'));
    await waitFor(() => expect(mockCancelBooking).toHaveBeenCalledWith('booking-1'));
  });

  it('refreshes in brass while keeping the loaded booking visible', async () => {
    await render(<BookingsScreen />);
    await waitFor(() => expect(screen.getByTestId('customer-bookings-row-booking-1')).toBeTruthy());
    const refresh = screen.getByTestId('customer-bookings-list').props.refreshControl;
    expect(refresh.props.tintColor).toBe('#BFA06B');
    expect(refresh.props.colors).toEqual(['#BFA06B']);

    mockFetchBookings.mockImplementationOnce(() => new Promise(() => {}));
    await act(async () => refresh.props.onRefresh());
    expect(mockFetchBookings).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('customer-bookings-row-booking-1')).toBeTruthy();
    expect(screen.getByTestId('customer-bookings-list').props.refreshControl.props.refreshing).toBe(true);
  });

  it('shows content-shaped placeholders without an empty-state flash on first load', async () => {
    mockFetchBookings.mockImplementation(() => new Promise(() => {}));
    await render(<BookingsScreen />);

    expect(screen.getByTestId('customer-bookings-loading').props.accessibilityLabel).toBe('Loading bookings');
    expect(screen.queryByTestId('customer-bookings-empty')).toBeNull();
    expect(screen.queryByTestId('customer-bookings-row-booking-1')).toBeNull();
  });

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
