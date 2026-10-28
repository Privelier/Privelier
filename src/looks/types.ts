/**
 * Looks domain types (migrations 0063 and 0064). Mirrors the columns the app
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
