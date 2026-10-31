/**
 * The customer's own Account stats: completed cuts, distinct barbers and the
 * average rating they have given. Both reads are RLS-scoped to the signed-in
 * customer and bounded; the strip is auxiliary, so any failure returns null
 * and the strip stays hidden instead of showing a wrong number.
 */
import { supabase } from '../../lib/supabase';
import { logCustomerDataError } from './errors';

export interface AccountStats {
  cuts: number;
  barbers: number;
  /** Mean of the ratings this customer gave, or null before the first review. */
  averageRating: number | null;
}

const ROW_CAP = 300;

export async function fetchOwnAccountStats(customerId: string): Promise<AccountStats | null> {
  const [bookings, reviews] = await Promise.all([
    supabase.from('bookings').select('barber_id').eq('customer_id', customerId).eq('status', 'completed').limit(ROW_CAP),
    supabase.from('reviews').select('rating').eq('customer_id', customerId).limit(ROW_CAP),
  ]);
  if (bookings.error || reviews.error) {
    logCustomerDataError('fetchOwnAccountStats', bookings.error ?? reviews.error);
    return null;
  }
  const completed = (bookings.data ?? []) as { barber_id: string | null }[];
  const ratings = ((reviews.data ?? []) as { rating: number }[]).map((r) => r.rating);
  return {
    cuts: completed.length,
    barbers: new Set(completed.flatMap((b) => (b.barber_id ? [b.barber_id] : []))).size,
    averageRating: ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null,
  };
}
