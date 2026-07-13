-- Barber portfolio image storage (build-order step 17, portfolio upload/delete
-- pipeline run). Design approved: docs/design/step-17-portfolio-upload-design-approval.md.
--
-- SCOPE: STORAGE ONLY. The PORTFOLIO table, its RLS (portfolio_select_all /
-- portfolio_write_own), and the enforce_portfolio_max_six BEFORE INSERT trigger
-- already exist and are correct (0001 + 0004 + 0006) -- this migration does NOT
-- create, alter, or drop any of them. The schema stays sacred; only the storage
-- bucket + its storage.objects RLS are added here.
--
-- WHAT THIS ENABLES: a barber uploads portfolio images (max 6, enforced by the
-- existing table trigger) to a PUBLIC storage bucket, and may delete their own.
-- Customers view them via the bucket's public URL (getPublicUrl), no signing.
--
-- KEY DECISIONS (do not "optimise" away without founder sign-off):
--
--  1. PUBLIC bucket (public = true). Founder decision D1: portfolio photos are
--     marketing imagery, served world-readable by public URL, no expiry. This
--     DIFFERS from the verification-docs bucket (0015), which is PRIVATE because
--     those are government IDs/licences. The tradeoff (any leaked URL is
--     permanently viewable without auth) was accepted knowingly; enumeration is
--     mitigated by random unique object names (design D3), not by RLS.
--
--  2. NO SELECT policy. A public bucket serves object bytes without an
--     RLS-checked read, mirroring the table's own portfolio_select_all. Adding a
--     restrictive SELECT policy here would break public reads -- deliberately
--     omitted. (Contrast 0015, whose private bucket NEEDED an own-folder SELECT
--     policy so only the owning barber could read.)
--
--  3. FOLDER-KEY RLS on writes is the real security boundary, even for a public
--     bucket: nobody may write or delete another barber's objects. Every object
--     lives under a folder named for its owner's uid, so the predicate is
--     (storage.foldername(name))[1] = auth.uid()::text. storage.foldername()
--     returns the path segments EXCLUDING the bucket, so segment [1] is the first
--     (owner) folder -- the exact idiom 0015 used. Index [1] is deliberate; an
--     off-by-one would cross-scope one barber's writes into another's folder.
--     Paired with public.has_role('barber') so only barbers write, mirroring the
--     table's portfolio_write_own predicate.
--
--  4. INSERT and DELETE share the identical predicate. Verification (0015) had no
--     DELETE policy; portfolio needs one so a barber can remove their own images
--     (design D5: DB row first, then best-effort storage delete). No UPDATE policy
--     -- objects are unique-named and never overwritten (design D3).

-- ============================================================
-- 1. Public storage bucket
-- ============================================================

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

-- ============================================================
-- 2. storage.objects RLS -- owner-folder + barber-role scoped writes/deletes.
--    RLS on storage.objects is already enabled by Supabase; do NOT toggle it.
--    No SELECT policy by design (public bucket serves reads without RLS).
--    No UPDATE policy by design (unique-named objects, never overwritten).
-- ============================================================

drop policy if exists portfolio_insert_own on storage.objects;
create policy portfolio_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_role('barber')
  );

drop policy if exists portfolio_delete_own on storage.objects;
create policy portfolio_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_role('barber')
  );
