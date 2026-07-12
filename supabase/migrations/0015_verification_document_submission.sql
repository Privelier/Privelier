-- Barber verification document submission (build-order step 17, one pipeline
-- run). Design approved at architecture review; implemented precisely here.
--
-- WHAT THIS ENABLES: a barber uploads a government-ID photo + a barber-licence
-- photo to a PRIVATE storage bucket, then creates/replaces their own single
-- verification_requests row. A founder later reviews manually via the Supabase
-- dashboard (service_role) and sets status. No OCR, no face-match, no biometric
-- processing of any kind -- manual-only, per CLAUDE.md's hard rule (GDPR Art. 9).
--
-- KEY DECISIONS (do not "optimise" these away without founder sign-off):
--
--  1. PRIVATE bucket, no public-read policy. These are government IDs and
--     professional licences -- special-category-adjacent, high-liability
--     documents. They must never be world-readable. Access is exclusively:
--     the owning barber (own folder, via the storage.objects policies below)
--     and founders (service_role / dashboard, which bypasses RLS).
--
--  2. id_image_url / license_image_url store the object PATH inside the bucket
--     (e.g. '{uid}/id.jpg'), NOT a public URL. A private bucket has no durable
--     public URL; the app resolves a short-lived signed URL from the path at
--     read time. The column names keep the historical "_url" suffix from 0001
--     for schema stability, but their contents are paths.
--
--  3. FOLDER-KEY RLS is security-critical. Every object lives under a folder
--     named for its owner's uid, so the predicate is
--     (storage.foldername(name))[1] = auth.uid()::text. storage.foldername()
--     returns the path segments EXCLUDING the bucket, so segment [1] is the
--     first (owner) folder. An off-by-one here would cross-leak IDs between
--     barbers -- index [1] is deliberate and must stay [1].
--
--  4. ONE row per barber: UNIQUE (user_id) so the client can upsert
--     (INSERT ... ON CONFLICT (user_id) DO UPDATE) rather than accumulate rows.
--
--  5. RE-QUEUE trigger: any barber-side write that sets/changes an image column
--     forces status back to 'pending', so a rejected barber who re-uploads
--     re-enters the founders' manual queue automatically. The founder's own
--     dashboard writes (service_role) are exempt, so setting approved/rejected
--     is never clobbered. Same silent-guard idiom as 0005.
--
--  6. COLUMN-GRANT guardrail: authenticated is allowed to UPDATE ONLY
--     id_image_url / license_image_url. The admin columns
--     (status / reviewed_by / reviewed_at) and the identity columns
--     (id / user_id) are unreachable by a client at the SQL-privilege layer --
--     a stronger, RLS-independent guarantee than a policy predicate alone.
--     NOTE: 0001 granted authenticated *table-level* UPDATE and 0006 only
--     revoked anon's, so authenticated still holds it today. A bare column
--     GRANT would be a no-op on top of that, so we REVOKE the table-level
--     UPDATE first -- otherwise the whole guardrail is meaningless.

-- ============================================================
-- 1. Private storage bucket
-- ============================================================

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

-- ============================================================
-- 2. storage.objects RLS -- owner-folder scoped, authenticated only.
--    RLS on storage.objects is already enabled by Supabase; do NOT toggle it.
--    No public SELECT policy and no DELETE policy exist by design.
-- ============================================================

drop policy if exists verification_docs_insert_own on storage.objects;
create policy verification_docs_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists verification_docs_select_own on storage.objects;
create policy verification_docs_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists verification_docs_update_own on storage.objects;
create policy verification_docs_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 3. One verification_requests row per barber.
--    Written defensively / idempotently: a UNIQUE (user_id) constraint added
--    only if absent, so re-running is a no-op. The table is empty in practice,
--    so no dedup step is included -- if pre-existing duplicates ever blocked
--    this it must fail LOUDLY rather than silently delete government-ID rows.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.verification_requests'::regclass
      and conname = 'verification_requests_user_id_key'
  ) then
    alter table public.verification_requests
      add constraint verification_requests_user_id_key unique (user_id);
  end if;
end $$;

-- ============================================================
-- 4. Client replace path -- own-row UPDATE policy.
--    A barber may re-submit while pending or after a rejection, but NOT after
--    approval (status is frozen out of the USING set once approved). WITH CHECK
--    only re-asserts ownership; the post-update status is governed by the
--    trigger in section 5, not by the client.
-- ============================================================

drop policy if exists verification_requests_update_own on public.verification_requests;
create policy verification_requests_update_own
  on public.verification_requests for update
  to authenticated
  using (
    user_id = auth.uid()
    and status in ('pending'::verification_status_type, 'rejected'::verification_status_type)
  )
  with check (user_id = auth.uid());

-- ============================================================
-- 5. Re-queue trigger -- resubmission re-enters the manual queue.
--    Same silent-guard idiom as 0005: only non-service_role callers are
--    affected; a founder's dashboard write (service_role) sets status freely.
--    On INSERT, a fresh barber submission always starts 'pending'. On UPDATE,
--    status is forced back to 'pending' only when an image column actually
--    changes -- so a founder's status transition is never clobbered by this.
-- ============================================================

create or replace function public.requeue_verification_on_resubmit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      new.status := 'pending'::verification_status_type;
    elsif new.id_image_url is distinct from old.id_image_url
       or new.license_image_url is distinct from old.license_image_url then
      new.status := 'pending'::verification_status_type;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_requeue_verification_on_resubmit on public.verification_requests;
create trigger trg_requeue_verification_on_resubmit
  before insert or update on public.verification_requests
  for each row execute function public.requeue_verification_on_resubmit();

-- Trigger-only function; never meant to be RPC-callable via PostgREST.
-- Revoking EXECUTE does not affect trigger firing (same rationale as 0002/0005).
revoke execute on function public.requeue_verification_on_resubmit() from public, anon, authenticated;

-- ============================================================
-- 6. Column-grant guardrail (see header note 6).
--    Revoke the leftover table-level UPDATE, then grant UPDATE on ONLY the two
--    image-path columns. status / reviewed_by / reviewed_at / id / user_id are
--    now unreachable by a client at the privilege layer. INSERT/SELECT/DELETE
--    grants are untouched (INSERT for fresh submissions; SELECT for RETURNING;
--    DELETE stays gated by the absence of any DELETE policy).
-- ============================================================

revoke update on public.verification_requests from authenticated;
grant update (id_image_url, license_image_url) on public.verification_requests to authenticated;
