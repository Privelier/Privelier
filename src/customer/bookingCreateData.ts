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
 * Double-booking is guarded by validate_booking_slot (migrations 0024/0025,
 * duration-aware overlap under an advisory lock) and the older
 * uq_bookings_barber_slot_active index (migration 0009). Either rejection
 * means a different customer just took an overlapping slot, and must
 * surface as a real, user-facing conflict — NOT the "23505-as-idempotent-
 * success" pattern used for auth provisioning retries (see
 * src/auth/authService.ts), which applies only when the same actor's own
 * retried request races itself.
 */
import { supabase } from '../../lib/supabase';
import type { BookingRow } from '../types';
import { UNIQUE_VIOLATION, failure, logCustomerDataError, mapPostgrestError } from './errors';
import type { InsertBookingResult } from './types';

/** Postgres raise_exception — validate_booking_slot (migrations 0024/0025). */
const RAISE_EXCEPTION = 'P0001';
/** enforce_pending_booking_cap (migration 0048). */
const PENDING_CAP = 'PA004';

/**
 * validate_booking_slot serializes same-barber/day writes with an advisory
 * lock, so a lost race now surfaces as its overlap RAISE (P0001) before the
 * unique index can fire. Its other two RAISEs mean the chosen slot went stale
 * (time passed, or the barber changed availability). The trigger has no
 * custom SQLSTATEs yet, so the message text is the only discriminator; an
 * unrecognized P0001 still falls through to the generic mapper.
 */
function classifySlotRejection(error: {
  code?: string | null;
  message?: string | null;
}): 'conflict' | 'slot_unavailable' | null {
  // Day off (migration 0046) has its own SQLSTATE.
  if (error.code === 'PA003') return 'slot_unavailable';
  if (error.code !== RAISE_EXCEPTION) return null;
  const message = (error.message ?? '').toLowerCase();
  if (message.includes('overlaps an existing active booking')) return 'conflict';
  if (message.includes('must be in the future') || message.includes('outside the barber')) {
    return 'slot_unavailable';
  }
  return null;
}

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
    // Open-request cap (migration 0048): 5 pending in total, 2 per barber.
    if (error.code === PENDING_CAP) return failure('too_many_pending');
    const slotOutcome = classifySlotRejection(error);
    if (slotOutcome) {
      logCustomerDataError('insertBooking.slot', error);
      return { status: slotOutcome };
    }
    return mapPostgrestError('insertBooking', error);
  }
  return { status: 'ok', booking: data as BookingRow };
}
