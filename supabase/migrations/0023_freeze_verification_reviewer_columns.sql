-- Freeze public.verification_requests.reviewed_by / reviewed_at against client
-- (non-service_role) writes. Same class of finding as the three 0021 closed and
-- the price/attribution vector 0010 closed: a column whose integrity today rests
-- on something OTHER than a rule that says so. This migration moves the two
-- reviewer/audit columns from "safe by accident" to "safe by rule".
--
-- WHAT THESE COLUMNS ARE: reviewed_by (the founder uuid who actioned the
-- request) and reviewed_at (when). Together they are the audit trail of the
-- MANUAL verification queue — the legal safeguard behind CLAUDE.md's manual-only
-- verification rule. They are meant to be written EXCLUSIVELY by a founder review
-- path (dashboard / future admin RPC / Edge Function), which runs as
-- service_role. The app never writes them: src/barber/verificationData.ts's
-- submitVerificationDocument sends ONLY user_id + one image column, and its
-- header documents that status/reviewed_by/reviewed_at are DB-owned.
--
-- THE HOLE, PRECISELY (two paths, different current reachability):
--
--   * UPDATE path — LATENT today. `authenticated` holds column-level UPDATE on
--     ONLY (id_image_url, license_image_url) (0015 §6 revoked the table-level
--     UPDATE and replaced it with that column grant), so an UPDATE naming
--     reviewed_by dies 42501 at the privilege layer before RLS or any trigger is
--     consulted. That is a GRANT, not a rule. Postgres's 42501 HINT on that
--     failure literally reads `GRANT UPDATE ON public.verification_requests TO
--     authenticated` — and 0020's header records that this exact wrong fix was
--     already attempted once from that hint. If anyone ever follows it again, a
--     barber could UPDATE their own pending/rejected row to set reviewed_by =
--     <a founder's uuid> + reviewed_at = now() while leaving status untouched.
--     0021 §1 pinned `status` in the UPDATE policy's WITH CHECK, which stops
--     self-APPROVAL — but it deliberately does NOT pin reviewed_by/reviewed_at,
--     and RLS structurally cannot express "this column may not change" (WITH
--     CHECK sees only the NEW row, never OLD, so it cannot compare). The row
--     would then read as "reviewed-and-bounced by named founder X" — corruption
--     of the manual review queue even though status never moved.
--
--   * INSERT path — REACHABLE TODAY, not merely latent. `authenticated` still
--     holds table-level INSERT (0001 granted it; 0006 revoked only anon's; 0015
--     §6 touched only UPDATE), and verification_requests_insert_own's WITH CHECK
--     constrains only user_id = auth.uid(), not which columns are supplied. So a
--     raw-API caller can today INSERT their OWN fresh row seeding reviewed_by /
--     reviewed_at with arbitrary values. The 0015 re-queue trigger forces
--     status := 'pending' on a non-service_role INSERT, so they cannot
--     self-approve — but nothing stops the reviewer columns being seeded, so the
--     brand-new row can already read as "reviewed by founder X, bounced to
--     pending". This migration closes that live vector as well as the latent
--     UPDATE one.
--
-- WHY A TRIGGER AND NOT THE RLS POLICY (deliberate layer choice, same reasoning
-- the 0021 architect note recorded for why it stopped at `status`):
--   * RLS cannot express column immutability at all — WITH CHECK has no access
--     to OLD, so "reviewed_by may not change from its previous value" is
--     inexpressible as a policy. A BEFORE trigger, which sees both OLD and NEW,
--     is the only layer that can.
--   * Even the INSERT-null-forcing must NOT go in the policy: pinning
--     reviewed_by/reviewed_at in WITH CHECK would bind the FOUNDERS' own writes
--     too if the manual-review path ever moves off service_role onto an
--     authenticated admin session (a possibility the tracked "single-approval
--     RPC" item keeps open). A trigger with a service_role exemption freezes
--     client writes while leaving EVERY server-owned path free — the same shape
--     as requeue_verification_on_resubmit() (0015) and
--     enforce_booking_status_transition() (0011/0021).
--
-- DO NOT ADD A TABLE-LEVEL UPDATE GRANT ON public.verification_requests. This
-- trigger makes following the 42501 HINT no longer catastrophic for the reviewer
-- columns — it is NOT permission to follow it. The 0015 §6 column grant remains
-- the real guarantee for the UPDATE path; this is defence in depth beneath it.
--
-- SEPARATE FUNCTION, NOT A FOLD-IN (decision + firing-order analysis):
--   A new, single-purpose function public.freeze_verification_reviewer_columns()
--   plus its own BEFORE INSERT OR UPDATE trigger, rather than widening
--   requeue_verification_on_resubmit(). Reasons: (1) single responsibility —
--   requeue is about `status`; this is about the reviewer/audit columns; keeping
--   the requeue function's name honest matters for the next reader. (2) The two
--   BEFORE-ROW triggers mutate DISJOINT columns (this freezes reviewed_by /
--   reviewed_at; requeue sets status), so they cannot interfere regardless of
--   firing order. Postgres fires BEFORE-ROW triggers in ALPHABETICAL order of
--   trigger name: trg_freeze_verification_reviewer_columns sorts before
--   trg_requeue_verification_on_resubmit ('f' < 'r'), so freeze runs first — but
--   because the column sets are disjoint the order is immaterial to the result,
--   and each returns NEW for the next to see. (3) Re-runnability is cleaner: a
--   standalone CREATE OR REPLACE FUNCTION + drop-then-create trigger, with no
--   need to re-emit the requeue body verbatim just to append to it.
--
-- SECURITY INVOKER (default), not SECURITY DEFINER — matches the true analog
-- enforce_booking_status_transition() (0011/0021), which is likewise a pure
-- NEW/OLD column-freeze and is NOT security definer. This function reads only
-- NEW, OLD and auth.role(); it touches no table, so definer rights would buy
-- nothing and violate least privilege. (requeue_verification_on_resubmit IS
-- security definer, but for an unrelated historical reason; the column-freeze
-- precedent is the right one to mirror here.) SET search_path = public, pg_temp
-- is kept regardless, for search-path-injection safety.
--
-- SCOPE: one new trigger function + one new trigger on
-- public.verification_requests. NO new columns, NO new grants, NO grant changes,
-- NO policy changes, NO data migration, NO change to any other table or trigger.
--
-- IDEMPOTENT / RE-RUNNABLE: CREATE OR REPLACE FUNCTION is natively re-runnable;
-- the trigger uses drop-then-create (0011/0015 idiom).

-- ============================================================
-- 1. Trigger function — freeze the reviewer/audit columns for clients.
--
--    On UPDATE (non-service_role): force reviewed_by / reviewed_at back to their
--    OLD values, so a client can never change either — whatever they send is
--    silently reverted to what was already stored. The honest app UPDATE path
--    sends only an image column, so NEW already equals OLD here and this is a
--    no-op for it. The 0015 re-queue trigger still fires on the same event and
--    still stamps status := 'pending' when an image column changes, unaffected.
--
--    On INSERT (non-service_role): a genuine first submission has no reviewer
--    yet, and the app's insert sends neither column — so force both to NULL.
--    This nullifies any raw-API attempt to seed reviewer attribution on a fresh
--    row (the currently-reachable INSERT vector above), without affecting the
--    honest path (which already omits them ⇒ they default NULL anyway).
--
--    service_role is fully exempt (same `auth.role() is distinct from
--    'service_role'` gate as 0011/0015), so the founder dashboard, a future
--    admin RPC, and any backfill keep full control of both columns.
-- ============================================================

create or replace function public.freeze_verification_reviewer_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      -- A client may never seed reviewer attribution on a fresh request.
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      -- UPDATE: the reviewer/audit columns are immutable to clients — whatever
      -- was sent is reverted to the stored value.
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
  end if;
  return new;
end;
$function$;

-- ============================================================
-- 2. Trigger — BEFORE INSERT OR UPDATE, before the requeue trigger by name
--    (disjoint columns, so order is immaterial; see header).
-- ============================================================

drop trigger if exists trg_freeze_verification_reviewer_columns on public.verification_requests;
create trigger trg_freeze_verification_reviewer_columns
  before insert or update on public.verification_requests
  for each row execute function public.freeze_verification_reviewer_columns();

-- Trigger-only function; never meant to be RPC-callable via PostgREST.
-- Revoking EXECUTE does not affect trigger firing (same rationale as 0002/0005/0015).
revoke execute on function public.freeze_verification_reviewer_columns() from public, anon, authenticated;
