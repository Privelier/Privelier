import { fireEvent, render, screen } from '@testing-library/react-native';
import CalendarDateStrip from '../CalendarDateStrip';
import { haptics } from '../../../shared/haptics';

jest.mock('../../../shared/haptics', () => ({
  haptics: { selection: jest.fn(() => Promise.resolve()) },
}));

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B',
      surface: '#1B1B1E', border: '#444', onAccent: '#121214',
    },
    fonts: { headingMedium: 'Playfair', bodyMedium: 'Inter', bodySemiBold: 'Inter' },
  }),
}));

it('selects enabled dates with one light haptic and ignores disabled dates', async () => {
  const onSelectDate = jest.fn();
  await render(
    <CalendarDateStrip
      dates={['2026-09-26', '2026-09-27']}
      disabledDates={new Set(['2026-09-27'])}
      selectedDate={null}
      onSelectDate={onSelectDate}
      testIDPrefix="booking"
    />
  );

  await fireEvent.press(screen.getByTestId('booking-day-0'));
  expect(haptics.selection).toHaveBeenCalledTimes(1);
  expect(onSelectDate).toHaveBeenCalledWith('2026-09-26');
  expect(screen.getByTestId('booking-day-1').props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByTestId('booking-day-1'));
  expect(onSelectDate).toHaveBeenCalledTimes(1);
  expect(haptics.selection).toHaveBeenCalledTimes(1);
});
