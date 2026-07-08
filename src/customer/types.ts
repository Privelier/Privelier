/**
 * Public result types for the customer discovery data layer (build-order
 * step 9-10). Every function returns a discriminated union the UI can
 * switch on; nothing here ever carries raw server error text.
 */
import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../types';
import type { InboxThread } from '../shared/threads';
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

// ---------------------------------------------------------------------------
// Bookings (public.bookings, read-only until build-order step 11-12)
// ---------------------------------------------------------------------------

/**
 * The lookup maps are best-effort enrichment (see bookingsData.ts): a
 * booking's barber_id/service_id may legitimately be absent from them.
 */
export type OwnBookingsViewResult =
  | {
      status: 'ok';
      bookings: BookingRow[];
      barbersById: Map<string, BarberDirectoryRow>;
      servicesById: Map<string, ServiceRow>;
    }
  | CustomerDataFailure;

// ---------------------------------------------------------------------------
// Inbox (public.chat_rooms + public.messages, read-only until step 15-16)
// ---------------------------------------------------------------------------

// Thread shape moved to shared/threads.ts (the barber Chats tab reuses
// it); re-exported so existing customer-side imports stay unchanged.
export type { InboxThread } from '../shared/threads';

export type OwnInboxViewResult =
  | { status: 'ok'; threads: InboxThread[] }
  | CustomerDataFailure;
