/**
 * Looks domain types (migrations 0063 to 0066). Mirrors the columns the app
 * reads; every write goes through a server function.
 */
type LookStatus = 'draft' | 'confirmed' | 'published' | 'declined' | 'withdrawn';

export type LookVerdict = 'exact' | 'close' | 'miss';

export interface LookStyle {
  key: string;
  label_en: string;
  label_de: string;
  sort_order: number;
}

export interface LookPhoto {
  id: string;
  look_id: string;
  storage_path: string;
  position: number;
}

export interface Look {
  id: string;
  booking_id: string;
  barber_id: string;
  customer_id: string;
  service_id: string | null;
  styles: string[];
  status: LookStatus;
  no_face_confirmed: boolean;
  submitted_at: string | null;
  responded_at: string | null;
  consented_at: string | null;
  created_at: string;
  look_photos: LookPhoto[];
}

export interface BarberLookStat {
  style: string;
  label_en: string;
  label_de: string;
  feedback_count: number;
  exact_count: number;
  close_count: number;
  /** null below the founders' minimum count (L6). */
  hit_rate: number | null;
  proof_count: number;
}

/** One published look in the feed or its detail (looks_feed, 0065). */
export interface FeedLook {
  look_id: string;
  barber_id: string;
  barber_name: string | null;
  barber_image: string | null;
  barber_rating: number | null;
  styles: string[];
  service_id: string | null;
  service_name: string | null;
  service_price: number | null;
  service_duration: number | null;
  published_at: string;
  review_rating: number | null;
  arrival_confirmed: boolean;
  proof_count: number;
  photo_paths: string[];
}

/** Which look a booking was made for (look_references, 0065; photo 0066). */
export interface LookReference {
  booking_id: string;
  /** Null when the booking came from a look search, not a feed look. */
  look_id: string | null;
  style: string;
  /** The client's private reference photo in `look-references` (0066). */
  photo_path?: string | null;
}

/** One instant match for a look search (match_look, 0066). Never a location. */
export interface LookMatch {
  barber_id: string;
  barber_name: string | null;
  barber_image: string | null;
  barber_rating: number | null;
  proof_count: number;
  feedback_count: number;
  hit_rate: number | null;
  service_id: string;
  service_name: string;
  service_price: number;
  service_duration: number;
  /** 'HH:MM:SS', the barber's local wall-clock time like every booking. */
  first_free_time: string;
}
