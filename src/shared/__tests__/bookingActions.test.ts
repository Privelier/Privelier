import * as Calendar from 'expo-calendar/legacy';
import { addBookingToCalendar, bookingWindow, directionsUrl } from '../bookingActions';

jest.mock('expo-calendar/legacy', () => ({ createEventInCalendarAsync: jest.fn() }));

const booking = { date: '2030-01-09', time: '10:30:00', duration_minutes: 45, location: 'Main Street 12, Berlin' };

it('derives the local appointment window from date, time and the duration snapshot', () => {
  const window = bookingWindow(booking);
  expect(window?.start).toEqual(new Date(2030, 0, 9, 10, 30));
  expect(window?.end).toEqual(new Date(2030, 0, 9, 11, 15));
  expect(bookingWindow({ ...booking, date: 'nope' })).toBeNull();
});

it('opens the system event sheet prefilled, and reports a cancel truthfully', async () => {
  jest.mocked(Calendar.createEventInCalendarAsync).mockResolvedValueOnce({ action: 'saved', id: 'e1' } as never);
  await expect(addBookingToCalendar(booking, 'Skin fade · Ada')).resolves.toBe('done');
  expect(Calendar.createEventInCalendarAsync).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Skin fade · Ada', location: 'Main Street 12, Berlin', startDate: new Date(2030, 0, 9, 10, 30),
  }));

  jest.mocked(Calendar.createEventInCalendarAsync).mockResolvedValueOnce({ action: 'canceled', id: null } as never);
  await expect(addBookingToCalendar(booking, 'x')).resolves.toBe('cancelled');

  jest.mocked(Calendar.createEventInCalendarAsync).mockRejectedValueOnce(new Error('no calendar'));
  await expect(addBookingToCalendar(booking, 'x')).resolves.toBe('unavailable');
});

it('builds platform maps links with an encoded address', () => {
  expect(directionsUrl('Main Street 12, Berlin', 'ios')).toBe('https://maps.apple.com/?daddr=Main%20Street%2012%2C%20Berlin');
  expect(directionsUrl('Main Street 12, Berlin', 'android')).toBe('geo:0,0?q=Main%20Street%2012%2C%20Berlin');
});
