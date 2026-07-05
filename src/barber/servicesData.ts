/**
 * Barber services data layer (build-order step 7-8).
 *
 * Writes rely entirely on RLS (`services_write_own`: barber_id = auth.uid()
 * AND has_role('barber')) for authorization — this module does not
 * re-implement auth checks. An RLS rejection (e.g. a non-barber, or a
 * barber_id that is not the caller's own) comes back as a clean mapped
 * 'forbidden' failure, never a raw Postgrest error object.
 *
 * No schema changes, no overlap/slot-computation logic, no uniqueness
 * enforcement on service name — all explicitly deferred per the Stage 2
 * architect review.
 */
import { supabase } from '../../lib/supabase';
import type { ServiceRow } from '../types';
import { mapPostgrestError } from './errors';
import type {
  CreateServiceInput,
  CreateServiceResult,
  DeleteServiceResult,
  ListServicesResult,
  ServicePatch,
  UpdateServiceResult,
} from './types';

/** All services owned by the given barber. Public read (RLS: select_all). */
export async function listOwnServices(barberId: string): Promise<ListServicesResult> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('barber_id', barberId)
    .order('name', { ascending: true });

  if (error) return mapPostgrestError('listOwnServices', error);
  return { status: 'ok', services: (data as ServiceRow[]) ?? [] };
}

/**
 * Insert a service row. RLS requires barberId to be the caller's own id and
 * the caller to hold the barber role — a mismatch surfaces as 'forbidden',
 * an out-of-range price/duration as 'invalid_input'.
 */
export async function createService(input: CreateServiceInput): Promise<CreateServiceResult> {
  const { data, error } = await supabase
    .from('services')
    .insert({
      barber_id: input.barberId,
      name: input.name,
      price: input.price,
      duration_minutes: input.durationMinutes,
    })
    .select()
    .single();

  if (error) return mapPostgrestError('createService', error);
  return { status: 'ok', service: data as ServiceRow };
}

/**
 * Update only the fields present in `patch`. Returns 'not_found' if no row
 * matched (either the id does not exist, or RLS hid a row that is not the
 * caller's own — the two are indistinguishable by design).
 */
export async function updateService(
  serviceId: string,
  patch: ServicePatch
): Promise<UpdateServiceResult> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.price !== undefined) update.price = patch.price;
  if (patch.durationMinutes !== undefined) update.duration_minutes = patch.durationMinutes;

  const { data, error } = await supabase
    .from('services')
    .update(update)
    .eq('id', serviceId)
    .select()
    .maybeSingle();

  if (error) return mapPostgrestError('updateService', error);
  if (!data) return { status: 'not_found' };
  return { status: 'ok', service: data as ServiceRow };
}

/** Delete a service row. Returns 'not_found' under the same rule as update. */
export async function deleteService(serviceId: string): Promise<DeleteServiceResult> {
  const { data, error } = await supabase
    .from('services')
    .delete()
    .eq('id', serviceId)
    .select('id')
    .maybeSingle();

  if (error) return mapPostgrestError('deleteService', error);
  if (!data) return { status: 'not_found' };
  return { status: 'ok' };
}
