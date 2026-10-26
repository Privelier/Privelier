-- Policy helpers leave the exposed schema (hardening 2026-10-26; Supabase
-- lint 0029).
--
-- has_role(), is_admin() and is_blocked_between() exist only for RLS
-- policies, but in `public` PostgREST also served them as RPC endpoints.
-- Policies store function OIDs, so moving the functions keeps all 21
-- policies working unchanged; `authenticated` keeps EXECUTE (policies run
-- as the caller) and already has USAGE on `private` (0055), which the API
-- does not expose.

alter function public.has_role(public.user_role) set schema private;
alter function public.is_admin() set schema private;
alter function public.is_blocked_between(uuid, uuid) set schema private;
