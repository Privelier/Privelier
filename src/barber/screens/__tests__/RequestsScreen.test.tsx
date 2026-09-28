import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { BookingRow, ServiceRow } from '../../../types';
import { cancelBookingAsBarber, fetchOwnRequestsView } from '../../requestsData';
import RequestsScreen, { buildRequestSections } from '../RequestsScreen';

jest.mock('../../../shared/components/ConfirmSheet', () => {
  const React = jest.requireActual('react');
  const { Pressable } = jest.requireActual('react-native');
  return { ConfirmSheet: ({ open, onConfirm, testID }: { open: boolean; onConfirm: () => void; testID: string }) => open ? React.createElement(Pressable, { testID: `${testID}-confirm`, onPress: onConfirm }) : null };
});

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
  it('prioritizes action and appointments and keeps terminal history collapsed', async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const pending = { ...BOOKING, id: 'pending-booking', status: 'pending' as const, date: '2099-09-25' };
    const todaysAppointment = { ...BOOKING, id: 'today-booking', status: 'accepted' as const, date: today };
    const cancelled = { ...BOOKING, id: 'history-booking', status: 'cancelled' as const, date: '2025-01-01' };
    const expectedSections = buildRequestSections([BOOKING, cancelled, todaysAppointment, pending], today);
    expect(expectedSections.map((section) => section.key)).toEqual([
      'needs-action',
      'today',
      'upcoming',
      'history',
    ]);
    expect(expectedSections[3].data).toHaveLength(1);
    mockFetchRequests.mockResolvedValueOnce({
      status: 'ok',
      bookings: [BOOKING, cancelled, todaysAppointment, pending],
      servicesById: new Map([[SERVICE.id, SERVICE]]),
      counterpartsByBookingId: new Map(),
    });

    await render(<RequestsScreen />);

    expect(screen.getByTestId('barber-requests-section-needs-action')).toBeTruthy();
    expect(screen.getByTestId('barber-requests-section-today')).toBeTruthy();
    expect(screen.getByTestId('barber-requests-section-upcoming')).toBeTruthy();
    expect(screen.getByTestId('barber-requests-row-pending-booking')).toBeTruthy();
    expect(screen.queryByTestId('barber-requests-row-history-booking')).toBeNull();

    await fireEvent.press(screen.getByTestId('barber-requests-history-toggle'));
    expect(screen.getByTestId('barber-requests-history-toggle').props.accessibilityState.expanded).toBe(true);
  });

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

  it('keeps cancellation in details and requires confirmation before sending', async () => {
    jest.mocked(cancelBookingAsBarber).mockResolvedValue({ status: 'ok', booking: { ...BOOKING, status: 'cancelled' } });
    await render(<RequestsScreen />);
    await waitFor(() => expect(screen.getByTestId('barber-requests-open-booking-2')).toBeTruthy());
    expect(screen.queryByTestId('request-cancel-booking-2')).toBeNull();
    await fireEvent.press(screen.getByTestId('barber-requests-open-booking-2'));
    await fireEvent.press(screen.getByTestId('request-cancel-booking-2'));
    expect(screen.queryByTestId('booking-details')).toBeNull();
    expect(cancelBookingAsBarber).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('barber-request-confirm-confirm'));
    await waitFor(() => expect(cancelBookingAsBarber).toHaveBeenCalledWith('booking-2'));
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
    expect(screen.queryByTestId('request-cancel-booking-2')).toBeNull();
    await fireEvent.press(screen.getByTestId('barber-requests-open-booking-2'));
    expect(screen.getByTestId('booking-details')).toBeTruthy();
    expect(screen.getByTestId('request-cancel-booking-2')).toBeTruthy();
    expect(screen.getByTestId('request-complete-booking-2')).toBeTruthy();
  });
});
