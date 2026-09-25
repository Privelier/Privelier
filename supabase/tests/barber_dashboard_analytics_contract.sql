-- Focused security contract for the barber dashboard aggregate RPC.
-- Run after migrations with the Supabase database test runner.
begin;

do $$
declare
  function_oid oid;
  function_is_definer boolean;
  function_config text[];
  function_body text;
begin
  function_oid := 'public.get_barber_dashboard_analytics()'::regprocedure;

  select p.prosecdef, p.proconfig, pg_get_functiondef(p.oid)
  into function_is_definer, function_config, function_body
  from pg_proc p
  where p.oid = function_oid;

  if not function_is_definer then
    raise exception 'dashboard analytics RPC must be SECURITY DEFINER';
  end if;
  if not ('search_path=public, pg_temp' = any(function_config)) then
    raise exception 'dashboard analytics RPC search_path must be pinned';
  end if;
  if has_function_privilege('anon', function_oid, 'EXECUTE') then
    raise exception 'anonymous role must not execute dashboard analytics RPC';
  end if;
  if not has_function_privilege('authenticated', function_oid, 'EXECUTE') then
    raise exception 'authenticated role must execute dashboard analytics RPC';
  end if;
  if position('Barber role required' in function_body) = 0 then
    raise exception 'dashboard analytics RPC must enforce the barber role';
  end if;
  if position('barber_id = v_barber_id' in function_body) = 0 then
    raise exception 'dashboard analytics RPC must scope bookings to auth.uid()';
  end if;
end $$;

rollback;
