import { fireEvent, render, screen } from '@testing-library/react-native';
import { AvailabilityPreview } from '../barberProfile/AvailabilityPreview';
import { useBookingSlots } from '../../hooks/useBookingSlots';

jest.mock('../../hooks/useBookingSlots', () => ({ useBookingSlots: jest.fn() }));
jest.mock('../../../shared/motion', () => ({ Reveal: ({ children }: { children: unknown }) => children }));
jest.mock('../../../shared/components/GlassSurface', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { GlassSurface: ({ children, testID }: { children: unknown; testID?: string }) => React.createElement(View, { testID }, children) };
});

const dates = Array.from({ length: 14 }, (_, i) => `2026-11-${String(i + 2).padStart(2, '0')}`);

function slots(overrides: Partial<ReturnType<typeof useBookingSlots>>) {
  jest.mocked(useBookingSlots).mockReturnValue({
    dates,
    hasData: true,
    loading: false,
    error: null,
    nextAvailable: { date: '2026-11-04', time: '09:00:00' },
    disabledDates: new Set(dates.filter((d) => d !== '2026-11-04')),
    slotCounts: new Map([['2026-11-04', 3]]),
    ...overrides,
  } as never);
}

it('shows seven real days and hands a tapped open day to the profile', async () => {
  slots({});
  const onPickDate = jest.fn();
  await render(<AvailabilityPreview barberId="b1" durationMinutes={30} selectedDate={null} german={false} onPickDate={onPickDate} />);

  expect(useBookingSlots).toHaveBeenCalledWith('b1', 30);
  expect(screen.getByText('Available this week')).toBeTruthy();
  expect(screen.getByTestId('barber-profile-availability-next').props.children).toContain('Next free');
  expect(screen.queryByTestId('barber-profile-availability-day-7')).toBeNull();
  await fireEvent.press(screen.getByTestId('barber-profile-availability-day-2'));
  expect(onPickDate).toHaveBeenCalledWith('2026-11-04');
});

it('says so plainly when nothing is free', async () => {
  slots({ nextAvailable: null, disabledDates: new Set(dates), slotCounts: new Map() });
  await render(<AvailabilityPreview barberId="b1" durationMinutes={30} selectedDate={null} german={false} onPickDate={jest.fn()} />);
  expect(screen.getByTestId('barber-profile-availability-next').props.children).toBe('Nothing free in the next two weeks.');
});

it('stays hidden while loading or after a failed read', async () => {
  slots({ loading: true });
  await render(<AvailabilityPreview barberId="b1" durationMinutes={30} selectedDate={null} german={false} onPickDate={jest.fn()} />);
  expect(screen.queryByTestId('barber-profile-availability')).toBeNull();
});
