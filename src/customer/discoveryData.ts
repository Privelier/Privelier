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
import type { BarberDirectoryRow, PortfolioRow, ServiceRow } from '../types';
import { mapPostgrestError } from './errors';
import type {
  GetBarberProfileResult,
  ListBarbersResult,
  ListPortfolioForBarberResult,
  ListServicesForBarberResult,
} from './types';

/** Defensive cap for the flat discovery list — not real pagination (Stage 2
 * architect-review decision: fine for MVP scale). */
const LIST_BARBERS_LIMIT = 100;

/**
 * Escape Postgres ILIKE's wildcard metacharacters (`%`, `_`, and the escape
 * character `\` itself) so user text cannot widen the candidate query. The
 * exact comparison happens after the rows return.
 */
function escapeIlikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Internal whitespace and accented characters are preserved. Aliases such as
 * Nuremberg and Nürnberg intentionally remain distinct.
 */
function normalizeCity(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * PostgREST cannot trim the stored column. The broad ILIKE query admits rows
 * with surrounding whitespace; the client-side comparison then enforces an
 * exact trimmed, case-insensitive match.
 */
export async function listBarbersByCity(city: string): Promise<ListBarbersResult> {
  const trimmed = city.trim();
  const normalized = normalizeCity(city);
  const { data, error } = await supabase
    .from('barber_directory')
    .select('*')
    .ilike('city', `%${escapeIlikeLiteral(trimmed)}%`)
    .order('name', { ascending: true })
    .limit(LIST_BARBERS_LIMIT);

  if (error) return mapPostgrestError('listBarbersByCity', error);
  const barbers = ((data as BarberDirectoryRow[]) ?? []).filter(
    (barber) => normalizeCity(barber.city ?? '') === normalized
  );
  return { status: 'ok', barbers };
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

/**
 * A barber's portfolio images for the BarberProfileScreen Portfolio tab
 * (build-order step 17). The table's `portfolio_select_all` RLS permits any
 * authenticated caller, so any barberId a customer can navigate to is safe to
 * pass. Ordered by `id` for a stable render order; the caller derives each
 * public URL via src/shared/portfolioImages.ts.
 */
export async function listPortfolioForBarber(
  barberId: string
): Promise<ListPortfolioForBarberResult> {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('barber_id', barberId)
    .order('id', { ascending: true });

  if (error) return mapPostgrestError('listPortfolioForBarber', error);
  return { status: 'ok', images: (data as PortfolioRow[]) ?? [] };
}
