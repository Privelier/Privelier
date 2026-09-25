import { act, cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { BookingRow, ServiceRow } from '../../../types';
import { fetchOwnRequestsView } from '../../requestsData';
import RequestsScreen from '../RequestsScreen';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
  };
});

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'barber-1' } } },
      }),
    },
  },
}));

jest.mock('../../requestsData', () => ({
  acceptBooking: jest.fn(),
  cancelBookingAsBarber: jest.fn(),
  completeBooking: jest.fn(),
  fetchOwnRequestsView: jest.fn(),
  rejectBooking: jest.fn(),
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

const mockFetchRequests = jest.mocked(fetchOwnRequestsView);

const BOOKING: BookingRow = {
  id: 'booking-2',
  customer_id: 'customer-2',
  barber_id: 'barber-1',
  service_id: 'service-2',
  date: '2099-09-26',
  time: '14:30:00',
  location: 'Friedrichstraße 10, Berlin',
  price: 55,
  duration_minutes: 60,
  status: 'accepted',
  created_at: '2099-09-01T12:00:00.000Z',
};

const SERVICE: ServiceRow = {
  id: 'service-2',
  barber_id: 'barber-1',
  name: 'Cut and beard',
  price: 55,
  duration_minutes: 60,
};

beforeEach(() => {
  mockFetchRequests.mockReset();
  mockFetchRequests.mockResolvedValue({
    status: 'ok',
    bookings: [BOOKING],
    servicesById: new Map([[SERVICE.id, SERVICE]]),
    counterpartsByBookingId: new Map([
      ['booking-2', { id: 'customer-2', name: 'Mina Hassan', profile_image: null }],
    ]),
  });
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

describe('RequestsScreen status presentation', () => {
  it('refreshes in brass while keeping the loaded request visible', async () => {
    await render(<RequestsScreen />);
    await waitFor(() => expect(screen.getByTestId('barber-requests-row-booking-2')).toBeTruthy());
    const refresh = screen.getByTestId('barber-requests-list').props.refreshControl;
    expect(refresh.props.tintColor).toBe('#BFA06B');
    expect(refresh.props.colors).toEqual(['#BFA06B']);

    mockFetchRequests.mockImplementationOnce(() => new Promise(() => {}));
    await act(async () => refresh.props.onRefresh());
    expect(mockFetchRequests).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('barber-requests-row-booking-2')).toBeTruthy();
    expect(screen.getByTestId('barber-requests-list').props.refreshControl.props.refreshing).toBe(true);
  });

  it('shows content-shaped placeholders without an empty-state flash on first load', async () => {
    mockFetchRequests.mockImplementation(() => new Promise(() => {}));
    await render(<RequestsScreen />);

    expect(screen.getByTestId('barber-requests-loading').props.accessibilityLabel).toBe('Loading bookings');
    expect(screen.queryByTestId('barber-requests-empty')).toBeNull();
    expect(screen.queryByTestId('barber-requests-row-booking-2')).toBeNull();
  });

  it('renders the booking state through an accessible semantic pill', async () => {
    await render(<RequestsScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('barber-requests-status-booking-2')).toBeTruthy()
    );
    const status = screen.getByTestId('barber-requests-status-booking-2');

    expect(status.props.accessibilityLabel).toBe('Status: Accepted');
    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(screen.getByTestId('barber-requests-row-booking-2')).toBeTruthy();
    expect(screen.getByTestId('barber-requests-avatar-booking-2-monogram').props.children).toBe('MH');
    expect(StyleSheet.flatten(screen.getByTestId('barber-requests-avatar-booking-2').props.style)).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 22,
    });
    expect(screen.getByTestId('request-cancel-booking-2')).toBeTruthy();
    expect(screen.getByTestId('request-complete-booking-2')).toBeTruthy();
  });
});
