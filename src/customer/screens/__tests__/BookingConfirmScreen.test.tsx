import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import BookingConfirmScreen from '../BookingConfirmScreen';
import { insertBooking } from '../../bookingCreateData';
import { haptics } from '../../../shared/haptics';

jest.mock('../../bookingCreateData', () => ({ insertBooking: jest.fn() }));
const mockFetchRoom = jest.fn();
jest.mock('../../inboxData', () => ({ fetchRoomForBooking: (...args: unknown[]) => mockFetchRoom(...args) }));
const mockShowToast = jest.fn();
jest.mock('../../../shared/components/ToastProvider', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../../../shared/haptics', () => ({
  haptics: { confirm: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../../../shared/components/PrimaryButton', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    PrimaryButton: ({ label, onPress, testID, disabled }: { label: string; onPress: () => void; testID: string; disabled?: boolean }) =>
      React.createElement(
        Pressable,
        { testID, onPress, disabled, accessibilityState: { disabled: !!disabled } },
        React.createElement(Text, null, label)
      ),
  };
});
jest.mock('../../../shared/components/ScreenBackHeader', () => ({ ScreenBackHeader: () => null }));
jest.mock('../../components/BookingStepIndicator', () => ({ BookingStepIndicator: () => null }));
const mockGeocode = jest.fn();
jest.mock('../../../shared/geocoding', () => ({ geocodeBestMatch: (...args: unknown[]) => mockGeocode(...args) }));
const mockAskPush = jest.fn();
jest.mock('../../../shared/push', () => ({ askForPushPermissionInContext: () => mockAskPush() }));
jest.mock('../../components/AddressPinPreview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { AddressPinPreview: ({ state }: { state: { status: string } }) => React.createElement(View, { testID: `pin-${state.status}` }) };
});
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { background: '#121214', surface: '#1B1B1E', border: '#333', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B' },
    fonts: { headingMedium: 'Playfair', body: 'Inter', bodyMedium: 'Inter' },
  }),
}));

const route = {
  params: {
    barberId: 'barber-1', barberName: 'Ada', barberImage: 'https://example.invalid/ada.jpg',
    service: { id: 'service-1', name: 'Haircut', price: 30, duration_minutes: 30 },
    date: '2026-09-28', time: '12:00:00', location: 'Main Street 1',
  },
};
const navigation = { goBack: jest.fn(), pop: jest.fn(), reset: jest.fn() };
const CREATED = {
  id: 'booking-1', customer_id: 'customer-1', barber_id: 'barber-1', service_id: 'service-1',
  date: '2026-09-28', time: '12:00:00', location: 'Main Street 1', price: 30,
  duration_minutes: 30, status: 'pending', created_at: '2026-09-01T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGeocode.mockResolvedValue(null);
  mockAskPush.mockResolvedValue(false);
});

it('confirms on tap and plays success feedback only after a real booking insert', async () => {
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'ok', booking: CREATED });
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
    time: '12:00:00', location: 'Main Street 1', coordinates: null,
  });
  // Push is offered in context — right after the request went out.
  expect(mockAskPush).toHaveBeenCalledTimes(1);
});

it('places the address with the street + city query and sends its coordinates with the booking', async () => {
  const candidate = { label: 'Main Street 1, Nürnberg', latitude: 49.45, longitude: 11.07 };
  mockGeocode.mockResolvedValue(candidate);
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'ok', booking: CREATED });
  const withQuery = { params: { ...route.params, location: 'Main Street 1, Flat 3, Nürnberg, ring twice', geocodeQuery: 'Main Street 1, Nürnberg' } };
  await render(<BookingConfirmScreen route={withQuery as never} navigation={navigation as never} />);

  await waitFor(() => expect(screen.getByTestId('pin-found')).toBeTruthy());
  expect(mockGeocode).toHaveBeenCalledWith('Main Street 1, Nürnberg');
  await fireEvent.press(screen.getByTestId('customer-booking-confirm-submit'));
  await waitFor(() => expect(screen.getByTestId('customer-booking-confirm-success')).toBeTruthy());
  expect(insertBooking).toHaveBeenCalledWith(expect.objectContaining({
    location: 'Main Street 1, Flat 3, Nürnberg, ring twice',
    coordinates: candidate,
  }));
});

it('never blocks booking when the address cannot be placed', async () => {
  mockGeocode.mockResolvedValue(null);
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'ok', booking: CREATED });
  await render(<BookingConfirmScreen route={route as never} navigation={navigation as never} />);
  await waitFor(() => expect(screen.getByTestId('pin-none')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('customer-booking-confirm-submit'));
  await waitFor(() => expect(screen.getByTestId('customer-booking-confirm-success')).toBeTruthy());
  expect(insertBooking).toHaveBeenCalledWith(expect.objectContaining({ coordinates: null }));
});

it('does not play success feedback when the slot conflicts', async () => {
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'conflict' });
  await render(<BookingConfirmScreen route={route as never} navigation={navigation as never} />);

  await fireEvent.press(screen.getByTestId('customer-booking-confirm-submit'));
  await waitFor(() => expect(screen.getByTestId('customer-booking-confirm-error')).toBeTruthy());
  expect(haptics.confirm).toHaveBeenCalledTimes(1);
  expect(haptics.success).not.toHaveBeenCalled();
});

it('offers another time instead of cancellation copy when a slot race is lost', async () => {
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'conflict' });
  await render(<BookingConfirmScreen route={route as never} navigation={navigation as never} />);

  await fireEvent.press(screen.getByTestId('customer-booking-confirm-submit'));
  await waitFor(() => expect(screen.getByTestId('customer-booking-confirm-pick-another-time')).toBeTruthy());
  expect(screen.queryByText(/can no longer be cancelled/)).toBeNull();
  expect(screen.getByText('That time was just booked by someone else. Pick another time.')).toBeTruthy();
  expect(haptics.warning).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('customer-booking-confirm-submit').props.accessibilityState).toMatchObject({ disabled: true });

  await fireEvent.press(screen.getByTestId('customer-booking-confirm-pick-another-time'));
  expect(navigation.pop).toHaveBeenCalledWith(2);
});

it('explains a stale slot and routes back to time selection', async () => {
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'slot_unavailable' });
  await render(<BookingConfirmScreen route={route as never} navigation={navigation as never} />);

  await fireEvent.press(screen.getByTestId('customer-booking-confirm-submit'));
  await waitFor(() => expect(screen.getByText('That time is no longer available. Pick another time.')).toBeTruthy());
  expect(screen.getByTestId('customer-booking-confirm-pick-another-time')).toBeTruthy();
  expect(haptics.success).not.toHaveBeenCalled();
});

it('sends exactly one booking request for two taps in the same tick', async () => {
  let resolveInsert: (value: unknown) => void = () => {};
  (insertBooking as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveInsert = resolve; }));
  await render(<BookingConfirmScreen route={route as never} navigation={navigation as never} />);

  const submit = screen.getByTestId('customer-booking-confirm-submit');
  await act(async () => {
    fireEvent.press(submit);
    fireEvent.press(submit);
  });
  expect(insertBooking).toHaveBeenCalledTimes(1);

  await act(async () => { resolveInsert({ status: 'ok', booking: CREATED }); });
  await waitFor(() => expect(screen.getByTestId('customer-booking-confirm-success')).toBeTruthy());
});

it('shows the real request timeline and opens the booking chat over Bookings', async () => {
  (insertBooking as jest.Mock).mockResolvedValue({ status: 'ok', booking: CREATED });
  const room = { id: 'room-1', booking_id: 'booking-1', customer_id: 'customer-1', barber_id: 'barber-1' };
  mockFetchRoom.mockResolvedValue({ status: 'ok', room });
  await render(<BookingConfirmScreen route={route as never} navigation={navigation as never} />);

  await fireEvent.press(screen.getByTestId('customer-booking-confirm-submit'));
  await waitFor(() => expect(screen.getByTestId('booking-details-timeline')).toBeTruthy());
  expect(screen.getByTestId('booking-details-timeline').props.accessibilityLabel).toBe(
    'Requested, done; Accepted, waiting; Completed, not yet'
  );

  await fireEvent.press(screen.getByTestId('customer-booking-confirm-message'));
  await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith({
    index: 1,
    routes: [
      { name: 'CustomerTabs', params: { screen: 'Bookings' } },
      {
        name: 'Conversation',
        params: expect.objectContaining({
          room,
          title: 'Ada',
          // Same header as a chat opened from Inbox: the barber's photo, not initials.
          counterpart: { id: 'barber-1', name: 'Ada', profile_image: 'https://example.invalid/ada.jpg' },
        }),
      },
    ],
  }));
  expect(mockFetchRoom).toHaveBeenCalledWith('booking-1');
});
