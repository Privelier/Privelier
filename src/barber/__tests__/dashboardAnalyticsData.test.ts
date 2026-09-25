import { supabase } from '../../../lib/supabase';
import { fetchDashboardAnalytics } from '../dashboardAnalyticsData';

jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockRpc = supabase.rpc as jest.Mock;

function rpcPayload(overrides: Record<string, unknown> = {}) {
  return {
    completed_week: 0,
    completed_month: 0,
    completed_all_time: 0,
    booked_value_week: 0,
    booked_value_month: 0,
    booked_value_all_time: 0,
    pending_count: 0,
    upcoming_count: 0,
    next_appointment: null,
    weekly_trend: Array.from({ length: 8 }, (_, index) => ({
      week_start: `2026-08-${String(index + 1).padStart(2, '0')}`,
      completed_cuts: 0,
      booked_value: 0,
    })),
    rating_average: null,
    review_count: 0,
    repeat_customer_count: 0,
    top_services: [],
    busiest_weekday: null,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('fetchDashboardAnalytics', () => {
  it('uses the aggregate RPC and parses intentional zero-booking values', async () => {
    mockRpc.mockResolvedValue({ data: rpcPayload(), error: null });
    const result = await fetchDashboardAnalytics();
    expect(mockRpc).toHaveBeenCalledWith('get_barber_dashboard_analytics');
    expect(result).toMatchObject({
      status: 'ok',
      data: {
        completedAllTime: 0,
        bookedValueAllTime: 0,
        weeklyTrend: expect.arrayContaining([{ weekStart: '2026-08-01', completedCuts: 0, bookedValue: 0 }]),
        ratingAverage: null,
        reviewCount: 0,
        nextAppointment: null,
        topServices: [],
        busiestWeekday: null,
      },
    });
  });

  it('parses only aggregate summaries and the next appointment display fields', async () => {
    mockRpc.mockResolvedValue({
      data: rpcPayload({
        completed_month: 7,
        booked_value_month: 280,
        next_appointment: { date: '2026-09-30', time: '12:30:00', customer_name: 'Sam', service_name: 'Fade' },
        rating_average: 4.75,
        review_count: 4,
        repeat_customer_count: 2,
        top_services: [{ name: 'Fade', completed_cuts: 5, booked_value: 200 }],
        busiest_weekday: { weekday: 'Friday', completed_cuts: 3 },
      }),
      error: null,
    });
    await expect(fetchDashboardAnalytics()).resolves.toMatchObject({
      status: 'ok',
      data: {
        completedMonth: 7,
        bookedValueMonth: 280,
        nextAppointment: { customerName: 'Sam', serviceName: 'Fade' },
        ratingAverage: 4.75,
        topServices: [{ name: 'Fade', completedCuts: 5 }],
        busiestWeekday: { weekday: 'Friday' },
      },
    });
  });

  it('returns a retryable failure for RPC errors and rejects malformed aggregates', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'network request failed' } });
    await expect(fetchDashboardAnalytics()).resolves.toMatchObject({ status: 'error', code: 'network', retryable: true });
    mockRpc.mockResolvedValueOnce({ data: { completed_week: -1 }, error: null });
    await expect(fetchDashboardAnalytics()).resolves.toMatchObject({ status: 'error', code: 'unknown' });
  });
});
