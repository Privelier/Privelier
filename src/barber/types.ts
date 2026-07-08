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

// ---------------------------------------------------------------------------
// Chats (public.chat_rooms + public.messages, read-only until step 15-16)
// ---------------------------------------------------------------------------

export type OwnChatsViewResult =
  | { status: 'ok'; threads: InboxThread[] }
  | BarberDataFailure;

// ---------------------------------------------------------------------------
// Incoming requests (public.bookings, read-only until step 13-14)
// ---------------------------------------------------------------------------

/**
 * `servicesById` is an own-services lookup for rendering; a booking whose
 * service row was since deleted may be absent from it.
 */
export type OwnRequestsViewResult =
  | { status: 'ok'; bookings: BookingRow[]; servicesById: Map<string, ServiceRow> }
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
