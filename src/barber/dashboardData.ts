/**
 * Barber Studio dashboard data layer (build-order step 17, last sub-feature).
 *
 * This module adds NO new read to the backend — it composes the SAME
 * RLS-scoped reads the individual barber tabs already use (Requests, Services,
 * Availability, Portfolio, Verify) into two read-only derived surfaces for the
 * Studio tab: a bookings-overview glance and a profile-readiness meter. It
 * never writes: booking mutations stay on the Requests tab, and the
 * admin-owned verification columns are read-only (migration 0005). Every
 * derivation is a PURE function over already-fetched rows so it unit-tests
 * without the network; the orchestrator degrades per-field exactly like
 * StudioScreen's existing loader, so one failed sub-read blanks only its own
 * section rather than the whole dashboard (architect-review C4/C5).
 *
 * Time handling reuses the shared `bookingSlotStart` composition
 * (src/shared/bookingTime.ts) — the same `${date}T${time}` local-instant
 * interpretation the customer Bookings tab uses (architect-review C1).
 */
import { bookingSlotStart } from '../shared/bookingTime';
import type { BookingRow, ServiceRow, VerificationStatus } from '../types';
import { listOwnAvailability } from './availabilityData';
import { fetchOwnBarberProfile } from './profileData';
import { listOwnPortfolio } from './portfolioData';
import { fetchOwnRequestsView } from './requestsData';
import { listOwnServices } from './servicesData';
import type {
  BookingCounterpart,
  BookingsOverview,
  DashboardView,
  ProfileReadiness,
  ReadinessItem,
  ReadinessState,
} from './types';

/** The overview shown before any booking data loads / when it fails to load. */
const EMPTY_OVERVIEW: BookingsOverview = {
  pendingCount: 0,
  upcomingCount: 0,
  nextAppointment: null,
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Derive the read-only bookings glance from the barber's own bookings.
 *
 * - `pendingCount` — every booking still awaiting the barber's response.
 * - `upcomingCount` — accepted bookings whose slot falls within [now, now+7d).
 * - `nextAppointment` — the earliest accepted booking with a future slot
 *   (architect-review C2: accepted only, never pending; a pending request is
 *   not a confirmed appointment). Sort-independent: picks the minimum slot
 *   rather than trusting caller ordering. Names are resolved best-effort from
 *   the same lookup maps `fetchOwnRequestsView` already returns.
 */
export function deriveBookingsOverview(
  bookings: BookingRow[],
  now: Date,
  servicesById: Map<string, ServiceRow>,
  counterpartsByBookingId: Map<string, BookingCounterpart>
): BookingsOverview {
  const nowMs = now.getTime();
  let pendingCount = 0;
  let upcomingCount = 0;
  let nextBooking: BookingRow | null = null;
  let nextMs = Infinity;

  for (const booking of bookings) {
    if (booking.status === 'pending') {
      pendingCount += 1;
      continue;
    }
    if (booking.status !== 'accepted') continue;

    const slotMs = bookingSlotStart(booking).getTime();
    if (Number.isNaN(slotMs) || slotMs < nowMs) continue;

    if (slotMs < nowMs + SEVEN_DAYS_MS) upcomingCount += 1;
    if (slotMs < nextMs) {
      nextMs = slotMs;
      nextBooking = booking;
    }
  }

  const nextAppointment = nextBooking
    ? {
        booking: nextBooking,
        serviceName: servicesById.get(nextBooking.service_id)?.name ?? null,
        counterpartName: counterpartsByBookingId.get(nextBooking.id)?.name ?? null,
      }
    : null;

  return { pendingCount, upcomingCount, nextAppointment };
}

/**
 * Derive the four-item readiness meter (bio is founder-descoped). The three
 * content items are simple presence checks; verification maps its
 * admin-owned status onto a state that never blames the barber for a pending
 * manual review: approved → complete, rejected → attention, pending/absent →
 * in_progress (calm). `isLive` is true only when all four are complete.
 */
export function deriveProfileReadiness(input: {
  serviceCount: number;
  availabilityCount: number;
  portfolioCount: number;
  verification: VerificationStatus | null;
}): ProfileReadiness {
  const verificationState: ReadinessState =
    input.verification === 'approved'
      ? 'complete'
      : input.verification === 'rejected'
        ? 'attention'
        : 'in_progress';

  const items: ReadinessItem[] = [
    { key: 'services', state: input.serviceCount > 0 ? 'complete' : 'incomplete' },
    { key: 'availability', state: input.availabilityCount > 0 ? 'complete' : 'incomplete' },
    { key: 'portfolio', state: input.portfolioCount > 0 ? 'complete' : 'incomplete' },
    { key: 'verification', state: verificationState },
  ];

  const completeCount = items.filter((item) => item.state === 'complete').length;
  return { items, completeCount, total: items.length, isLive: completeCount === items.length };
}

/**
 * Fetch and compose everything the Studio dashboard renders (except the
 * barber's name, which the screen reads via fetchOwnProfile as its identity
 * gate). Runs the five owner-scoped reads in parallel; each degrades to an
 * empty/neutral value on its own, so this resolves to a `DashboardView` in
 * all cases — it never rejects and never surfaces a whole-dashboard error
 * (matching StudioScreen's existing behaviour). `barberId` is the caller's own
 * user id; RLS scopes every read to them, so no query carries an extra filter.
 */
export async function fetchDashboardView(barberId: string): Promise<DashboardView> {
  const now = new Date();

  const [requests, servicesResult, availabilityResult, portfolioResult, profileResult] =
    await Promise.all([
      fetchOwnRequestsView(),
      listOwnServices(barberId),
      listOwnAvailability(barberId),
      listOwnPortfolio(barberId),
      fetchOwnBarberProfile(barberId),
    ]);

  const services = servicesResult.status === 'ok' ? servicesResult.services : [];
  const windows = availabilityResult.status === 'ok' ? availabilityResult.windows : [];
  const portfolioCount = portfolioResult.status === 'ok' ? portfolioResult.images.length : 0;
  const verification =
    profileResult.status === 'ok' ? (profileResult.profile?.verification_status ?? null) : null;

  const overview =
    requests.status === 'ok'
      ? deriveBookingsOverview(
          requests.bookings,
          now,
          requests.servicesById,
          requests.counterpartsByBookingId
        )
      : EMPTY_OVERVIEW;

  const readiness = deriveProfileReadiness({
    serviceCount: services.length,
    availabilityCount: windows.length,
    portfolioCount,
    verification,
  });

  return { services, windows, verification, overview, readiness };
}
