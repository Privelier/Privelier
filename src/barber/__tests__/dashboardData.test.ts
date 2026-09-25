/**
 * Tests for the Studio dashboard data layer (build-order step 17). The two
 * derivations are pure and tested directly; fetchDashboardView is tested with
 * every sibling data module mocked, to prove per-field degradation (one failed
 * read blanks only its own section, never the whole dashboard).
 */
import {
  deriveProfileReadiness,
  fetchDashboardView,
} from '../dashboardData';
import { fetchDashboardAnalytics } from '../dashboardAnalyticsData';
import { listOwnServices } from '../servicesData';
import { listOwnAvailability } from '../availabilityData';
import { listOwnPortfolio } from '../portfolioData';
import { fetchOwnBarberProfile } from '../profileData';
import { fetchOwnLocation } from '../locationData';
import type { ServiceRow } from '../../types';
import type { BarberDashboardAnalytics } from '../types';

// Factory mocks (not bare auto-mocks): a bare jest.mock still requires the real
// sibling module to introspect its shape, which pulls in lib/supabase and
// throws in the jest env. Factories keep the real modules — and Supabase — out.
jest.mock('../dashboardAnalyticsData', () => ({ fetchDashboardAnalytics: jest.fn() }));
jest.mock('../servicesData', () => ({ listOwnServices: jest.fn() }));
jest.mock('../availabilityData', () => ({ listOwnAvailability: jest.fn() }));
jest.mock('../portfolioData', () => ({ listOwnPortfolio: jest.fn() }));
jest.mock('../profileData', () => ({ fetchOwnBarberProfile: jest.fn() }));
jest.mock('../locationData', () => ({ fetchOwnLocation: jest.fn() }));

function service(overrides: Partial<ServiceRow>): ServiceRow {
  return { id: 's1', barber_id: 'brb1', name: 'Fade', price: 40, duration_minutes: 45, ...overrides };
}

const ANALYTICS: BarberDashboardAnalytics = {
  completedWeek: 1,
  completedMonth: 3,
  completedAllTime: 12,
  bookedValueWeek: 40,
  bookedValueMonth: 120,
  bookedValueAllTime: 480,
  pendingCount: 1,
  upcomingCount: 1,
  nextAppointment: { date: '2026-07-15', time: '10:00:00', customerName: 'Sam', serviceName: 'Fade' },
  weeklyTrend: [{ weekStart: '2026-07-13', completedCuts: 1, bookedValue: 40 }],
  ratingAverage: 4.8,
  reviewCount: 5,
  repeatCustomerCount: 2,
  topServices: [{ name: 'Fade', completedCuts: 8, bookedValue: 320 }],
  busiestWeekday: { weekday: 'Friday', completedCuts: 4 },
};

describe('deriveProfileReadiness', () => {
  it('is fully live only when all six items are complete (approved verification)', () => {
    const r = deriveProfileReadiness({
      serviceCount: 2,
      availabilityCount: 1,
      portfolioCount: 3,
      hasLocation: true,
      profile: { bio: 'Sharp fades since 2015.', verification: 'approved' },
    });
    expect(r.completeCount).toBe(6);
    expect(r.total).toBe(6);
    expect(r.isLive).toBe(true);
  });

  it('marks the content items incomplete when absent', () => {
    const r = deriveProfileReadiness({
      serviceCount: 0,
      availabilityCount: 0,
      portfolioCount: 0,
      hasLocation: false,
      profile: { bio: null, verification: 'approved' },
    });
    const byKey = Object.fromEntries(r.items.map((i) => [i.key, i.state]));
    expect(byKey).toMatchObject({
      services: 'incomplete',
      availability: 'incomplete',
      portfolio: 'incomplete',
      bio: 'incomplete',
    });
    expect(r.total).toBe(6);
    expect(r.completeCount).toBe(1); // only verification
    expect(r.isLive).toBe(false);
  });

  it.each([
    ['   ', 'incomplete'],
    ['', 'incomplete'],
    [null, 'incomplete'],
    ['A real bio', 'complete'],
  ] as const)('marks bio %j as %s (non-empty after trim)', (bio, expected) => {
    const r = deriveProfileReadiness({
      serviceCount: 1,
      availabilityCount: 1,
      portfolioCount: 1,
      hasLocation: true,
      profile: { bio, verification: 'approved' },
    });
    expect(r.items.find((i) => i.key === 'bio')?.state).toBe(expected);
  });

  it.each([
    ['pending', 'in_progress'],
    [null, 'in_progress'],
    ['rejected', 'attention'],
    ['approved', 'complete'],
  ] as const)('maps verification %s to the %s state', (verification, expected) => {
    const r = deriveProfileReadiness({
      serviceCount: 1,
      availabilityCount: 1,
      portfolioCount: 1,
      hasLocation: true,
      profile: { bio: 'x', verification },
    });
    const v = r.items.find((i) => i.key === 'verification');
    expect(v?.state).toBe(expected);
  });

  it('a pending verification never counts as complete and is not "live"', () => {
    const r = deriveProfileReadiness({
      serviceCount: 1,
      availabilityCount: 1,
      portfolioCount: 1,
      hasLocation: true,
      profile: { bio: null, verification: 'pending' },
    });
    expect(r.completeCount).toBe(4);
    expect(r.isLive).toBe(false);
  });
});

describe('fetchDashboardView', () => {
  const mockAnalytics = fetchDashboardAnalytics as jest.Mock;
  const mockServices = listOwnServices as jest.Mock;
  const mockAvailability = listOwnAvailability as jest.Mock;
  const mockPortfolio = listOwnPortfolio as jest.Mock;
  const mockProfile = fetchOwnBarberProfile as jest.Mock;
  const mockLocation = fetchOwnLocation as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalytics.mockResolvedValue({ status: 'ok', data: ANALYTICS });
    mockAnalytics.mockResolvedValue({ status: 'ok', data: ANALYTICS });
    mockServices.mockResolvedValue({ status: 'ok', services: [service({})] });
    mockAvailability.mockResolvedValue({ status: 'ok', windows: [{ id: 'w1' }] });
    mockPortfolio.mockResolvedValue({ status: 'ok', images: [{ id: 'img1' }] });
    mockProfile.mockResolvedValue({
      status: 'ok',
      profile: { verification_status: 'approved', bio: 'A short bio' },
    });
    mockLocation.mockResolvedValue({
      status: 'ok',
      location: { user_id: 'brb1', address: 'Teststraat 1, Amsterdam' },
    });
  });

  it('composes server analytics + readiness + summary arrays when every read succeeds', async () => {
    const view = await fetchDashboardView('brb1');
    expect(view.analytics).toEqual({ status: 'ok', data: ANALYTICS });
    expect(view.services).toMatchObject({ status: 'ok', data: [expect.objectContaining({ id: 's1' })] });
    expect(view.availability).toMatchObject({ status: 'ok', data: [expect.objectContaining({ id: 'w1' })] });
    expect(view.portfolio).toMatchObject({ status: 'ok', data: [expect.objectContaining({ id: 'img1' })] });
    expect(view.profile).toMatchObject({ status: 'ok', data: { verification: 'approved', bio: 'A short bio' } });
    expect(view.location).toEqual({ status: 'ok', data: 'Teststraat 1, Amsterdam' });
    expect(view.readiness.isLive).toBe(true);
  });

  it('keeps setup incomplete when a location read fails', async () => {
    mockLocation.mockResolvedValue({ status: 'error', code: 'network', message: 'x' });
    const view = await fetchDashboardView('brb1');
    expect(view.location).toMatchObject({ status: 'error', code: 'network' });
    expect(view.readiness.total).toBe(6);
    expect(view.readiness.items.find((i) => i.key === 'location')?.state).toBe('unavailable');
    expect(view.readiness.isLive).toBeNull();
  });

  it('degrades analytics when the aggregate RPC fails, without failing setup data', async () => {
    mockAnalytics.mockResolvedValue({ status: 'error', code: 'network', message: 'x' });
    const view = await fetchDashboardView('brb1');
    expect(view.analytics).toMatchObject({ status: 'error', code: 'network' });
    // readiness still derives from the other (successful) reads
    expect(view.readiness.items.find((i) => i.key === 'services')?.state).toBe('complete');
  });

  it('degrades per-field: a failed services read empties services and marks that item incomplete', async () => {
    mockServices.mockResolvedValue({ status: 'error', code: 'network', message: 'x' });
    const view = await fetchDashboardView('brb1');
    expect(view.services).toMatchObject({ status: 'error', code: 'network' });
    expect(view.readiness.items.find((i) => i.key === 'services')?.state).toBe('unavailable');
    expect(view.readiness.isLive).toBeNull();
  });

  it('treats a failed profile read as unknown verification (in_progress, never a fault)', async () => {
    mockProfile.mockResolvedValue({ status: 'error', code: 'network', message: 'x' });
    const view = await fetchDashboardView('brb1');
    expect(view.profile).toMatchObject({ status: 'error', code: 'network' });
    expect(view.readiness.items.find((i) => i.key === 'verification')?.state).toBe('unavailable');
    expect(view.readiness.items.find((i) => i.key === 'bio')?.state).toBe('unavailable');
  });
});
