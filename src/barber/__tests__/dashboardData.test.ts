/**
 * Tests for the Studio dashboard data layer (build-order step 17). The two
 * derivations are pure and tested directly; fetchDashboardView is tested with
 * every sibling data module mocked, to prove per-field degradation (one failed
 * read blanks only its own section, never the whole dashboard).
 */
import type { BookingRow, ServiceRow } from '../../types';
import {
  deriveBookingsOverview,
  deriveProfileReadiness,
  fetchDashboardView,
} from '../dashboardData';
import type { BookingCounterpart } from '../types';
import { fetchOwnRequestsView } from '../requestsData';
import { listOwnServices } from '../servicesData';
import { listOwnAvailability } from '../availabilityData';
import { listOwnPortfolio } from '../portfolioData';
import { fetchOwnBarberProfile } from '../profileData';

// Factory mocks (not bare auto-mocks): a bare jest.mock still requires the real
// sibling module to introspect its shape, which pulls in lib/supabase and
// throws in the jest env. Factories keep the real modules — and Supabase — out.
jest.mock('../requestsData', () => ({ fetchOwnRequestsView: jest.fn() }));
jest.mock('../servicesData', () => ({ listOwnServices: jest.fn() }));
jest.mock('../availabilityData', () => ({ listOwnAvailability: jest.fn() }));
jest.mock('../portfolioData', () => ({ listOwnPortfolio: jest.fn() }));
jest.mock('../profileData', () => ({ fetchOwnBarberProfile: jest.fn() }));

const NOW = new Date('2026-07-14T12:00:00');

function booking(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: 'b1',
    customer_id: 'c1',
    barber_id: 'brb1',
    service_id: 's1',
    date: '2026-07-15',
    time: '10:00:00',
    location: 'Home',
    price: 40,
    status: 'accepted',
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function service(overrides: Partial<ServiceRow>): ServiceRow {
  return { id: 's1', barber_id: 'brb1', name: 'Fade', price: 40, duration_minutes: 45, ...overrides };
}

const NO_SERVICES = new Map<string, ServiceRow>();
const NO_COUNTERPARTS = new Map<string, BookingCounterpart>();

describe('deriveBookingsOverview', () => {
  it('counts pending requests regardless of slot time', () => {
    const bookings = [
      booking({ id: 'p1', status: 'pending', date: '2026-07-20' }),
      booking({ id: 'p2', status: 'pending', date: '2026-07-01' }), // past pending still awaits a response
      booking({ id: 'a1', status: 'accepted' }),
    ];
    expect(deriveBookingsOverview(bookings, NOW, NO_SERVICES, NO_COUNTERPARTS).pendingCount).toBe(2);
  });

  it('upcomingCount is accepted bookings within the next 7 days only', () => {
    const bookings = [
      booking({ id: 'a1', status: 'accepted', date: '2026-07-15' }), // +1 day  -> in
      booking({ id: 'a2', status: 'accepted', date: '2026-07-20' }), // +6 days -> in
      booking({ id: 'a3', status: 'accepted', date: '2026-07-25' }), // +11 days -> out of window
      booking({ id: 'a4', status: 'accepted', date: '2026-07-10' }), // past    -> out
      booking({ id: 'p1', status: 'pending', date: '2026-07-15' }), // pending -> never upcoming
    ];
    expect(deriveBookingsOverview(bookings, NOW, NO_SERVICES, NO_COUNTERPARTS).upcomingCount).toBe(2);
  });

  it('nextAppointment is the earliest FUTURE accepted booking, sort-independent', () => {
    const bookings = [
      booking({ id: 'later', status: 'accepted', date: '2026-07-25', time: '09:00:00' }),
      booking({ id: 'soonest', status: 'accepted', date: '2026-07-15', time: '08:00:00' }),
      booking({ id: 'pendingSooner', status: 'pending', date: '2026-07-14', time: '13:00:00' }),
      booking({ id: 'pastAccepted', status: 'accepted', date: '2026-07-10', time: '08:00:00' }),
    ];
    const overview = deriveBookingsOverview(bookings, NOW, NO_SERVICES, NO_COUNTERPARTS);
    expect(overview.nextAppointment?.booking.id).toBe('soonest');
  });

  it('resolves next-appointment names best-effort from the lookup maps', () => {
    const next = booking({ id: 'a1', status: 'accepted', service_id: 's9' });
    const services = new Map([['s9', service({ id: 's9', name: 'Beard trim' })]]);
    const counterparts = new Map<string, BookingCounterpart>([
      ['a1', { id: 'c1', name: 'Sam', profile_image: null }],
    ]);
    const overview = deriveBookingsOverview([next], NOW, services, counterparts);
    expect(overview.nextAppointment).toMatchObject({ serviceName: 'Beard trim', counterpartName: 'Sam' });
  });

  it('leaves names null when the maps do not resolve, without dropping the appointment', () => {
    const overview = deriveBookingsOverview([booking({ status: 'accepted' })], NOW, NO_SERVICES, NO_COUNTERPARTS);
    expect(overview.nextAppointment).toMatchObject({ serviceName: null, counterpartName: null });
    expect(overview.nextAppointment?.booking.id).toBe('b1');
  });

  it('ignores an accepted booking with an unparseable slot', () => {
    const overview = deriveBookingsOverview(
      [booking({ status: 'accepted', date: 'not-a-date' })],
      NOW,
      NO_SERVICES,
      NO_COUNTERPARTS
    );
    expect(overview.upcomingCount).toBe(0);
    expect(overview.nextAppointment).toBeNull();
  });

  it('is all-zero / null for an empty booking list', () => {
    expect(deriveBookingsOverview([], NOW, NO_SERVICES, NO_COUNTERPARTS)).toEqual({
      pendingCount: 0,
      upcomingCount: 0,
      nextAppointment: null,
    });
  });
});

describe('deriveProfileReadiness', () => {
  it('is fully live only when all four items are complete (approved verification)', () => {
    const r = deriveProfileReadiness({
      serviceCount: 2,
      availabilityCount: 1,
      portfolioCount: 3,
      verification: 'approved',
    });
    expect(r.completeCount).toBe(4);
    expect(r.total).toBe(4);
    expect(r.isLive).toBe(true);
  });

  it('marks the content items incomplete when absent', () => {
    const r = deriveProfileReadiness({
      serviceCount: 0,
      availabilityCount: 0,
      portfolioCount: 0,
      verification: 'approved',
    });
    const byKey = Object.fromEntries(r.items.map((i) => [i.key, i.state]));
    expect(byKey).toMatchObject({ services: 'incomplete', availability: 'incomplete', portfolio: 'incomplete' });
    expect(r.completeCount).toBe(1); // only verification
    expect(r.isLive).toBe(false);
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
      verification,
    });
    const v = r.items.find((i) => i.key === 'verification');
    expect(v?.state).toBe(expected);
  });

  it('a pending verification never counts as complete and is not "live"', () => {
    const r = deriveProfileReadiness({
      serviceCount: 1,
      availabilityCount: 1,
      portfolioCount: 1,
      verification: 'pending',
    });
    expect(r.completeCount).toBe(3);
    expect(r.isLive).toBe(false);
  });
});

describe('fetchDashboardView', () => {
  const mockRequests = fetchOwnRequestsView as jest.Mock;
  const mockServices = listOwnServices as jest.Mock;
  const mockAvailability = listOwnAvailability as jest.Mock;
  const mockPortfolio = listOwnPortfolio as jest.Mock;
  const mockProfile = fetchOwnBarberProfile as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequests.mockResolvedValue({
      status: 'ok',
      bookings: [booking({ id: 'a1', status: 'accepted', date: '2026-07-15' }), booking({ id: 'p1', status: 'pending' })],
      servicesById: new Map([['s1', service({})]]),
      counterpartsByBookingId: new Map(),
    });
    mockServices.mockResolvedValue({ status: 'ok', services: [service({})] });
    mockAvailability.mockResolvedValue({ status: 'ok', windows: [{ id: 'w1' }] });
    mockPortfolio.mockResolvedValue({ status: 'ok', images: [{ id: 'img1' }] });
    mockProfile.mockResolvedValue({ status: 'ok', profile: { verification_status: 'approved' } });
  });

  it('composes overview + readiness + summary arrays when every read succeeds', async () => {
    const view = await fetchDashboardView('brb1');
    expect(view.overview.pendingCount).toBe(1);
    expect(view.overview.nextAppointment?.booking.id).toBe('a1');
    expect(view.services).toHaveLength(1);
    expect(view.windows).toHaveLength(1);
    expect(view.verification).toBe('approved');
    expect(view.readiness.isLive).toBe(true);
  });

  it('degrades to an empty overview when the bookings read fails, without failing the dashboard', async () => {
    mockRequests.mockResolvedValue({ status: 'error', code: 'network', message: 'x' });
    const view = await fetchDashboardView('brb1');
    expect(view.overview).toEqual({ pendingCount: 0, upcomingCount: 0, nextAppointment: null });
    // readiness still derives from the other (successful) reads
    expect(view.readiness.items.find((i) => i.key === 'services')?.state).toBe('complete');
  });

  it('degrades per-field: a failed services read empties services and marks that item incomplete', async () => {
    mockServices.mockResolvedValue({ status: 'error', code: 'network', message: 'x' });
    const view = await fetchDashboardView('brb1');
    expect(view.services).toEqual([]);
    expect(view.readiness.items.find((i) => i.key === 'services')?.state).toBe('incomplete');
  });

  it('treats a failed profile read as unknown verification (in_progress, never a fault)', async () => {
    mockProfile.mockResolvedValue({ status: 'error', code: 'network', message: 'x' });
    const view = await fetchDashboardView('brb1');
    expect(view.verification).toBeNull();
    expect(view.readiness.items.find((i) => i.key === 'verification')?.state).toBe('in_progress');
  });
});
