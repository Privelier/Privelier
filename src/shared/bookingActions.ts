/**
 * Device actions for an accepted booking (Wave 5), shared by both apps.
 *
 * - Add to calendar opens the system "new event" sheet prefilled with the
 *   appointment (expo-calendar legacy dialog). The user confirms in the OS
 *   UI, so no calendar permission prompt is needed and nothing is written
 *   silently.
 * - Directions open the platform maps app at the booking address (barber
 *   app only; the customer is the destination).
 */
import { Linking, Platform } from 'react-native';
import * as Calendar from 'expo-calendar/legacy';
import type { BookingRow } from '../types';
import { bookingSlotStart } from './bookingTime';

export type DeviceActionResult = 'done' | 'cancelled' | 'unavailable';

/** Start/end of a booking as local Dates (null when the row is malformed). */
export function bookingWindow(booking: Pick<BookingRow, 'date' | 'time' | 'duration_minutes'>): { start: Date; end: Date } | null {
  const start = bookingSlotStart(booking);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + booking.duration_minutes * 60_000) };
}

export async function addBookingToCalendar(
  booking: Pick<BookingRow, 'date' | 'time' | 'duration_minutes' | 'location'>,
  title: string,
  notes?: string
): Promise<DeviceActionResult> {
  const window = bookingWindow(booking);
  if (!window) return 'unavailable';
  try {
    const result = await Calendar.createEventInCalendarAsync({
      title,
      startDate: window.start,
      endDate: window.end,
      location: booking.location,
      notes,
    });
    return result.action === 'canceled' ? 'cancelled' : 'done';
  } catch {
    return 'unavailable';
  }
}

/** Maps URL for an address: Apple Maps on iOS, a geo: query elsewhere. */
export function directionsUrl(address: string, platform: string = Platform.OS): string {
  const query = encodeURIComponent(address);
  return platform === 'ios' ? `https://maps.apple.com/?daddr=${query}` : `geo:0,0?q=${query}`;
}

export async function openDirections(address: string): Promise<DeviceActionResult> {
  try {
    await Linking.openURL(directionsUrl(address));
    return 'done';
  } catch {
    return 'unavailable';
  }
}
