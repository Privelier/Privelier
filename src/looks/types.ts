/**
 * Looks domain types (migrations 0063 to 0065). Mirrors the columns the app
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

/** Which look a booking was made for (look_references, 0065). */
export interface LookReference {
  booking_id: string;
  look_id: string | null;
  style: string;
}
