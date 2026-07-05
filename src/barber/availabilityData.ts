/**
 * Barber availability data layer (build-order step 7-8).
 *
 * Writes rely entirely on RLS (`availability_write_own`: barber_id =
 * auth.uid() AND has_role('barber')) for authorization — this module does
 * not re-implement auth checks. An RLS rejection comes back as a clean
 * mapped 'forbidden' failure, and a CHECK-constraint violation
 * (chk_availability_day_or_date: exactly one of day_of_week/specific_date;
 * chk_availability_time_order: start_time < end_time) comes back as a clean
 * mapped 'invalid_input' failure — never a raw Postgres constraint message.
 *
 * No schema changes, no overlap-prevention logic — explicitly deferred to
 * the booking-flow pipeline run per the Stage 2 architect review.
 */
import { supabase } from '../../lib/supabase';
import type { AvailabilityRow } from '../types';
import { mapPostgrestError } from './errors';
import type {
  AvailabilityPatch,
  CreateAvailabilityInput,
  CreateAvailabilityResult,
  DeleteAvailabilityResult,
  ListAvailabilityResult,
  UpdateAvailabilityResult,
} from './types';

/** All availability windows owned by the given barber. Public read (RLS: select_all). */
export async function listOwnAvailability(barberId: string): Promise<ListAvailabilityResult> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('barber_id', barberId)
    .order('day_of_week', { ascending: true, nullsFirst: false })
    .order('specific_date', { ascending: true, nullsFirst: false })
    .order('start_time', { ascending: true });

  if (error) return mapPostgrestError('listOwnAvailability', error);
  return { status: 'ok', windows: (data as AvailabilityRow[]) ?? [] };
}

/**
 * Insert an availability window. RLS requires barberId to be the caller's
 * own id and the caller to hold the barber role — a mismatch surfaces as
 * 'forbidden'. Providing both (or neither) of dayOfWeek/specificDate, or a
 * startTime not before endTime, surfaces as 'invalid_input' via the DB's
 * CHECK constraints.
 */
export async function createAvailabilityWindow(
  input: CreateAvailabilityInput
): Promise<CreateAvailabilityResult> {
  const { data, error } = await supabase
    .from('availability')
    .insert({
      barber_id: input.barberId,
      day_of_week: input.dayOfWeek ?? null,
      specific_date: input.specificDate ?? null,
      start_time: input.startTime,
      end_time: input.endTime,
    })
    .select()
    .single();

  if (error) return mapPostgrestError('createAvailabilityWindow', error);
  return { status: 'ok', window: data as AvailabilityRow };
}

/**
 * Update only the fields present in `patch`. Returns 'not_found' if no row
 * matched (either the id does not exist, or RLS hid a row that is not the
 * caller's own — the two are indistinguishable by design). A patch that
 * leaves the row violating either CHECK constraint surfaces as
 * 'invalid_input'.
 */
export async function updateAvailabilityWindow(
  id: string,
  patch: AvailabilityPatch
): Promise<UpdateAvailabilityResult> {
  const update: Record<string, unknown> = {};
  if (patch.dayOfWeek !== undefined) update.day_of_week = patch.dayOfWeek;
  if (patch.specificDate !== undefined) update.specific_date = patch.specificDate;
  if (patch.startTime !== undefined) update.start_time = patch.startTime;
  if (patch.endTime !== undefined) update.end_time = patch.endTime;

  const { data, error } = await supabase
    .from('availability')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return mapPostgrestError('updateAvailabilityWindow', error);
  if (!data) return { status: 'not_found' };
  return { status: 'ok', window: data as AvailabilityRow };
}

/** Delete an availability window. Returns 'not_found' under the same rule as update. */
export async function deleteAvailabilityWindow(id: string): Promise<DeleteAvailabilityResult> {
  const { data, error } = await supabase
    .from('availability')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return mapPostgrestError('deleteAvailabilityWindow', error);
  if (!data) return { status: 'not_found' };
  return { status: 'ok' };
}
