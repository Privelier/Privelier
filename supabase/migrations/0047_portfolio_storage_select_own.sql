-- Storage remove() deletes with RETURNING, so Postgres also requires a SELECT
-- policy on storage.objects. The portfolio bucket had INSERT and DELETE
-- policies only: reads work through the public URL, but a barber's own
-- remove() matched zero rows and returned no error, leaving orphaned public
-- images after a portfolio delete and after account deletion (live: one
-- orphan object found on 2026-10-13).
-- Scope: a barber sees only objects in their own folder. The bucket stays
-- public for image URLs; this grants no new read of other barbers' objects.
create policy portfolio_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('barber'::public.user_role)
  );
