import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DaysOffStrip } from '../DaysOffStrip';
import { listOwnDaysOff, setDayOff } from '../../availabilityData';

jest.mock('../../availabilityData', () => ({ listOwnDaysOff: jest.fn(), setDayOff: jest.fn() }));
jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../../shared/haptics', () => ({ haptics: { selection: jest.fn() } }));
const mockShowToast = jest.fn();
jest.mock('../../../shared/components/ToastProvider', () => ({ useToast: () => ({ showToast: mockShowToast }) }));

function key(offset: number) {
  const t = new Date();
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

beforeEach(() => jest.clearAllMocks());

it('shows saved days off and toggles a day optimistically', async () => {
  jest.mocked(listOwnDaysOff).mockResolvedValue(new Set([key(3)]));
  jest.mocked(setDayOff).mockResolvedValue(true);
  await render(<DaysOffStrip barberId="barber-1" />);

  await waitFor(() => expect(screen.getByTestId(`barber-availability-day-off-${key(3)}`).props.accessibilityState).toMatchObject({ checked: true }));
  await fireEvent.press(screen.getByTestId(`barber-availability-day-off-${key(5)}`));
  expect(screen.getByTestId(`barber-availability-day-off-${key(5)}`).props.accessibilityState).toMatchObject({ checked: true });
  expect(setDayOff).toHaveBeenCalledWith('barber-1', key(5), true);
});

it('rolls back and explains when saving a day off fails', async () => {
  jest.mocked(listOwnDaysOff).mockResolvedValue(new Set());
  jest.mocked(setDayOff).mockResolvedValue(false);
  await render(<DaysOffStrip barberId="barber-1" />);
  await waitFor(() => expect(screen.getByTestId(`barber-availability-day-off-${key(1)}`).props.accessibilityState).toMatchObject({ disabled: false }));

  await fireEvent.press(screen.getByTestId(`barber-availability-day-off-${key(1)}`));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
  expect(screen.getByTestId(`barber-availability-day-off-${key(1)}`).props.accessibilityState).toMatchObject({ checked: false });
});
