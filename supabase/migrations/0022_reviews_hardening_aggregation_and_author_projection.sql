-- Step 18 (reviews) — schema slice. THREE parts, one file, per the design gate
-- docs/design/step-18-reviews-design-approval.md (C1 Parts A/B/C). Grounded in
-- live DB inspection 2026-07-21, not assumptions.
--
-- WHAT THIS CLOSES AND ADDS:
--   Part A — hardens reviews_insert_own_customer so a review's barber attribution
--            is non-forgeable (today it is forgeable — proven live).
--   Part B — server-owned rating aggregation: an AFTER INSERT trigger recomputes
--            barber_profile.rating from the reviews table. This is the codebase's
--            FIRST write-side role-impersonation trigger; it is commented heavily.
--   Part C — get_review_authors RPC: projects ONLY the reviewer's first-name token
--            for reviews already readable by every authenticated caller.
--
-- SCOPE: one RLS policy replacement (reviews), one new trigger function + trigger
-- (reviews -> barber_profile), one new SECURITY DEFINER RPC. NO new tables, NO new
-- columns, NO data migration, NO change to the booking or review state machines,
-- and — critically — NO weakening of protect_barber_verification_fields (0005).
-- Part B gets PAST that trigger only via a bounded, immediately-restored GUC
-- elevation, never by relaxing the guard.
--
-- LIVE STATE VERIFIED 2026-07-21 (measured, not assumed):
--   * reviews_insert_own_customer: for insert, to authenticated,
--     WITH CHECK (customer_id = auth.uid()) and nothing else. The completed-only
--     trigger enforce_review_requires_completed_booking() checks booking status
--     ONLY, never that customer_id/barber_id match the booking's participants —
--     so a customer can review their OWN completed booking but attribute it to an
--     ARBITRARY uninvolved barber (rolled-back probe as a real authenticated
--     session). Harmless today (rating is unwritable), a public-rating-poisoning
--     vector the instant Part B ships. Same class as 0010's price/attribution fix.
--   * barber_profile.rating is numeric(3,2) (precision 3, scale 2, default 0,
--     max 5.00), protected by protect_barber_verification_fields() (0005), which
--     reverts rating to OLD unless auth.role() = 'service_role'.
--   * has_role(target_role user_role) is the existing SECURITY DEFINER helper;
--     has_role('customer') casts the literal to user_role cleanly.
--
-- IDEMPOTENT / RE-RUNNABLE: the policy uses drop-then-create (0014/0015 idiom);
-- CREATE OR REPLACE FUNCTION is natively re-runnable; the trigger is dropped-then-
-- created; the RPC is CREATE OR REPLACE with an explicit revoke/grant (0012 idiom).

-- ============================================================
-- Part A. reviews_insert_own_customer — make barber attribution non-forgeable.
--
--    TODAY the WITH CHECK asserts only customer_id = auth.uid(). The row's
--    barber_id is completely unconstrained, so a caller may post against their
--    own completed booking while naming any barber in the system. The completed-
--    only BEFORE INSERT trigger does not help — it reads the booking's status but
--    never compares the review's participants to the booking's participants.
--
--    The replacement ties the row to a booking the caller actually owns AND whose
--    barber_id/customer_id equal the row's, and folds the completed-status check
--    into the same EXISTS (the 0009/0010 EXISTS-predicate guard style):
--      * customer_id = auth.uid()      — unchanged; blocks posting as someone else.
--      * has_role('customer')          — mirrors 0004 Fix 2; without it a barber
--                                        who sets customer_id to their own uid
--                                        would otherwise pass. Absent on reviews
--                                        until now.
--      * EXISTS(booking with matching id, customer_id, barber_id, completed)
--                                        — the booking's existence IS the
--                                        authorization: the reviewer must have
--                                        been the customer on a completed booking
--                                        WITH THIS BARBER. Non-forgeable.
--
--    DELIBERATELY NOT approval/barber_directory-gated: a legitimate review of a
--    barber who has since been unapproved must still be allowed. Current approval
--    state is not the authorization — the completed booking is.
--
--    enforce_review_requires_completed_booking() (0001) is LEFT IN PLACE: the
--    EXISTS now covers the status check too, but the trigger is defence in depth
--    and raises a clearer, review-specific error string. Do not drop it.
--
--    Policy stays `for insert to authenticated` (0006 set the role). The
--    drop-then-create re-asserts `to authenticated` explicitly so the whole rule
--    reads from this one file.
-- ============================================================

drop policy if exists "reviews_insert_own_customer" on public.reviews;
create policy "reviews_insert_own_customer"
  on public.reviews for insert
  to authenticated
  with check (
    customer_id = auth.uid()
    and public.has_role('customer')
    and exists (
      select 1 from public.bookings b
      where b.id = reviews.booking_id
        and b.customer_id = reviews.customer_id
        and b.barber_id  = reviews.barber_id
        and b.status = 'completed'
    )
  );

-- ============================================================
-- Part B. Rating aggregation — AFTER INSERT on reviews, writing
--    barber_profile.rating via BOUNDED role impersonation.
--
--    AFTER INSERT ONLY. D3 makes reviews immutable (no UPDATE/DELETE surface),
--    so there is nothing to recompute on update/delete — those arms are
--    deliberately absent; a future editability change would revisit this.
--
--    WHY THE ROW IS INCLUDED IN THE AVERAGE: this is a row-level AFTER INSERT
--    trigger. Postgres inserts the new row into the reviews heap BEFORE AFTER-row
--    triggers fire, so the aggregate subquery `avg(rating) ... where barber_id =
--    new.barber_id` sees the just-inserted row and the new average already
--    reflects it. (Were this a BEFORE trigger, the row would not yet be visible
--    and we would have to fold NEW.rating in by hand. It is not — AFTER is
--    correct precisely because it needs the committed-to-heap row.)
--
--    THE OBSTACLE — protect_barber_verification_fields() (0005): a BEFORE
--    INSERT/UPDATE SECURITY DEFINER trigger on barber_profile that reverts
--    `rating` (and verified/verification_status) to OLD for any caller whose
--    auth.role() is not 'service_role'. A review is inserted by an ordinary
--    authenticated CUSTOMER, so this AFTER trigger runs in that customer's role
--    context — and its UPDATE of barber_profile.rating would be silently reverted.
--
--    WHY SECURITY DEFINER ALONE IS NOT ENOUGH: SECURITY DEFINER changes the
--    executing DATABASE role (to this function's owner), but auth.role() does NOT
--    read the database role — it reads the request.jwt.claim.role GUC, which
--    SECURITY DEFINER never touches. So the protect trigger would still see the
--    customer's JWT role and revert. To be seen as service_role by that guard we
--    must set the GUC itself.
--
--    WHY IT IS BOUNDED AND RESTORED IMMEDIATELY: elevating request.jwt.claim.role
--    to 'service_role' means, for the duration of that setting, RLS and every
--    `auth.role() = 'service_role'` guard in the schema treat the caller as the
--    master role. That is a large privilege and must wrap EXACTLY the one UPDATE.
--    We stash the incoming value, elevate, run the single UPDATE, then restore the
--    stashed value on the very next statement — we do NOT lean on is_local's
--    transaction-end reset, because the INSERT that fired this trigger continues
--    afterwards (and could fire further triggers) within the same transaction, and
--    none of that remainder should run elevated.
--
--    ON FAILURE OF THE UPDATE: if the UPDATE raises, control leaves this function
--    by exception without reaching the restore line — but that exception aborts
--    the INSERT's (sub)transaction, and set_config(..., is_local => true) is itself
--    transactional, so the elevation is rolled back with everything else. The
--    elevation therefore cannot leak on the error path either. (There is no
--    BEGIN/EXCEPTION handler here that could swallow the error and then continue
--    elevated in the same transaction — deliberately.)
--
--    SERVER-OWNED AGGREGATE: rating is written ONLY here. No client ever writes it
--    — protect_barber_verification_fields keeps client writes reverted, and the
--    data layer (C4) never touches barber_profile. round(avg(rating)::numeric, 2)
--    matches numeric(3,2) exactly and cannot overflow (max possible avg is 5.00).
--    coalesce(..., 0) is belt-and-braces: an AFTER INSERT always has >= 1 row so
--    avg() is never NULL here, but 0 is the correct "no reviews" floor regardless.
-- ============================================================

create or replace function public.recompute_barber_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  stashed_role text;
begin
  -- Stash the caller's JWT role (may be NULL if the GUC is unset).
  stashed_role := current_setting('request.jwt.claim.role', true);

  -- Elevate ONLY to satisfy protect_barber_verification_fields()'s
  -- service_role check. is_local => true scopes this to the current transaction.
  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- The single privileged write. The AFTER-INSERT row is already in the heap,
  -- so this average includes the review that fired the trigger.
  update public.barber_profile
     set rating = (
       select coalesce(round(avg(rating)::numeric, 2), 0)
       from public.reviews
       where barber_id = new.barber_id
     )
   where user_id = new.barber_id;

  -- Restore immediately — bound the elevation to exactly the UPDATE above.
  -- Restore to the stashed value, or to '' when it was unset (auth.role()
  -- treats '' as "not service_role", so the protect guard is re-armed).
  perform set_config('request.jwt.claim.role', coalesce(stashed_role, ''), true);

  return new;
end;
$function$;

drop trigger if exists trg_recompute_barber_rating on public.reviews;
create trigger trg_recompute_barber_rating
  after insert on public.reviews
  for each row execute function public.recompute_barber_rating();

-- Trigger function only; never meant to be callable via the PostgREST RPC
-- endpoint (revoking EXECUTE does not affect trigger firing — same rationale as
-- 0002/0005). Kept off public/anon/authenticated so no client can invoke the
-- privileged body directly.
revoke execute on function public.recompute_barber_rating() from public, anon, authenticated;

-- ============================================================
-- Part C. get_review_authors — reviewer first-name projection RPC.
--
--    Cloned from get_booking_counterparts (0012): language sql, stable, security
--    definer, pinned search_path, EXECUTE revoked from public/anon and granted
--    only to authenticated.
--
--    Returns ONLY the reviewer's FIRST-NAME TOKEN — split_part(u.name, ' ', 1),
--    never the full name. Migration 0006 deliberately hid users.name from
--    cross-user joins; D2 authorized first-name-only display and nothing more.
--
--    NO auth.uid() filter — and that is deliberate, NOT an oversight (contrast
--    get_booking_counterparts, which MUST self-scope because it exposes rows the
--    caller could not otherwise read). Here reviews_select_all already exposes
--    EVERY review row to EVERY authenticated caller. This RPC does not widen WHICH
--    ROWS are visible; it only widens WHICH COLUMN (the reviewer's first name) is
--    visible for rows already readable — exactly the projection D2 authorized. A
--    caller can already read reviews.customer_id for these rows; this maps it to a
--    first name without exposing email/phone/city/country/role/full name.
--
--    KNOWN/ACCEPTED ADVISOR WARN: like get_barber_busy_slots (0009) and
--    get_booking_counterparts (0012), a SECURITY DEFINER function reachable by
--    authenticated raises the standard advisor WARN. Expected and pre-accepted —
--    same documented pattern, not a new finding.
-- ============================================================

create or replace function public.get_review_authors(p_review_ids uuid[])
returns table (review_id uuid, first_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    r.id as review_id,
    split_part(u.name, ' ', 1) as first_name
  from public.reviews r
  join public.users u
    on u.id = r.customer_id
  where r.id = any(p_review_ids);
$function$;

-- Postgres grants EXECUTE to PUBLIC by default at creation; revoke it and grant
-- only to authenticated, mirroring get_booking_counterparts (0012).
revoke execute on function public.get_review_authors(uuid[]) from public, anon;
grant execute on function public.get_review_authors(uuid[]) to authenticated;
