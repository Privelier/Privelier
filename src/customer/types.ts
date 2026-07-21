/**
 * Public result types for the customer discovery data layer (build-order
 * step 9-10). Every function returns a discriminated union the UI can
 * switch on; nothing here ever carries raw server error text.
 */
import type {
  AvailabilityRow,
  BarberDirectoryRow,
  BookingRow,
  MessageRow,
  PortfolioRow,
  ReviewRow,
  ServiceRow,
} from '../types';
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
// Portfolio (public.portfolio, read-only from the customer side)
// ---------------------------------------------------------------------------

/**
 * A barber's portfolio images for the BarberProfileScreen Portfolio tab. The
 * table's `portfolio_select_all` RLS permits any authenticated caller, so any
 * barberId a customer can navigate to is safe to pass. `images` may be empty
 * (the 0-image empty state is expected).
 */
export type ListPortfolioForBarberResult =
  | { status: 'ok'; images: PortfolioRow[] }
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

// ---------------------------------------------------------------------------
// Conversation (public.messages, build-order step 15-16)
// ---------------------------------------------------------------------------

export type FetchConversationResult =
  | { status: 'ok'; messages: MessageRow[] }
  | CustomerDataFailure;

/** `message` is the authoritative inserted row (server id + created_at). */
export type SendMessageResult =
  | { status: 'ok'; message: MessageRow }
  | CustomerDataFailure;

// ---------------------------------------------------------------------------
// Reviews (public.reviews, build-order step 18)
// ---------------------------------------------------------------------------

/**
 * One barber's reviews for the BarberProfileScreen Reviews tab, plus a
 * best-effort first-name map keyed by review id (from the get_review_authors
 * RPC). A review whose author name failed to resolve simply renders without a
 * name ("Verified booking" alone) — the map is enrichment, never a gate.
 * `reviews` may be empty (the no-reviews-yet empty state is expected).
 */
export type ReviewsForBarberResult =
  | {
      status: 'ok';
      reviews: ReviewRow[];
      firstNameByReviewId: Map<string, string>;
    }
  | CustomerDataFailure;

/**
 * The set of booking ids (from a given batch) the customer has already
 * reviewed, so the Bookings tab can show "Leave a review" vs "Reviewed" on
 * each completed booking. RLS scopes reviews to the caller's own rows for this
 * read by customer_id, so the ids returned are exactly the caller's reviews.
 */
export type OwnReviewedBookingIdsResult =
  | { status: 'ok'; reviewedBookingIds: Set<string> }
  | CustomerDataFailure;

/**
 * `booking` is not returned — the fresh row carries no client-useful state
 * beyond success (the aggregate lands server-side via the 0022 trigger).
 * 'already_reviewed' means the reviews.booking_id UNIQUE index rejected a
 * second review for this booking (Postgres 23505) — a real, user-facing state
 * on a retry, distinct from the generic error path so the screen can say so.
 */
export type SubmitReviewResult =
  | { status: 'ok'; review: ReviewRow }
  | { status: 'already_reviewed' }
  | CustomerDataFailure;
