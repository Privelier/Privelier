import { renderHook, waitFor } from '@testing-library/react-native';
import { listBarberAvailability, listBarberBusySlotsRange, listBarberDaysOff } from '../../availabilityData';
import { useBookingSlots } from '../useBookingSlots';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return { useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) };
});
jest.mock('../../availabilityData', () => ({
  listBarberAvailability: jest.fn(),
  listBarberBusySlots: jest.fn(),
  listBarberBusySlotsRange: jest.fn(),
  listBarberDaysOff: jest.fn(),
}));

function isoInDays(days: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const open = isoInDays(3);
const closed = isoInDays(4);

beforeEach(() => {
  const dow = new Date(`${open}T00:00:00`).getDay();
  jest.mocked(listBarberAvailability).mockResolvedValue({
    status: 'ok',
    windows: [{ day_of_week: dow, specific_date: null, start_time: '09:00', end_time: '12:00' }],
  } as never);
  jest.mocked(listBarberBusySlotsRange).mockResolvedValue({ status: 'ok', byDate: new Map() } as never);
  jest.mocked(listBarberDaysOff).mockResolvedValue(new Set());
});

it('preselects the day picked on the profile when it has open times', async () => {
  const { result } = await renderHook(() => useBookingSlots('barber-1', 30, open));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.selection).toEqual({ date: open, time: null });
});

it('preselects nothing when the picked day has no time for this service', async () => {
  const { result } = await renderHook(() => useBookingSlots('barber-1', 30, closed));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.selection).toEqual({ date: null, time: null });
});
