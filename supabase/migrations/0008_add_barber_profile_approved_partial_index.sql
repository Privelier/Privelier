-- Fix (database-optimizer finding, Stage 10 closeout of the Step 9-10
-- customer-discovery pipeline run): barber_profile.verification_status has
-- no supporting index anywhere in the schema (0001-0007). That column is now
-- on the hot path for every customer-facing read this pipeline run added:
--   - public.barber_directory (view, filters verification_status = 'approved')
--   - services_select_own_or_approved (0007) -- exists-subquery on
--     barber_profile.verification_status = 'approved' per services row
--   - availability_select_own_or_approved (0007) -- same pattern
-- Every one of these is a Seq Scan over barber_profile today, on the home
-- list / profile lookup / services list -- the first customer-facing screens
-- this app has shipped.
--
-- Fix: a partial index on (user_id) filtered to verification_status =
-- 'approved'. Deliberately not a plain index on verification_status alone --
-- the query pattern everywhere above is "look up this specific barber_id and
-- check they're approved" (an equality lookup on user_id, gated by the
-- approved predicate), never "list all rows by status". A partial index
-- also stays small at MVP scale since most barbers won't be approved yet,
-- unlike a full index on every row regardless of status.
--
-- Scoped to exactly this one index per CLAUDE.md's "one feature per
-- pipeline run" / "schema is sacred" rules -- no table, policy, grant, or
-- column touched.

create index if not exists idx_barber_profile_approved
  on public.barber_profile (user_id)
  where verification_status = 'approved'::verification_status_type;
