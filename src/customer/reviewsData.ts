/**
 * Customer reviews data layer (build-order step 18).
 *
 * WRITE — submitReview inserts into `public.reviews` ONLY. It NEVER touches
 * `barber_profile`: the rating aggregate is server-owned, recomputed by the
 * AFTER INSERT trigger `trg_recompute_barber_rating` (migration 0022), and any
 * client write to `barber_profile.rating` is reverted by
 * `protect_barber_verification_fields` anyway. Authorization is entirely RLS:
 * the hardened `reviews_insert_own_customer` (0022) requires customer_id =
 * auth.uid(), the customer role, and a matching completed booking with this
 * exact barber — so `customer_id` is read from the session here, never accepted
 * as a caller parameter (a spoofed value would just be rejected, a worse UX
 * than catching "no session" first — same rationale as bookingCreateData).
 *
 * READ — reviews are world-readable to authenticated callers
 * (`reviews_select_all`), but 0006 hides `users.name` from cross-user joins, so
 * the reviewer's FIRST NAME is projected separately via the get_review_authors
 * RPC (0022) and merged best-effort: a failed name lookup degrades to "no
 * name", never fails the list. Same batched-enrichment idiom as
 * discoveryData's service maps and the get_booking_counterparts usage.
 */
import { supabase } from '../../lib/supabase';
import type { ReviewRow } from '../types';
import {
  UNIQUE_VIOLATION,
  failure,
  logCustomerDataError,
  mapPostgrestError,
} from './errors';
import type {
  OwnReviewedBookingIdsResult,
  ReviewsForBarberResult,
  SubmitReviewResult,
} from './types';

/** Row shape returned by the get_review_authors RPC. */
interface ReviewAuthorRow {
  review_id: string;
  first_name: string | null;
}

/**
 * All reviews for a barber (newest first) plus a best-effort first-name map.
 * The reviews read failing fails the whole call; the name projection degrades
 * to an empty map (every review then renders name-less, which is honest).
 */
export async function fetchReviewsForBarber(barberId: string): Promise<ReviewsForBarberResult> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('barber_id', barberId)
    .order('created_at', { ascending: false });

  if (error) return mapPostgrestError('fetchReviewsForBarber', error);
  const reviews = (data as ReviewRow[]) ?? [];

  const firstNameByReviewId = new Map<string, string>();
  if (reviews.length > 0) {
    const { data: authors, error: authorsError } = await supabase.rpc('get_review_authors', {
      p_review_ids: reviews.map((r) => r.id),
    });
    if (authorsError) {
      // Enrichment only — log and carry on with no names.
      logCustomerDataError('fetchReviewsForBarber.authors', authorsError);
    } else {
      for (const row of (authors as ReviewAuthorRow[]) ?? []) {
        const name = (row.first_name ?? '').trim();
        if (name) firstNameByReviewId.set(row.review_id, name);
      }
    }
  }

  return { status: 'ok', reviews, firstNameByReviewId };
}

/**
 * Of the given completed-booking ids, which the signed-in customer has already
 * reviewed — so the Bookings tab can branch "Leave a review" vs "Reviewed".
 * Filtered by customer_id = the session user AND booking_id in the batch, so
 * the round trip stays bounded by what the tab is showing. An empty input set
 * short-circuits (no query, empty result).
 */
export async function fetchOwnReviewedBookingIds(
  bookingIds: string[]
): Promise<OwnReviewedBookingIdsResult> {
  if (bookingIds.length === 0) {
    return { status: 'ok', reviewedBookingIds: new Set<string>() };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    logCustomerDataError('fetchOwnReviewedBookingIds.getUser', userError);
    return failure('unknown');
  }
  const customerId = userData.user?.id;
  if (!customerId) return failure('forbidden');

  const { data, error } = await supabase
    .from('reviews')
    .select('booking_id')
    .eq('customer_id', customerId)
    .in('booking_id', bookingIds);

  if (error) return mapPostgrestError('fetchOwnReviewedBookingIds', error);
  const reviewedBookingIds = new Set<string>(
    ((data as { booking_id: string }[]) ?? []).map((r) => r.booking_id)
  );
  return { status: 'ok', reviewedBookingIds };
}

/**
 * Post a review for a completed booking. `comment` is optional (D4): an
 * empty/whitespace-only comment is stored as NULL. `rating` must be 1–5 (the
 * DB CHECK is the backstop; the picker never offers anything else). barber_id
 * is supplied by the caller from the booking being reviewed, but it is NOT
 * trusted — the 0022 RLS predicate rejects any (booking, customer, barber)
 * triple that is not a real completed booking of this customer with this
 * barber. A 23505 means this booking already has a review (booking_id UNIQUE)
 * and surfaces as 'already_reviewed'; every other error goes through the mapper
 * (the RLS rejection lands as 42501 -> 'forbidden').
 */
export async function submitReview(input: {
  bookingId: string;
  barberId: string;
  rating: number;
  comment: string;
}): Promise<SubmitReviewResult> {
  const comment = input.comment.trim();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    logCustomerDataError('submitReview.getUser', userError);
    return failure('unknown');
  }
  const customerId = userData.user?.id;
  if (!customerId) return failure('forbidden');

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      booking_id: input.bookingId,
      customer_id: customerId,
      barber_id: input.barberId,
      rating: input.rating,
      comment: comment === '' ? null : comment,
    })
    .select()
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: 'already_reviewed' };
    return mapPostgrestError('submitReview', error);
  }
  return { status: 'ok', review: data as ReviewRow };
}
