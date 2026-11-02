-- Rollback for 0062_feature_flags.sql. Apply only after the rollbacks of
-- every later Looks migration (0063 onwards), which depend on flag_enabled().
-- Deletes the flag assignments: re-enable flags by hand after re-applying.

drop function if exists public.my_feature_flags();
drop function if exists private.flag_enabled(text);
drop table if exists private.feature_flag_users;
drop table if exists private.feature_flags;
