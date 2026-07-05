/**
 * Public result types for the customer discovery data layer (build-order
 * step 9-10). Every function returns a discriminated union the UI can
 * switch on; nothing here ever carries raw server error text.
 */
import type { BarberDirectoryRow, ServiceRow } from '../types';
import type { CustomerDataFailure } from './errors';

// ---------------------------------------------------------------------------
// Discovery (public.barber_directory)
// ---------------------------------------------------------------------------

export type ListBarbersResult =
  | { status: 'ok'; barbers: BarberDirectoryRow[] }
  | CustomerDataFailure;

/**
 * 'not_found' means no approved barber with that id exists in
 * `barber_directory` — either the id is wrong, the barber is not (or no
 * longer) approved, or the row does not exist. These are indistinguishable
 * by design: the view's WHERE clause is the only gate.
 */
export type GetBarberProfileResult =
  | { status: 'ok'; barber: BarberDirectoryRow }
  | { status: 'not_found' }
  | CustomerDataFailure;

// ---------------------------------------------------------------------------
// Services (public.services, read-only from the customer side)
// ---------------------------------------------------------------------------

export type ListServicesForBarberResult =
  | { status: 'ok'; services: ServiceRow[] }
  | CustomerDataFailure;
