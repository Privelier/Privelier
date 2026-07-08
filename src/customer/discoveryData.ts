/**
 * Customer discovery data layer (build-order step 9-10).
 *
 * Reads rely entirely on RLS/the view's own WHERE clause for authorization:
 * - `barber_directory` (migration 0006) is pre-filtered to
 *   `verification_status = 'approved'` and grants SELECT to `authenticated`
 *   only — an unauthenticated (anon) caller gets zero table access, and any
 *   authenticated caller may read any row (there is no per-row ownership
 *   concept for discovery). This module does not re-implement that gate.
 * - `services` (migration 0007) now allows any authenticated caller to
 *   `select * from services where barber_id = $1` as long as that barber_id
 *   is either the caller's own or belongs to an approved barber — so the
 *   plain query below is safe to run against any barberId a customer might
 *   navigate to.
 *
 * No schema changes, no availability-fetching (out of scope for this
 * feature per the backlog — availability consumption belongs to the
 * build-order step 11-12 booking flow), no screens.
 */
import { supabase } from '../../lib/supabase';
import type { BarberDirectoryRow, ServiceRow } from '../types';
import { mapPostgrestError } from './errors';
import type {
  GetBarberProfileResult,
  ListBarbersResult,
  ListServicesForBarberResult,
} from './types';

/** Defensive cap for the flat discovery list — not real pagination (Stage 2
 * architect-review decision: fine for MVP scale). */
const LIST_BARBERS_LIMIT = 100;

/**
 * Escape Postgres ILIKE's wildcard metacharacters (`%`, `_`, and the escape
 * character `\` itself) in a literal string so it is matched as an exact
 * string rather than a pattern. Without this, a city input containing e.g.
 * "%" would silently behave as a wildcard search instead of the exact match
 * the architect review requires.
 */
function escapeIlikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Normalize a user-supplied city string for comparison: trim leading/
 * trailing whitespace. Internal whitespace is intentionally left alone (we
 * do not know whether "New  York" with a doubled space is a typo or, in
 * principle, part of a legitimate place name) — only leading/trailing
 * whitespace is unambiguous to strip.
 */
function normalizeCityInput(value: string): string {
  return value.trim();
}

/**
 * List approved barbers whose `city` matches the given city, using a
 * case/whitespace-normalized exact match.
 *
 * Reasoning on the normalization approach (architect-review requirement:
 * `lower(trim(city)) = lower(trim($input))`, not substring/ilike matching):
 *
 * The Supabase/PostgREST JS query builder can only express filters PostgREST
 * exposes as operators (eq, ilike, etc.) against a column as stored — it
 * cannot call an arbitrary SQL function like `trim()` or `lower()` on the
 * *stored* column value from the client. Doing that server-side would
 * require a computed column, a view, or an RPC function, all of which are
 * schema changes and out of scope for this pipeline run (schema is sacred;
 * one feature per pipeline run).
 *
 * Given that constraint, this function normalizes what it *can* control —
 * the input side — by trimming it, and uses Postgres `ILIKE` with no
 * wildcards (after escaping any literal `%`/`_`/`\` in the input) for
 * case-insensitive comparison. `ILIKE` alone does not trim whitespace
 * *stored* in the `city` column, so a stored value with stray leading/
 * trailing whitespace (e.g. a "London " typo that made it into `users.city`
 * at signup/profile-edit time) would still fail to match even though it is
 * "the same" city. That is a genuine limitation of filtering from the JS
 * client against unnormalized stored data, not an oversight — the correct
 * long-term fix is normalizing `city` at write time (signup/profile-edit
 * validation) or, later, a dedicated normalized column/index, both out of
 * scope here. This function delivers exact-match semantics that are
 * case-insensitive and input-whitespace-insensitive, which is the closest
 * correct behavior achievable without a schema change.
 */
export async function listBarbersByCity(city: string): Promise<ListBarbersResult> {
  const normalized = normalizeCityInput(city);
  const { data, error } = await supabase
    .from('barber_directory')
    .select('*')
    .ilike('city', escapeIlikeLiteral(normalized))
    .order('name', { ascending: true })
    .limit(LIST_BARBERS_LIMIT);

  if (error) return mapPostgrestError('listBarbersByCity', error);
  return { status: 'ok', barbers: (data as BarberDirectoryRow[]) ?? [] };
}

/** Fetch a single approved barber's public profile by id. */
export async function getBarberProfile(barberId: string): Promise<GetBarberProfileResult> {
  const { data, error } = await supabase
    .from('barber_directory')
    .select('*')
    .eq('id', barberId)
    .maybeSingle();

  if (error) return mapPostgrestError('getBarberProfile', error);
  if (!data) return { status: 'not_found' };
  return { status: 'ok', barber: data as BarberDirectoryRow };
}

/**
 * Batched services read for a set of barbers (the Discover screen's
 * "from €X" line and service-name chips). One query for the whole visible
 * list instead of N per-barber queries. Same RLS surface as
 * listServicesForBarber: migration 0007 hides rows of unapproved,
 * non-owned barbers, so any id list a customer can hold is safe to pass.
 */
export async function listServicesForBarberIds(
  barberIds: string[]
): Promise<ListServicesForBarberResult> {
  if (barberIds.length === 0) return { status: 'ok', services: [] };
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .in('barber_id', barberIds);

  if (error) return mapPostgrestError('listServicesForBarberIds', error);
  return { status: 'ok', services: (data as ServiceRow[]) ?? [] };
}

/**
 * All services for the given barber. Safe against any barberId per
 * migration 0007: RLS itself hides an unapproved, non-owned barber's rows.
 */
export async function listServicesForBarber(
  barberId: string
): Promise<ListServicesForBarberResult> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('barber_id', barberId)
    .order('name', { ascending: true });

  if (error) return mapPostgrestError('listServicesForBarber', error);
  return { status: 'ok', services: (data as ServiceRow[]) ?? [] };
}
