/**
 * Public result types for the barber services/availability data layer
 * (build-order step 7-8). Every service function returns a discriminated
 * union the UI can switch on; nothing here ever carries raw server error
 * text.
 */
import type {
  AvailabilityRow,
  BarberProfileRow,
  BookingRow,
  MessageRow,
  PortfolioRow,
  ServiceRow,
  VerificationRequestRow,
} from '../types';
import type { InboxThread } from '../shared/threads';
import type { BarberDataFailure } from './errors';

// ---------------------------------------------------------------------------
// Portfolio (public.portfolio, read-only until step 17)
// ---------------------------------------------------------------------------

export type ListOwnPortfolioResult =
  | { status: 'ok'; images: PortfolioRow[] }
  | BarberDataFailure;

/**
 * `path` is the uploaded object's storage PATH (`{barberId}/{unique}.jpg`),
 * never a URL — that path is what the DB `image_url` column stores (design
 * D2/D3). The caller passes it to `insertPortfolioRow` after the upload
 * succeeds. See src/barber/portfolioData.ts.
 */
export type UploadPortfolioImageResult =
  | { status: 'ok'; path: string }
  | BarberDataFailure;

/**
 * `image` is the freshly-inserted portfolio row. A 'limit_reached'
 * BarberDataFailure means the DB's `enforce_portfolio_max_six` trigger
 * rejected the insert because the barber already holds 6 images — distinct
 * from a generic failure so the UI can show honest at-the-cap copy.
 */
export type CreatePortfolioResult =
  | { status: 'ok'; image: PortfolioRow }
  | BarberDataFailure;

/**
 * Delete ordering is DB-row-first, storage-object-best-effort (design D5):
 * once the row is gone the image is absent from every read path, so an
 * `{ status: 'ok' }` is returned even if the storage object delete then
 * fails (the orphan is logged and accepted — design D4).
 */
export type DeletePortfolioImageResult =
  | { status: 'ok' }
  | BarberDataFailure;

// ---------------------------------------------------------------------------
// Chats (public.chat_rooms + public.messages, read-only until step 15-16)
// ---------------------------------------------------------------------------

export type OwnChatsViewResult =
  | { status: 'ok'; threads: InboxThread[] }
  | BarberDataFailure;

// ---------------------------------------------------------------------------
// Conversation (public.messages, build-order step 15-16)
// ---------------------------------------------------------------------------

export type FetchConversationResult =
  | { status: 'ok'; messages: MessageRow[] }
  | BarberDataFailure;

/** `message` is the authoritative inserted row (server id + created_at). */
export type SendMessageResult =
  | { status: 'ok'; message: MessageRow }
  | BarberDataFailure;

// ---------------------------------------------------------------------------
// Incoming requests (public.bookings, read-only until step 13-14)
// ---------------------------------------------------------------------------

/**
 * The other participant on a booking, as returned by the
 * `get_booking_counterparts` RPC (migration 0012). For a barber caller this
 * is the customer. Only the three display columns are ever exposed — never
 * email/phone/city/country/role.
 */
export interface BookingCounterpart {
  id: string;
  name: string;
  profile_image: string | null;
}

/**
 * `servicesById` is an own-services lookup for rendering; a booking whose
 * service row was since deleted may be absent from it.
 *
 * `counterpartsByBookingId` maps a booking id to its customer's display
 * identity (name + photo), resolved via the `get_booking_counterparts` RPC.
 * It is BEST-EFFORT: if that RPC fails the map is empty and the screen keeps
 * its service-name fallback — the RPC never fails the whole view. A booking
 * may also be legitimately absent from it (e.g. the RPC returned no row).
 */
export type OwnRequestsViewResult =
  | {
      status: 'ok';
      bookings: BookingRow[];
      servicesById: Map<string, ServiceRow>;
      counterpartsByBookingId: Map<string, BookingCounterpart>;
    }
  | BarberDataFailure;

/**
 * Result of a barber-side booking status transition
 * (accept/reject/complete/cancel). `booking` is the freshly-updated row for
 * optimistic reconciliation. 'not_found' means the update matched no visible
 * row (wrong id, or RLS hid a booking the caller is not a participant of —
 * indistinguishable by design). A trigger-rejected transition (illegal
 * shape / wrong actor) surfaces as a 'transition_rejected' BarberDataFailure.
 */
export type TransitionBookingResult =
  | { status: 'ok'; booking: BookingRow }
  | { status: 'not_found' }
  | BarberDataFailure;

// ---------------------------------------------------------------------------
// Own barber_profile (read-only — admin-owned columns are display-only)
// ---------------------------------------------------------------------------

/** `profile: null` = row missing (defensive; provisioning creates it). */
export type FetchOwnBarberProfileResult =
  | { status: 'ok'; profile: BarberProfileRow | null }
  | BarberDataFailure;

/** `request: null` = no documents submitted yet (expected until step 17). */
export type FetchOwnVerificationRequestResult =
  | { status: 'ok'; request: VerificationRequestRow | null }
  | BarberDataFailure;

/**
 * `path` is the uploaded object's storage PATH (`{userId}/{docType}.jpg`),
 * never a URL — that path is what the DB column stores. See
 * src/barber/verificationData.ts.
 */
export type UploadVerificationDocumentResult =
  | { status: 'ok'; path: string }
  | BarberDataFailure;

/** `request` is the freshly-upserted row; `status` is DB-trigger-owned. */
export type SubmitVerificationDocumentResult =
  | { status: 'ok'; request: VerificationRequestRow }
  | BarberDataFailure;

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/** Fields required to insert a service row. */
export interface CreateServiceInput {
  barberId: string;
  name: string;
  price: number;
  durationMinutes: number;
}

/** Partial update — only the keys present are written. */
export type ServicePatch = Partial<{
  name: string;
  price: number;
  durationMinutes: number;
}>;

export type ListServicesResult = { status: 'ok'; services: ServiceRow[] } | BarberDataFailure;

export type CreateServiceResult = { status: 'ok'; service: ServiceRow } | BarberDataFailure;

/**
 * 'not_found' covers both "no such row" and "row exists but is not yours" —
 * RLS already filters the latter out, so the two are indistinguishable (and
 * should be) from the caller's point of view.
 */
export type UpdateServiceResult =
  | { status: 'ok'; service: ServiceRow }
  | { status: 'not_found' }
  | BarberDataFailure;

export type DeleteServiceResult = { status: 'ok' } | { status: 'not_found' } | BarberDataFailure;

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/**
 * Fields required to insert an availability window. Exactly one of
 * dayOfWeek / specificDate must be provided — the DB's
 * chk_availability_day_or_date constraint is the authority; a violation
 * comes back as a mapped 'invalid_input' failure, not a raw Postgres error.
 */
export interface CreateAvailabilityInput {
  barberId: string;
  dayOfWeek?: number;
  specificDate?: string;
  startTime: string;
  endTime: string;
}

/** Partial update — only the keys present are written. Use `null` to clear
 * dayOfWeek/specificDate (e.g. when switching from one to the other). */
export type AvailabilityPatch = Partial<{
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
}>;

export type ListAvailabilityResult =
  | { status: 'ok'; windows: AvailabilityRow[] }
  | BarberDataFailure;

export type CreateAvailabilityResult =
  | { status: 'ok'; window: AvailabilityRow }
  | BarberDataFailure;

/** See UpdateServiceResult for why not_found covers both "missing" and
 * "not yours". */
export type UpdateAvailabilityResult =
  | { status: 'ok'; window: AvailabilityRow }
  | { status: 'not_found' }
  | BarberDataFailure;

export type DeleteAvailabilityResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | BarberDataFailure;
