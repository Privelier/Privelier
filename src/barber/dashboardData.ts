/**
 * Barber Studio dashboard data layer (build-order step 17, last sub-feature).
 *
 * Booking analytics arrive as a bounded result from a barber-scoped Postgres
 * RPC; setup sections reuse the same owner-scoped reads as the relevant tabs.
 * This module composes them into the Studio analytics and readiness view. It
 * never writes: booking mutations stay on the Requests tab, and the
 * admin-owned verification columns are read-only (migration 0005). Every
 * derivation is a PURE function over already-fetched rows so it unit-tests
 * without the network; the orchestrator degrades per-field exactly like
 * StudioScreen's existing loader, so one failed sub-read blanks only its own
 * section rather than the whole dashboard (architect-review C4/C5).
 *
 * Booking aggregates stay in Postgres; the phone receives no raw booking list.
 */
import type { VerificationStatus } from '../types';
import { listOwnAvailability } from './availabilityData';
import { fetchOwnLocation } from './locationData';
import { fetchOwnBarberProfile } from './profileData';
import { listOwnPortfolio } from './portfolioData';
import { fetchDashboardAnalytics } from './dashboardAnalyticsData';
import { listOwnServices } from './servicesData';
import type {
  DashboardView,
  ProfileReadiness,
  ReadinessItem,
  ReadinessState,
} from './types';

/**
 * Derive the six-item setup checklist. Content items use presence checks; bio
 * counts only when non-empty after trimming, matching the DB CHECK and updateOwnBio's
 * empty→NULL normalization. Verification maps its admin-owned status onto a
 * state that never blames the barber for a pending manual review: approved →
 * complete, rejected → attention, pending/absent → in_progress (calm).
 * `isLive` is true only when all six are complete.
 */
export function deriveProfileReadiness(input: {
  serviceCount: number | null;
  availabilityCount: number | null;
  portfolioCount: number | null;
  hasLocation: boolean | null;
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
    { key: 'location', state: input.hasLocation === null ? 'unavailable' : input.hasLocation ? 'complete' : 'incomplete' },
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
 * gate). Runs the aggregate RPC and owner-scoped setup reads in parallel; each degrades to an
 * empty/neutral value on its own, so this resolves to a `DashboardView` in
 * all cases — it never rejects and never surfaces a whole-dashboard error
 * (matching StudioScreen's existing behaviour). `barberId` is the caller's own
 * user id; RLS scopes every read to them, so no query carries an extra filter.
 */
export async function fetchDashboardView(barberId: string): Promise<DashboardView> {
  const [analytics, servicesResult, availabilityResult, portfolioResult, profileResult, locationResult] =
    await Promise.all([
      fetchDashboardAnalytics(),
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
  const readiness = deriveProfileReadiness({
    serviceCount: services.status === 'ok' ? services.data.length : null,
    availabilityCount: availability.status === 'ok' ? availability.data.length : null,
    portfolioCount: portfolio.status === 'ok' ? portfolio.data.length : null,
    hasLocation: location.status === 'ok' ? Boolean(location.data?.trim()) : null,
    profile: profile.status === 'ok' ? profile.data : null,
  });

  return { analytics, services, availability, portfolio, profile, location, readiness };
}
