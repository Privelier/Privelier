-- Verification documents are meaningful only for barber accounts. Keep the
-- existing owner-folder boundary and require the server-owned role on every
-- operation against this private bucket.
drop policy if exists verification_docs_insert_own on storage.objects;
create policy verification_docs_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('barber')
  );

drop policy if exists verification_docs_select_own on storage.objects;
create policy verification_docs_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('barber')
  );

drop policy if exists verification_docs_update_own on storage.objects;
create policy verification_docs_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('barber')
  )
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('barber')
  );
