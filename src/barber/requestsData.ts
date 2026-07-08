/**
 * Barber incoming-requests data layer (Requests tab of the UI rebuild).
 *
 * Read-only: accept/reject/complete status transitions are build-order
 * step 13-14 (with Realtime) and do NOT live here. Authorization is RLS
 * end to end — `bookings_select_participants` returns only rows where the
 * caller is a participant, so the plain select needs no user-id filter.
 *
 * KNOWN GAP (deliberately not worked around): `users` RLS is own-row-only,
 * so a barber cannot read a booking customer's name — there is no
 * counterpart-identity read path yet. The screen leads with the service
 * name instead. Adding that path is a schema-architect decision tracked
 * for step 13-14 in CLAUDE.md; do not weaken users RLS from the client.
 *
 * Service enrichment reads the barber's own services (always visible to
 * their owner), keyed by id for the cards.
 */
import { supabase } from '../../lib/supabase';
import type { BookingRow, ServiceRow } from '../types';
import { mapPostgrestError } from './errors';
import type { OwnRequestsViewResult } from './types';

/** The signed-in barber's bookings, soonest slot first, plus own-service lookup. */
export async function fetchOwnRequestsView(): Promise<OwnRequestsViewResult> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) return mapPostgrestError('fetchOwnRequestsView', error);
  const bookings = (data as BookingRow[]) ?? [];

  const servicesById = new Map<string, ServiceRow>();
  if (bookings.length > 0) {
    const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
    const servicesResult = await supabase.from('services').select('*').in('id', serviceIds);
    for (const row of (servicesResult.data as ServiceRow[]) ?? []) {
      servicesById.set(row.id, row);
    }
  }

  return { status: 'ok', bookings, servicesById };
}
