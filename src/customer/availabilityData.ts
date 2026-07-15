/**
 * Customer-facing availability/busy-slot reads for the booking flow
 * (build-order step 11-12). Does NOT reuse src/barber/availabilityData.ts's
 * listOwnAvailability — that one is self-scoped to the caller's own
 * barber_id under availability_write_own semantics and is the wrong tool
 * here; this module reads any barber's availability as a prospective
 * customer.
 *
 * - listBarberAvailability relies on the already-open availability_select_all
 *   RLS policy (using (true)) — any authenticated caller may read any
 *   barber's windows.
 * - listBarberBusySlots deliberately goes through the get_barber_busy_slots
 *   RPC (migration 0009), NOT a plain `.from('bookings')` select:
 *   bookings_select_participants scopes plain reads to rows where the
 *   caller is the customer or the barber, so a customer who has never
 *   booked with this barber before would see zero rows from a plain select
 *   even though other customers' pending/accepted bookings do occupy real
 *   slots. The RPC is SECURITY DEFINER and returns only
 *   (start_time, duration_minutes) — no customer-identifying or
 *   booking-content columns.
 */
import { supabase } from '../../lib/supabase';
import type { AvailabilityRow } from '../types';
import type { BusySlot } from '../shared/slots';
import { mapPostgrestError } from './errors';
import type { ListBarberAvailabilityResult, ListBusySlotsResult } from './types';

/** All availability windows for the given barber, unfiltered by date —
 * date/weekday filtering happens in deriveAvailableSlots (src/shared/slots.ts). */
export async function listBarberAvailability(
  barberId: string
): Promise<ListBarberAvailabilityResult> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('barber_id', barberId);

  if (error) return mapPostgrestError('listBarberAvailability', error);
  return { status: 'ok', windows: (data as AvailabilityRow[]) ?? [] };
}

/**
 * Batched availability read for a set of barbers (the Explore tab's
 * "Available today" chip — Run B, design condition C9's batched-read shape,
 * same pattern as discoveryData.listServicesForBarberIds). One query for the
 * whole visible list; every id a customer can hold comes from the approved
 * directory, so RLS-visible rows are exactly what comes back.
 */
export async function listAvailabilityForBarberIds(
  barberIds: string[]
): Promise<ListBarberAvailabilityResult> {
  if (barberIds.length === 0) return { status: 'ok', windows: [] };
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .in('barber_id', barberIds);

  if (error) return mapPostgrestError('listAvailabilityForBarberIds', error);
  return { status: 'ok', windows: (data as AvailabilityRow[]) ?? [] };
}

/** This barber's busy (pending/accepted) slots for one date, via the
 * get_barber_busy_slots RPC — see module header for why this cannot be a
 * plain table read. */
export async function listBarberBusySlots(
  barberId: string,
  date: string
): Promise<ListBusySlotsResult> {
  const { data, error } = await supabase.rpc('get_barber_busy_slots', {
    p_barber_id: barberId,
    p_date: date,
  });

  if (error) return mapPostgrestError('listBarberBusySlots', error);
  const rows = (data as { start_time: string; duration_minutes: number }[]) ?? [];
  const busy: BusySlot[] = rows.map((row) => ({
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
  }));
  return { status: 'ok', busy };
}
