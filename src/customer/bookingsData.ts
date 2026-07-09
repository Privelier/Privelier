/**
 * Customer bookings data layer (Bookings tab of the UI rebuild).
 *
 * Reads only — creating bookings is build-order step 11-12 and does NOT
 * live here. Authorization is RLS's job end to end:
 * - `bookings` (`bookings_select_participants`): a caller only ever
 *   receives rows where they are the customer or the barber, so the plain
 *   select below needs no explicit user-id filter.
 * - `barber_directory` / `services` enrichment reads are the same surfaces
 *   the Discover screen already uses. A barber who has since lost approval
 *   disappears from both (view WHERE clause / migration 0007), so
 *   enrichment is best-effort by design: the screen renders calm fallbacks
 *   for a booking whose barber/service can no longer be read.
 */
import { supabase } from '../../lib/supabase';
import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../types';
import { mapPostgrestError } from './errors';
import type { CancelBookingResult, OwnBookingsViewResult } from './types';

/** PostgREST code returned by `.single()` when the update matched no row. */
const NO_ROWS = 'PGRST116';

/**
 * Pure split rule for the Upcoming/Past tabs: a booking is upcoming while
 * it can still happen — its slot is in the future AND it is still alive in
 * the state machine (pending or accepted). Everything else (done, declined,
 * cancelled, or simply expired without action) is past.
 */
export function isUpcomingBooking(booking: BookingRow, now: Date): boolean {
  if (booking.status !== 'pending' && booking.status !== 'accepted') return false;
  const slot = new Date(`${booking.date}T${booking.time}`);
  if (Number.isNaN(slot.getTime())) return false;
  return slot.getTime() >= now.getTime();
}

/**
 * The signed-in customer's bookings plus best-effort barber/service lookup
 * maps for rendering. The bookings read failing fails the whole call; the
 * two enrichment reads degrade to empty maps instead.
 */
export async function fetchOwnBookingsView(): Promise<OwnBookingsViewResult> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: false });

  if (error) return mapPostgrestError('fetchOwnBookingsView', error);
  const bookings = (data as BookingRow[]) ?? [];

  const barbersById = new Map<string, BarberDirectoryRow>();
  const servicesById = new Map<string, ServiceRow>();
  if (bookings.length > 0) {
    const barberIds = [...new Set(bookings.map((b) => b.barber_id))];
    const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
    const [barbersResult, servicesResult] = await Promise.all([
      supabase.from('barber_directory').select('*').in('id', barberIds),
      supabase.from('services').select('*').in('id', serviceIds),
    ]);
    for (const row of (barbersResult.data as BarberDirectoryRow[]) ?? []) {
      barbersById.set(row.id, row);
    }
    for (const row of (servicesResult.data as ServiceRow[]) ?? []) {
      servicesById.set(row.id, row);
    }
  }

  return { status: 'ok', bookings, barbersById, servicesById };
}

/**
 * Customer cancels their own booking (-> cancelled). This single mutation
 * covers BOTH transitions the actor-aware trigger (migration 0011) allows the
 * customer: pending -> cancelled (withdraw a request the barber has not yet
 * answered — a founder-approved 2026-07-09 transition) and accepted ->
 * cancelled (call off a confirmed booking). Authorization is entirely RLS +
 * that trigger; this issues the write and shapes the result. `.select()
 * .single()` returns the new row for optimistic reconciliation. A trigger
 * rejection (e.g. the booking is already completed/rejected) comes back as
 * Postgres P0001 and is mapped to 'transition_rejected'; a no-visible-row
 * update (PGRST116) maps to 'not_found'.
 */
export async function cancelBookingAsCustomer(bookingId: string): Promise<CancelBookingResult> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) {
    if (error.code === NO_ROWS) return { status: 'not_found' };
    return mapPostgrestError('cancelBookingAsCustomer', error);
  }
  return { status: 'ok', booking: data as BookingRow };
}
