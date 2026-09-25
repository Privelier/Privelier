import { supabase } from '../../lib/supabase';
import { failure, mapPostgrestError, type BarberDataFailure } from './errors';
import type { BarberDashboardAnalytics } from './types';

export type FetchDashboardAnalyticsResult =
  | { status: 'ok'; data: BarberDashboardAnalytics }
  | BarberDataFailure;

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
const amount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const nullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function parseAnalytics(value: unknown): BarberDashboardAnalytics | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const completedWeek = count(row.completed_week);
  const completedMonth = count(row.completed_month);
  const completedAllTime = count(row.completed_all_time);
  const bookedValueWeek = amount(row.booked_value_week);
  const bookedValueMonth = amount(row.booked_value_month);
  const bookedValueAllTime = amount(row.booked_value_all_time);
  const pendingCount = count(row.pending_count);
  const upcomingCount = count(row.upcoming_count);
  const reviewCount = count(row.review_count);
  const repeatCustomerCount = count(row.repeat_customer_count);
  const ratingAverage = row.rating_average === null ? null : amount(row.rating_average);
  if ([completedWeek, completedMonth, completedAllTime, bookedValueWeek, bookedValueMonth,
    bookedValueAllTime, pendingCount, upcomingCount, reviewCount, repeatCustomerCount].includes(null)) return null;
  if (!Array.isArray(row.weekly_trend) || !Array.isArray(row.top_services)) return null;

  const weeklyTrend = row.weekly_trend.map((item) => {
    if (typeof item !== 'object' || item === null) return null;
    const week = item as Record<string, unknown>;
    const completedCuts = count(week.completed_cuts);
    const bookedValue = amount(week.booked_value);
    if (typeof week.week_start !== 'string' || completedCuts === null || bookedValue === null) return null;
    return { weekStart: week.week_start, completedCuts, bookedValue };
  });
  const topServices = row.top_services.map((item) => {
    if (typeof item !== 'object' || item === null) return null;
    const service = item as Record<string, unknown>;
    const completedCuts = count(service.completed_cuts);
    const bookedValue = amount(service.booked_value);
    if (typeof service.name !== 'string' || completedCuts === null || bookedValue === null) return null;
    return { name: service.name, completedCuts, bookedValue };
  });
  if (weeklyTrend.some((item) => item === null) || topServices.some((item) => item === null)) return null;

  let nextAppointment: BarberDashboardAnalytics['nextAppointment'] = null;
  if (row.next_appointment !== null) {
    if (typeof row.next_appointment !== 'object' || Array.isArray(row.next_appointment)) return null;
    const appointment = row.next_appointment as Record<string, unknown>;
    if (typeof appointment.date !== 'string' || typeof appointment.time !== 'string') return null;
    nextAppointment = {
      date: appointment.date,
      time: appointment.time,
      customerName: nullableString(appointment.customer_name),
      serviceName: nullableString(appointment.service_name),
    };
  }

  let busiestWeekday: BarberDashboardAnalytics['busiestWeekday'] = null;
  if (row.busiest_weekday !== null) {
    if (typeof row.busiest_weekday !== 'object' || Array.isArray(row.busiest_weekday)) return null;
    const day = row.busiest_weekday as Record<string, unknown>;
    const completedCuts = count(day.completed_cuts);
    if (typeof day.weekday !== 'string' || completedCuts === null) return null;
    busiestWeekday = { weekday: day.weekday, completedCuts };
  }

  if (row.rating_average !== null && ratingAverage === null) return null;
  return {
    completedWeek: completedWeek!, completedMonth: completedMonth!, completedAllTime: completedAllTime!,
    bookedValueWeek: bookedValueWeek!, bookedValueMonth: bookedValueMonth!, bookedValueAllTime: bookedValueAllTime!,
    pendingCount: pendingCount!, upcomingCount: upcomingCount!, nextAppointment,
    weeklyTrend: weeklyTrend as BarberDashboardAnalytics['weeklyTrend'],
    ratingAverage, reviewCount: reviewCount!, repeatCustomerCount: repeatCustomerCount!,
    topServices: topServices as BarberDashboardAnalytics['topServices'], busiestWeekday,
  };
}

/** Returns aggregate analytics only; raw booking rows never leave Postgres. */
export async function fetchDashboardAnalytics(): Promise<FetchDashboardAnalyticsResult> {
  const { data, error } = await supabase.rpc('get_barber_dashboard_analytics');
  if (error) return mapPostgrestError('fetchDashboardAnalytics', error);
  const analytics = parseAnalytics(data);
  return analytics ? { status: 'ok', data: analytics } : failure('unknown');
}
