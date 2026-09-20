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
import { fetchOwnLocation } from './locationData';
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
 * Derive the five-item readiness meter. The four content items (services,
 * availability, portfolio, bio) are simple presence checks — bio counts only
 * when non-empty after trimming, matching the DB CHECK and updateOwnBio's
 * empty→NULL normalization. Verification maps its admin-owned status onto a
 * state that never blames the barber for a pending manual review: approved →
 * complete, rejected → attention, pending/absent → in_progress (calm).
 * `isLive` is true only when all five are complete.
 */
export function deriveProfileReadiness(input: {
  serviceCount: number | null;
  availabilityCount: number | null;
  portfolioCount: number | null;
  profile: { bio: string | null; verification: VerificationStatus | null } | null;
}): ProfileReadiness {
  const contentState = (count: number | null): ReadinessState =>
    count === null ? 'unavailable' : count > 0 ? 'complete' : 'incomplete';
  const verificationState: ReadinessState =
    input.profile === null
      ? 'unavailable'
      : input.profile.verification === 'approved'
        ? 'complete'
        : input.profile.verification === 'rejected'
          ? 'attention'
          : 'in_progress';
  const bioState: ReadinessState =
    input.profile === null
      ? 'unavailable'
      : (input.profile.bio?.trim().length ?? 0) > 0
        ? 'complete'
        : 'incomplete';

  const items: ReadinessItem[] = [
    { key: 'services', state: contentState(input.serviceCount) },
    { key: 'availability', state: contentState(input.availabilityCount) },
    { key: 'portfolio', state: contentState(input.portfolioCount) },
    { key: 'bio', state: bioState },
    { key: 'verification', state: verificationState },
  ];

  const completeCount = items.filter((item) => item.state === 'complete').length;
  const unavailableCount = items.filter((item) => item.state === 'unavailable').length;
  return {
    items,
    completeCount,
    unavailableCount,
    total: items.length,
    isLive: unavailableCount > 0 ? null : completeCount === items.length,
  };
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

  const [requests, servicesResult, availabilityResult, portfolioResult, profileResult, locationResult] =
    await Promise.all([
      fetchOwnRequestsView(),
      listOwnServices(barberId),
      listOwnAvailability(barberId),
      listOwnPortfolio(barberId),
      fetchOwnBarberProfile(barberId),
      fetchOwnLocation(barberId),
    ]);

  const services =
    servicesResult.status === 'ok' ? { status: 'ok' as const, data: servicesResult.services } : servicesResult;
  const availability =
    availabilityResult.status === 'ok'
      ? { status: 'ok' as const, data: availabilityResult.windows }
      : availabilityResult;
  const portfolio =
    portfolioResult.status === 'ok' ? { status: 'ok' as const, data: portfolioResult.images } : portfolioResult;
  const profile =
    profileResult.status === 'ok'
      ? {
          status: 'ok' as const,
          data: {
            verification: profileResult.profile?.verification_status ?? null,
            bio: profileResult.profile?.bio ?? null,
          },
        }
      : profileResult;
  const location =
    locationResult.status === 'ok'
      ? { status: 'ok' as const, data: locationResult.location?.address ?? null }
      : locationResult;
  const overview =
    requests.status === 'ok'
      ? {
          status: 'ok' as const,
          data: deriveBookingsOverview(
            requests.bookings,
            now,
            requests.servicesById,
            requests.counterpartsByBookingId
          ),
        }
      : requests;

  const readiness = deriveProfileReadiness({
    serviceCount: services.status === 'ok' ? services.data.length : null,
    availabilityCount: availability.status === 'ok' ? availability.data.length : null,
    portfolioCount: portfolio.status === 'ok' ? portfolio.data.length : null,
    profile: profile.status === 'ok' ? profile.data : null,
  });

  return { overview, services, availability, portfolio, profile, location, readiness };
}
