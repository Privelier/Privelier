/**
 * Display context for the live-trip screen when it is opened from a push or
 * the notification feed, which only know the booking id. Three small reads
 * under the customer's existing RLS (own booking, approved barber directory,
 * services); a list screen that already has the data passes it instead.
 */
import { supabase } from '../../lib/supabase';
import { formatBookingWhen } from '../shared/format';
import { devWarn } from '../shared/devLog';

export interface LiveTripContext {
  bookingId: string;
  barberId: string;
  barberName: string;
  barberImage: string | null;
  address: string;
  whenText: string;
  serviceName: string | null;
}

export async function fetchLiveTripContext(bookingId: string): Promise<LiveTripContext | null> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, barber_id, service_id, date, time, location')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !booking) {
    if (error) devWarn('[liveTripData] booking', error);
    return null;
  }
  // The barber deleted their account: there is no trip to follow.
  if (!booking.barber_id) return null;
  const [barber, service] = await Promise.all([
    supabase.from('barber_directory').select('id, name, profile_image').eq('id', booking.barber_id).maybeSingle(),
    booking.service_id ? supabase.from('services').select('name').eq('id', booking.service_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    bookingId,
    barberId: booking.barber_id as string,
    barberName: (barber.data?.name as string | undefined) ?? 'Barber',
    barberImage: (barber.data?.profile_image as string | null | undefined) ?? null,
    address: booking.location as string,
    whenText: formatBookingWhen(booking.date as string, booking.time as string),
    serviceName: (service.data?.name as string | undefined) ?? null,
  };
}
