-- Allow a verification request to hold ONE document while the other is still
-- outstanding (build-order step 17, verification submission — defect fix).
--
-- WHY: barber verification document submission has never once worked in
-- production. Two stacked defects, both found live on 2026-07-17:
--
--   1. (ALREADY FIXED APP-SIDE, no schema change — recorded here only so the
--      two are never conflated.) submitVerificationDocument used a PostgREST
--      `.upsert({ user_id, [column]: path })`, which compiles to
--      `ON CONFLICT (user_id) DO UPDATE SET user_id = excluded.user_id, ...`.
--      `authenticated` holds UPDATE on ONLY (id_image_url, license_image_url)
--      per 0015 section 6's deliberate column-grant guardrail — never on
--      user_id. Postgres checks DO UPDATE column privileges at statement level
--      even when no conflicting row exists, so EVERY submission failed 42501.
--      The client now does update-then-insert instead; proven live.
--
--   2. (THIS MIGRATION.) id_image_url and license_image_url were declared
--      `not null` with no default in 0001 (lines 147-148), back when the table
--      was sketched as "both documents arrive together". The UX that actually
--      shipped does the opposite: VerifyScreen.handleUpload(docType) uploads
--      ONE document at a time — id or license, independently, in either order.
--      So the first single-document submission raises 23502 and the row can
--      never be created at all. Proven live: an INSERT of only
--      (user_id, id_image_url) as an authenticated barber raises
--      `23502 null value in column "license_image_url"`.
--
-- The NOT NULL pair is therefore the odd one out — the rest of the step-17
-- design already assumes a request can hold one document without the other:
-- 0015's requeue_verification_on_resubmit trigger compares EACH image column
-- independently (`new.id_image_url is distinct from old.id_image_url or
-- new.license_image_url is distinct from old.license_image_url`), and
-- VerifyScreen renders per-document uploaded state, which is only meaningful
-- if one document can exist while the other does not. Founder decision
-- (2026-07-17, explicit): make both columns nullable.
--
-- SCOPE: the two DROP NOT NULLs and one new CHECK on the same table. Nothing
-- else. No grant changes, no policy changes, no trigger changes, no other
-- table, no data changes.
--
-- DELIBERATELY NOT DONE — DO NOT "FIX" THIS LATER:
--   Postgres's own 42501 error HINT on defect 1 suggests granting UPDATE on
--   the whole table. That would be a privilege escalation, not a fix:
--   verification_requests_update_own's WITH CHECK re-asserts ownership only
--   (`user_id = auth.uid()`) and does NOT pin `status`, so table-level UPDATE
--   would let a barber self-approve their own request — set status='approved'
--   and forge reviewed_by / reviewed_at. The re-queue trigger does not block
--   that either: it only forces status back to 'pending' when an IMAGE column
--   changes, so a status-only update sails straight through. 0015's column
--   grant is the guardrail; defect 1 was fixed app-side precisely to keep it.
--
-- FOUNDER REVIEW-QUEUE IMPLICATION (accepted by the founders as part of this
-- decision): a HALF-SUBMITTED request — one document present, the other NULL —
-- is now representable, and because the re-queue trigger stamps status
-- 'pending' on insert, it WILL appear in the founders' pending review queue.
-- Such a request MUST NOT be approved until BOTH documents are present. The
-- manual dashboard review procedure in docs/design/step-17-founder-review-path.md
-- needs that check written into it: verify id_image_url AND license_image_url
-- are both non-null before setting any approval. Nothing in the database
-- enforces "both present" (see the CHECK note below) — this is a procedural
-- control on the founders' side.
--
-- LIVE STATE AT AUTHORING TIME: public.verification_requests has 0 rows
-- (verified live this session), which is the direct consequence of defects 1
-- and 2 — no submission has ever succeeded. So there is no backfill to do and
-- no violating-row risk for the CHECK added below. Whoever applies this MUST
-- still re-verify emptiness/non-violation at apply time (same discipline as
-- 0018's condition C3) — apply is transactional, so a violating row would
-- abort the whole migration cleanly rather than half-apply it.
--
-- IDEMPOTENT / RE-RUNNABLE: `alter column ... drop not null` is natively a
-- no-op when the column is already nullable — it needs no guard. The CHECK
-- does: Postgres has no ADD CONSTRAINT IF NOT EXISTS for CHECK, so it is
-- guarded in a DO block keyed on pg_constraint (conname + conrelid), matching
-- 0015 section 3 and 0018.

-- ============================================================
-- 1. Drop NOT NULL from both document columns.
--    A NULL image column now carries a real, intended meaning: "this document
--    has not been uploaded yet". Both columns keep their historical "_url"
--    names from 0001 for schema stability but store the object PATH inside the
--    private verification-docs bucket, never a URL (0015 header note 2).
-- ============================================================

alter table public.verification_requests
  alter column id_image_url drop not null;

alter table public.verification_requests
  alter column license_image_url drop not null;

-- ============================================================
-- 2. Floor constraint: a request must carry at least one document.
--
--    ADDED DELIBERATELY. Dropping both NOT NULLs without this would leave
--    (id_image_url IS NULL AND license_image_url IS NULL) representable, i.e.
--    a verification request that requests nothing. That row is reachable today
--    by a raw-API caller: an authenticated barber can POST { user_id: <own
--    uid> } with no image at all — verification_requests_insert_own passes
--    (user_id = auth.uid()), the re-queue trigger stamps status 'pending', and
--    an empty row lands in the founders' manual review queue with zero bytes
--    to review. This CHECK keeps the row's existence meaningful: a request
--    exists if and only if at least one document was actually submitted.
--
--    IT DOES NOT — AND MUST NOT BE READ TO — ENFORCE "BOTH DOCUMENTS PRESENT".
--    That is exactly the state this migration exists to permit. "Both present"
--    is an APPROVAL precondition, checked by the founders at review time (see
--    the queue note in the header), not an insert-time invariant. Do not
--    tighten this predicate to `and`; that would re-break the feature in the
--    same way NOT NULL did.
--
--    SAFE AGAINST EVERY WRITE PATH THE APP HAS (each was checked, not assumed):
--      * INSERT arm — `.insert({ user_id, [column]: path })` supplies exactly
--        one non-null image column. Passes.
--      * UPDATE arm — `.update({ [column]: path })` sets one column to a
--        non-null path; whatever the other column holds, at least one is
--        non-null after the write. Passes.
--      * Founder dashboard (service_role) — writes status / reviewed_by /
--        reviewed_at, never nulls an image. Passes. (A founder could still
--        null ONE bad document; only nulling both is refused.)
--    The only write it refuses is the empty-request one, which no code path
--    issues and which has no legitimate meaning. A barber withdrawing a
--    request is a DELETE of the row, not a null-out of its last document —
--    and that is separately gated by the deliberate absence of any DELETE
--    policy (0015 section 6), so this constraint forecloses nothing the app
--    can otherwise do.
--
--    Same class and rationale as 0018's bundle: a row-local, immutable
--    predicate closing a raw-API path the client-side guards cannot reach.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_verification_requests_has_document'
      and conrelid = 'public.verification_requests'::regclass
  ) then
    alter table public.verification_requests
      add constraint chk_verification_requests_has_document
      check (id_image_url is not null or license_image_url is not null);
  end if;
end $$;
