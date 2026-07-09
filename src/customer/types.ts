/**
 * Public result types for the customer discovery data layer (build-order
 * step 9-10). Every function returns a discriminated union the UI can
 * switch on; nothing here ever carries raw server error text.
 */
import type { AvailabilityRow, BarberDirectoryRow, BookingRow, ServiceRow } from '../types';
import type { InboxThread } from '../shared/threads';
import type { BusySlot } from '../shared/slots';
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
// Availability & busy slots (build-order step 11-12 booking flow)
// ---------------------------------------------------------------------------

export type ListBarberAvailabilityResult =
  | { status: 'ok'; windows: AvailabilityRow[] }
  | CustomerDataFailure;

export type ListBusySlotsResult =
  | { status: 'ok'; busy: BusySlot[] }
  | CustomerDataFailure;

// ---------------------------------------------------------------------------
// Booking creation (public.bookings insert, build-order step 11-12)
// ---------------------------------------------------------------------------

/**
 * 'conflict' means the partial unique index
 * uq_bookings_barber_slot_active (migration 0009) rejected the insert with
 * Postgres 23505 — a different customer already holds a pending/accepted
 * booking for this exact barber/date/time. Distinct from the generic
 * CustomerDataFailure error path so the Confirm screen can send the
 * customer back to re-pick a slot instead of showing generic copy.
 */
export type InsertBookingResult =
  | { status: 'ok'; booking: BookingRow }
  | { status: 'conflict' }
  | CustomerDataFailure;

// ---------------------------------------------------------------------------
// Booking cancellation (public.bookings status transition, step 13-14)
// ---------------------------------------------------------------------------

/**
 * Result of a customer cancelling their own booking. One mutation covers
 * BOTH legitimate cancel paths the trigger allows the customer (migration
 * 0011): pending -> cancelled (withdraw a request the barber has not yet
 * answered) and accepted -> cancelled (call off a confirmed booking).
 * `booking` is the freshly-updated row for optimistic reconciliation.
 * 'not_found' means the update matched no visible row. A cancel the trigger
 * rejects (e.g. the booking is already completed/rejected, or the caller is
 * not the customer) surfaces as a 'transition_rejected' CustomerDataFailure.
 */
export type CancelBookingResult =
  | { status: 'ok'; booking: BookingRow }
  | { status: 'not_found' }
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
