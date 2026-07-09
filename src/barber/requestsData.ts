/**
 * Barber incoming-requests data layer (Requests tab).
 *
 * Read path (`fetchOwnRequestsView`) and the four status-transition mutations
 * (accept / reject / complete / cancel) both rely on RLS end to end:
 * `bookings_select_participants` returns only rows where the caller is a
 * participant, and `bookings_update_participants` gates the writes — so no
 * query here carries an explicit user-id filter, and none re-implements
 * authorization client-side.
 *
 * The actor-aware transition trigger (migration 0011) is the authority on
 * WHICH transition each actor may make (only the barber may accept/reject/
 * complete; either participant may cancel an accepted booking). This module
 * does NOT re-check that — it issues the `update ... set status` and surfaces
 * a trigger rejection (illegal shape / wrong actor) as a clean
 * 'transition_rejected' failure via mapPostgrestError. No realtime code lives
 * here; the customer-side live status update is a separate concern.
 *
 * Counterpart identity (the customer's name/photo) is resolved via the
 * `get_booking_counterparts` RPC (migration 0012) — a SECURITY DEFINER
 * function that exposes only the other participant's id/name/profile_image,
 * without widening the own-row-only `users` RLS. It is best-effort: an RPC
 * failure degrades to an empty map and the screen keeps its service-name
 * fallback.
 *
 * Service enrichment reads the barber's own services (always visible to
 * their owner), keyed by id for the cards.
 */
import { supabase } from '../../lib/supabase';
import type { BookingRow, ServiceRow } from '../types';
import { mapPostgrestError } from './errors';
import type {
  BookingCounterpart,
  OwnRequestsViewResult,
  TransitionBookingResult,
} from './types';

/** PostgREST code returned by `.single()` when the update matched no row. */
const NO_ROWS = 'PGRST116';

/** Row shape returned by the get_booking_counterparts RPC. */
interface CounterpartRpcRow extends BookingCounterpart {
  booking_id: string;
}

/**
 * The signed-in barber's bookings, soonest slot first, plus an own-service
 * lookup and a best-effort counterpart-identity map. The bookings read
 * failing fails the whole call; the service and counterpart reads degrade to
 * empty maps instead.
 */
export async function fetchOwnRequestsView(): Promise<OwnRequestsViewResult> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) return mapPostgrestError('fetchOwnRequestsView', error);
  const bookings = (data as BookingRow[]) ?? [];

  const servicesById = new Map<string, ServiceRow>();
  const counterpartsByBookingId = new Map<string, BookingCounterpart>();

  if (bookings.length > 0) {
    const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
    const bookingIds = bookings.map((b) => b.id);

    const [servicesResult, counterpartsResult] = await Promise.all([
      supabase.from('services').select('*').in('id', serviceIds),
      supabase.rpc('get_booking_counterparts', { p_booking_ids: bookingIds }),
    ]);

    for (const row of (servicesResult.data as ServiceRow[]) ?? []) {
      servicesById.set(row.id, row);
    }

    // Best-effort: a counterparts RPC failure leaves the map empty and the
    // screen falls back to the service name; it never fails the whole view.
    if (counterpartsResult.error) {
      mapPostgrestError('fetchOwnRequestsView.counterparts', counterpartsResult.error);
    } else {
      for (const row of (counterpartsResult.data as CounterpartRpcRow[]) ?? []) {
        counterpartsByBookingId.set(row.booking_id, {
          id: row.id,
          name: row.name,
          profile_image: row.profile_image,
        });
      }
    }
  }

  return { status: 'ok', bookings, servicesById, counterpartsByBookingId };
}

/**
 * Shared UPDATE for every barber status transition. RLS + the actor-aware
 * trigger (migration 0011) do all the authorization; this only issues the
 * write and shapes the result. `.select().single()` returns the new row for
 * optimistic reconciliation. A trigger rejection (illegal transition / wrong
 * actor) comes back as Postgres P0001 and is mapped to 'transition_rejected';
 * a no-visible-row update (PGRST116) maps to 'not_found'.
 */
async function transitionBooking(
  context: string,
  bookingId: string,
  status: BookingRow['status']
): Promise<TransitionBookingResult> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) {
    if (error.code === NO_ROWS) return { status: 'not_found' };
    return mapPostgrestError(context, error);
  }
  return { status: 'ok', booking: data as BookingRow };
}

/** Barber accepts a pending booking (pending -> accepted). */
export async function acceptBooking(bookingId: string): Promise<TransitionBookingResult> {
  return transitionBooking('acceptBooking', bookingId, 'accepted');
}

/** Barber rejects a pending booking (pending -> rejected). */
export async function rejectBooking(bookingId: string): Promise<TransitionBookingResult> {
  return transitionBooking('rejectBooking', bookingId, 'rejected');
}

/** Barber marks an accepted booking done (accepted -> completed). */
export async function completeBooking(bookingId: string): Promise<TransitionBookingResult> {
  return transitionBooking('completeBooking', bookingId, 'completed');
}

/** Barber cancels an accepted booking (accepted -> cancelled). */
export async function cancelBookingAsBarber(bookingId: string): Promise<TransitionBookingResult> {
  return transitionBooking('cancelBookingAsBarber', bookingId, 'cancelled');
}
