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
