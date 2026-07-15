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
  VerificationStatus,
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

/**
 * Result of writing the barber's own bio (build-order step 17, bio-edit run).
 * `profile` is the freshly-updated row. 'not_found' means the update matched
 * no visible row (defensive — the row always exists for a barber; RLS would
 * also hide a non-owner's row, indistinguishable by design). An over-length
 * bio (client-guarded, so only reachable via a raw caller) comes back through
 * the DB CHECK as a mapped 'invalid_input' failure, never raw text.
 */
export type UpdateBioResult =
  | { status: 'ok'; profile: BarberProfileRow }
  | { status: 'not_found' }
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

// ---------------------------------------------------------------------------
// Studio dashboard (bookings overview + profile readiness) — READ-ONLY glance
// ---------------------------------------------------------------------------

/**
 * Rendered form of the soonest confirmed appointment. Names are BEST-EFFORT:
 * `serviceName` is null if the service row was since deleted;
 * `counterpartName` is null if the `get_booking_counterparts` RPC did not
 * resolve this booking (the glance still renders the date/time either way).
 */
export interface NextAppointmentView {
  booking: BookingRow;
  serviceName: string | null;
  counterpartName: string | null;
}

/**
 * Read-only booking glance for the Studio tab. Counts are point-in-time
 * (refreshed on focus, deliberately NOT realtime — the Requests tab owns the
 * live channel; architect-review C3). This surface NEVER mutates a booking;
 * accept/reject/complete/cancel live only on the Requests tab.
 */
export interface BookingsOverview {
  /** status === 'pending' — requests awaiting the barber's response. */
  pendingCount: number;
  /** status === 'accepted' with a slot within the next 7 days. */
  upcomingCount: number;
  /** Earliest accepted booking whose slot is in the future (architect-review
   * C2 — accepted only, never pending). null = nothing scheduled. */
  nextAppointment: NextAppointmentView | null;
}

/**
 * Per-item readiness state. `in_progress` is the deliberate calm state for a
 * verification still under manual review — it is NEVER rendered as the
 * barber's fault (founder decision 2026-07-14). `attention` is for a
 * rejected verification (the one item that genuinely needs the barber to act).
 */
export type ReadinessState = 'complete' | 'incomplete' | 'in_progress' | 'attention';

export type ReadinessItemKey = 'services' | 'availability' | 'portfolio' | 'verification';

export interface ReadinessItem {
  key: ReadinessItemKey;
  state: ReadinessState;
}

/**
 * "Readiness to go live" — NOT a score. Bio is deliberately NOT an item
 * (founder-descoped 2026-07-14: no bio-edit screen exists yet). `isLive` is
 * true only when all four items are complete, mirroring the real gate: a
 * barber appears in customer search only once verification is approved AND
 * they have something to book.
 */
export interface ProfileReadiness {
  items: ReadinessItem[];
  completeCount: number;
  total: number;
  isLive: boolean;
}

/**
 * Everything the Studio dashboard renders beyond the barber's name (which the
 * screen reads separately via fetchOwnProfile as its identity gate). `services`
 * and `windows` back BOTH the existing summary cards and the readiness meter,
 * fetched once. This view degrades per-field and therefore always resolves —
 * a single failed sub-read blanks only its own section, never the dashboard
 * (architect-review C5, matching Studio's existing loader).
 */
export interface DashboardView {
  services: ServiceRow[];
  windows: AvailabilityRow[];
  verification: VerificationStatus | null;
  overview: BookingsOverview;
  readiness: ProfileReadiness;
}
