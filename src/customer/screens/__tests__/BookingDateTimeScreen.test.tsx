import { act, render, screen, waitFor } from '@testing-library/react-native';
import { listBarberAvailability, listBarberBusySlots, listBarberBusySlotsRange } from '../../availabilityData';
import BookingDateTimeScreen from '../BookingDateTimeScreen';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return { useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]) };
});
jest.mock('../../availabilityData', () => ({
  listBarberAvailability: jest.fn(),
  listBarberBusySlots: jest.fn(),
  listBarberBusySlotsRange: jest.fn(),
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
  jest.mocked(listBarberBusySlotsRange).mockReset();
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

const WEDNESDAY_WINDOW = {
  status: 'ok',
  windows: [{ id: 'w1', barber_id: 'barber-1', day_of_week: 3, specific_date: null, start_time: '10:00:00', end_time: '12:00:00' }],
} as never;

it('reads every busy interval for the lookahead in one range request', async () => {
  jest.useFakeTimers({ now: new Date(2030, 0, 7, 8, 0) }); // Monday 08:00 local
  try {
    jest.mocked(listBarberAvailability).mockResolvedValue(WEDNESDAY_WINDOW);
    jest.mocked(listBarberBusySlotsRange).mockResolvedValue({
      status: 'ok',
      byDate: new Map([['2030-01-09', [{ startTime: '10:00:00', durationMinutes: 30 }]]]),
    });

    await render(<BookingDateTimeScreen route={route as never} navigation={navigation as never} />);
    await waitFor(() => expect(screen.queryByTestId('customer-booking-datetime-loading')).toBeNull());

    expect(listBarberBusySlotsRange).toHaveBeenCalledTimes(1);
    expect(listBarberBusySlotsRange).toHaveBeenCalledWith('barber-1', '2030-01-07', '2030-01-20');
    expect(listBarberBusySlots).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

it('falls back to per-date reads, only for slot-bearing dates, when the range read fails', async () => {
  jest.useFakeTimers({ now: new Date(2030, 0, 7, 8, 0) });
  try {
    jest.mocked(listBarberAvailability).mockResolvedValue(WEDNESDAY_WINDOW);
    jest.mocked(listBarberBusySlotsRange).mockResolvedValue({
      status: 'error', code: 'unknown', message: 'x', retryable: false,
    });
    jest.mocked(listBarberBusySlots).mockResolvedValue({ status: 'ok', busy: [] });

    await render(<BookingDateTimeScreen route={route as never} navigation={navigation as never} />);
    await waitFor(() => expect(screen.queryByTestId('customer-booking-datetime-loading')).toBeNull());

    expect(jest.mocked(listBarberBusySlots).mock.calls.map(([, date]) => date)).toEqual(['2030-01-09', '2030-01-16']);
  } finally {
    jest.useRealTimers();
  }
});
