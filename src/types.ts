/**
 * Roles a client is ever allowed to self-select or self-provision.
 * The app never creates admin users — founder/admin rows are created only
 * by the founders via the Supabase dashboard (see migration 0005).
 */
export type Role = 'customer' | 'barber';

/**
 * Full `user_role` Postgres enum. A row fetched from `users` can carry
 * 'admin' (the founders), so reads are typed wider than writes.
 */
export type UserRole = Role | 'admin';

/** `verification_status_type` Postgres enum. */
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

/**
 * Row shape of `public.users` (see supabase/migrations/0001_init_schema.sql).
 * `role`, `email` and `created_at` are server-owned after creation: a
 * BEFORE UPDATE trigger (migration 0005) silently reverts client changes.
 */
export interface UsersRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  city: string | null;
  country: string | null;
  profile_image: string | null;
  created_at: string;
}

/**
 * Row shape of `public.barber_profile`. `rating`, `verified` and
 * `verification_status` are admin-owned: a BEFORE INSERT/UPDATE trigger
 * (migration 0005) forces/reverts them for app clients. Never write them.
 */
export interface BarberProfileRow {
  id: string;
  user_id: string;
  bio: string | null;
  rating: number;
  verified: boolean;
  verification_status: VerificationStatus;
}

/**
 * Row shape of `public.services` (see supabase/migrations/0001_init_schema.sql).
 * Writes are gated by RLS (`services_write_own`) to `barber_id = auth.uid()`
 * with the barber role; reads are public to any authenticated caller.
 */
export interface ServiceRow {
  id: string;
  barber_id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

/**
 * Row shape of `public.availability`. Exactly one of `day_of_week` /
 * `specific_date` is set (enforced by `chk_availability_day_or_date`), and
 * `start_time < end_time` is enforced by `chk_availability_time_order`.
 * Writes are gated by RLS (`availability_write_own`) the same way as services.
 */
export interface AvailabilityRow {
  id: string;
  barber_id: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
}

/** `booking_status` Postgres enum — the authoritative state machine's states. */
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

/**
 * Row shape of `public.bookings`. `price` is a snapshot taken at booking
 * time (never read live from SERVICES); `date` is a DATE string
 * (YYYY-MM-DD) and `time` a TIME string (HH:MM:SS). Reads are gated by RLS
 * (`bookings_select_participants`) to the booking's own customer/barber.
 */
export interface BookingRow {
  id: string;
  customer_id: string;
  barber_id: string;
  service_id: string;
  date: string;
  time: string;
  location: string;
  price: number;
  status: BookingStatus;
  created_at: string;
}

/**
 * Row shape of `public.portfolio`. Hard constraint: max 6 rows per
 * barber_id (DB-enforced). Reads are open to authenticated callers
 * (`portfolio_select_all`); writes are owner+barber-role only
 * (`portfolio_write_own`).
 */
export interface PortfolioRow {
  id: string;
  barber_id: string;
  image_url: string;
}

/**
 * Row shape of `public.verification_requests` — barber-submitted ID +
 * license images for MANUAL founder review (no selfie, no biometrics —
 * hard rule). Reads gated by RLS (`verification_requests_select_own`);
 * `status`/`reviewed_by`/`reviewed_at` are set by the reviewing admin.
 */
export interface VerificationRequestRow {
  id: string;
  user_id: string;
  id_image_url: string | null;
  license_image_url: string | null;
  status: VerificationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

/**
 * Row shape of `public.chat_rooms` — one room per booking. Note: no
 * created_at column exists; a room's "age" is its booking's date or its
 * latest message. Reads gated by RLS (`chat_rooms_select_participants`).
 */
export interface ChatRoomRow {
  id: string;
  booking_id: string;
  customer_id: string;
  barber_id: string;
}

/**
 * Row shape of `public.messages` (Realtime-enabled; live subscriptions are
 * build-order step 15-16). Reads gated by RLS
 * (`messages_select_participants` via the parent room).
 */
export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

/**
 * Row shape of `public.barber_directory` (see migration
 * 0006_require_authenticated_discovery_and_lock_users_columns.sql). This
 * view is the ONLY discovery surface: a hand-picked, non-sensitive column
 * projection over `users` joined to `barber_profile`, pre-filtered to
 * `verification_status = 'approved'`. It deliberately has no email, phone,
 * created_at, or verification_status column — do not add one here without a
 * matching, deliberate schema change.
 *
 * `rating` is currently always the unmodified default: no review-aggregation
 * exists yet (build-order step 18). Treating `rating === 0` as "no ratings
 * yet" is a UI-layer decision, not something this row shape special-cases.
 */
export interface BarberDirectoryRow {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  profile_image: string | null;
  bio: string | null;
  rating: number;
}
