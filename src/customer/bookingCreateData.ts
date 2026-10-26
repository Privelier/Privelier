/**
 * Booking creation through the create_booking RPC (migration 0054).
 *
 * The server owns every invariant: the customer is auth.uid(), price and
 * duration are stamped from the service row, the slot trigger refuses past,
 * unavailable or overlapping times, and an exclusion constraint makes
 * overlapping active bookings impossible even under concurrent requests.
 * The caller supplies one idempotency key per booking attempt, so a double
 * tap or a retry after a lost response returns the first booking instead of
 * creating a second one.
 */
import { supabase } from '../../lib/supabase';
import type { BookingRow } from '../types';
import { failure, logCustomerDataError, mapPostgrestError } from './errors';
import type { InsertBookingResult } from './types';

/** validate_booking_slot's RAISE (migrations 0024/0025). */
const RAISE_EXCEPTION = 'P0001';
/** bookings_no_overlapping_active_slot lost a concurrent race (0054). */
const EXCLUSION_VIOLATION = '23P01';
/** The service is gone or its barber is no longer approved. */
const NO_DATA_FOUND = 'P0002';
/** Barber unavailable on that date (0046). */
const DAY_OFF = 'PA003';
/** enforce_pending_booking_cap (0048). */
const PENDING_CAP = 'PA004';

/**
 * The slot trigger has no custom SQLSTATE for its three refusals, so the
 * message text is the only discriminator; an unrecognized P0001 falls
 * through to the generic mapper.
 */
function classifySlotRejection(error: {
  code?: string | null;
  message?: string | null;
}): 'conflict' | 'slot_unavailable' | null {
  if (error.code === EXCLUSION_VIOLATION) return 'conflict';
  if (error.code === DAY_OFF || error.code === NO_DATA_FOUND) return 'slot_unavailable';
  if (error.code !== RAISE_EXCEPTION) return null;
  const message = (error.message ?? '').toLowerCase();
  if (message.includes('overlaps an existing active booking')) return 'conflict';
  if (message.includes('must be in the future') || message.includes('outside the barber')) {
    return 'slot_unavailable';
  }
  return null;
}

export async function insertBooking(input: {
  serviceId: string;
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:MM:SS'
  location: string;
  /** Geocoded destination (Photon), when the address could be placed. */
  coordinates?: { latitude: number; longitude: number } | null;
  /** One key per booking attempt; reuse it when retrying that attempt. */
  idempotencyKey: string;
}): Promise<InsertBookingResult> {
  const location = input.location.trim();
  if (!location) return failure('invalid_input');

  const { data, error } = await supabase.rpc('create_booking', {
    p_service_id: input.serviceId,
    p_date: input.date,
    p_time: input.time,
    p_location: location,
    p_idempotency_key: input.idempotencyKey,
    p_latitude: input.coordinates?.latitude,
    p_longitude: input.coordinates?.longitude,
  });

  if (error) {
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
