-- Feature flags (0062): only the caller's own enabled keys are readable, the
-- flag tables are unreachable through the API, and a missing or disabled
-- flag reads as off. Runs as the real anon/authenticated roles.
--
-- Before 0062 is applied:
--   python tools/db/supa.py test --with supabase/migrations/0062_feature_flags.sql -- supabase/tests/feature_flags.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

select is(tests.run(null, 'select public.my_feature_flags()'), '42501', 'anon cannot read feature flags');
select is(tests.scalar(tests.id('a'), 'select public.my_feature_flags()::text'), '{}', 'a user without assignments has no flags');
select is(tests.run(tests.id('a'), 'select * from private.feature_flags'), '42501', 'the flag table is not readable by clients');
select is(tests.run(tests.id('a'), format($$insert into private.feature_flag_users (flag_key, user_id) values ('looks', %L)$$, tests.id('a'))), '42501', 'nobody enables a flag for themselves');
select is(tests.scalar(tests.id('a'), $$select private.flag_enabled('looks')::text$$), 'false', 'the policy helper reads off by default');

insert into private.feature_flag_users (flag_key, user_id) values ('looks', tests.id('a'));
select is(tests.scalar(tests.id('a'), 'select public.my_feature_flags()::text'), '{looks}', 'paired allow: an assigned user sees the flag');
select is(tests.scalar(tests.id('a'), $$select private.flag_enabled('looks')::text$$), 'true', 'paired allow: the helper reads on');
select is(tests.scalar(tests.id('b'), 'select public.my_feature_flags()::text'), '{}', 'other users stay off');
select is(tests.scalar(tests.id('a'), $$select private.flag_enabled('no_such_flag')::text$$), 'false', 'an unknown flag reads off');

update private.feature_flags set enabled_for_all = true where key = 'looks';
select is(tests.scalar(tests.id('b'), 'select public.my_feature_flags()::text'), '{looks}', 'enabled_for_all turns it on for everyone');
select is(tests.run(null, $$select private.flag_enabled('looks')$$), '42501', 'anon cannot evaluate the helper');

select is((select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can still execute no public function');

select * from finish();
rollback;
