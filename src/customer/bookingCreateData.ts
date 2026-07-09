/**
 * Booking creation (build-order step 11-12). Kept separate from the
 * existing read-only src/customer/bookingsData.ts, whose own header
 * comment explicitly says creating bookings does NOT live there.
 *
 * `price` and `status` are deliberately omitted from the insert payload:
 * - `price` is stamped server-side by a BEFORE INSERT trigger
 *   (migration 0009) that looks up services.price by service_id and
 *   unconditionally overwrites it — sending any price from the client
 *   would be pointless (overwritten) and is a hard "never do this" per the
 *   schema's own "price is a snapshot, never read live from SERVICES" rule.
 * - `status` defaults to 'pending' via the column default, and
 *   bookings_insert_customer's RLS check already requires status = 'pending'
 *   on insert, so there is nothing for the client to set.
 *
 * Authorization is RLS's job: bookings_insert_customer requires
 * customer_id = auth.uid() and the caller to hold the customer role, so
 * customer_id is read from the current session here rather than accepted
 * as a caller-supplied parameter (a caller-supplied value could otherwise
 * be spoofed and would simply be rejected by RLS, which is a worse UX than
 * catching "no session" before ever hitting the network).
 *
 * The uq_bookings_barber_slot_active partial unique index (migration 0009)
 * is the authoritative double-booking guard: a Postgres 23505 here means a
 * different customer just took this exact barber/date/time slot, and must
 * surface as a real, user-facing conflict — NOT the "23505-as-idempotent-
 * success" pattern used for auth provisioning retries (see
 * src/auth/authService.ts), which applies only when the same actor's own
 * retried request races itself.
 */
import { supabase } from '../../lib/supabase';
import type { BookingRow } from '../types';
import { UNIQUE_VIOLATION, failure, logCustomerDataError, mapPostgrestError } from './errors';
import type { InsertBookingResult } from './types';

export async function insertBooking(input: {
  barberId: string;
  serviceId: string;
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:MM:SS'
  location: string;
}): Promise<InsertBookingResult> {
  const location = input.location.trim();
  if (!location) return failure('invalid_input');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    logCustomerDataError('insertBooking.getUser', userError);
    return failure('unknown');
  }
  const customerId = userData.user?.id;
  if (!customerId) return failure('forbidden');

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: customerId,
      barber_id: input.barberId,
      service_id: input.serviceId,
      date: input.date,
      time: input.time,
      location,
    })
    .select()
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: 'conflict' };
    return mapPostgrestError('insertBooking', error);
  }
  return { status: 'ok', booking: data as BookingRow };
}
