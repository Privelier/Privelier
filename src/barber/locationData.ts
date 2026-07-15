/**
 * Barber own-location data layer (Explore/location Run A — design:
 * docs/design/explore-location-design-approval.md, migration 0019).
 *
 * Privacy contract (conditions C1/C2/C5):
 *  - This module reads/writes ONLY the barber's own `barber_location` row;
 *    RLS (`barber_location_select_own` / `_insert_own` / `_update_own`) is
 *    the sole authority — `userId` is a row key, never a client-side
 *    authorization check.
 *  - It writes exactly four columns: address, latitude, longitude,
 *    location_updated_at. The display (offset) coordinates are TRIGGER-OWNED
 *    (migration 0019 overwrites them on every write) — nothing here ever
 *    sends them, and nothing here could make a client-supplied value stick.
 *  - Clearing the location is a first-class state: address/coords all NULL;
 *    the trigger then NULLs the display coords and the barber's pin
 *    disappears from Explore (founder decision D4 — never a stale pin).
 */
import { supabase } from '../../lib/supabase';
import type { BarberLocationRow } from '../types';
import { failure, mapPostgrestError } from './errors';
import type { FetchOwnLocationResult, UpdateLocationResult } from './types';

/**
 * Max address length (characters, after trim). Mirrors the DB CHECK
 * `chk_barber_location_address_len` (migration 0019); the screen also caps
 * the raw input so the server bound can never be the thing that rejects.
 */
export const MAX_ADDRESS_LENGTH = 300;

/** `location: null` = the barber has never saved a location (no row). */
export async function fetchOwnLocation(userId: string): Promise<FetchOwnLocationResult> {
  const { data, error } = await supabase
    .from('barber_location')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return mapPostgrestError('fetchOwnLocation', error);
  return { status: 'ok', location: (data as BarberLocationRow | null) ?? null };
}

export interface OwnLocationInput {
  /** Free-text display address; trimmed, empty stores as NULL. */
  address: string;
  /** Both-or-neither with longitude — mirrors chk_barber_location_coords_paired. */
  latitude: number | null;
  longitude: number | null;
}

/**
 * Upsert the barber's own location row (PK user_id — first save inserts,
 * later saves update). Client-side guards mirror the DB CHECKs so the server
 * bound is never the first rejecter; a raw-caller bypass still lands on the
 * same constraints server-side.
 */
export async function updateOwnLocation(
  userId: string,
  input: OwnLocationInput
): Promise<UpdateLocationResult> {
  const trimmed = input.address.trim();
  const address = trimmed === '' ? null : trimmed;
  if (address !== null && address.length > MAX_ADDRESS_LENGTH) return failure('invalid_input');

  const { latitude, longitude } = input;
  if ((latitude === null) !== (longitude === null)) return failure('invalid_input');
  if (latitude !== null && longitude !== null) {
    const inRange =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;
    if (!inRange) return failure('invalid_input');
  }

  const { data, error } = await supabase
    .from('barber_location')
    .upsert(
      {
        user_id: userId,
        address,
        latitude,
        longitude,
        location_updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .maybeSingle();

  if (error) return mapPostgrestError('updateOwnLocation', error);
  if (!data) return failure('unknown');
  return { status: 'ok', location: data as BarberLocationRow };
}
