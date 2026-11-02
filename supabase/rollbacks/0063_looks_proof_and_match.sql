-- Rollback for 0063_looks_proof_and_match.sql. Apply after the rollbacks of
-- every later Looks migration (0064 onwards).
--
-- DESTRUCTIVE: drops every look, look photo row and look match verdict.
-- Storage files cannot be removed from SQL: empty the `looks` bucket in the
-- dashboard (Storage) first, then delete the bucket there. The bucket row is
-- left in place here on purpose.

drop policy if exists looks_insert_own on storage.objects;
drop policy if exists looks_select_own_or_allowed on storage.objects;
drop policy if exists looks_delete_own_or_customer on storage.objects;

drop function if exists public.barber_look_stats(uuid);
drop function if exists public.submit_look_feedback(uuid, text, text);
drop function if exists public.withdraw_look(uuid, text);
drop function if exists public.respond_to_look(uuid, boolean, boolean);
drop function if exists public.submit_look(uuid);
drop function if exists public.remove_look_photo(uuid);
drop function if exists public.add_look_photo(uuid, text);
drop function if exists public.create_look_draft(uuid, text[], boolean);
drop function if exists private.can_remove_look_photo(text);
drop function if exists private.can_view_look_photo(text);
drop function if exists private.valid_look_styles(text[]);
drop function if exists private.assert_looks_enabled();

drop table if exists public.look_feedback;
drop table if exists public.look_photos;
drop table if exists public.looks;
drop table if exists public.look_styles;
drop table if exists private.looks_settings;
