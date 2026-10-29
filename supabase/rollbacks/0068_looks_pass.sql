-- Rollback for 0068_looks_pass.sql. Apply before the 0067 rollback.
-- Read-only slice: nothing to keep or convert.

drop function if exists public.my_looks();
