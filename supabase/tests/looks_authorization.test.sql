-- Looks (feature-flagged): the flag gates every RPC, wishes and offers stay
-- between their parties, and a barber cannot answer a look for a customer.
-- Synthetic users only; the transaction never commits.
--
-- Run: python tools/db/supa.py test supabase/tests/looks_authorization.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

select is(tests.run(tests.id('a'), $$select public.create_wish('fade', current_date + 3, '10:00', '12:00')$$), '42501',
  'a customer outside the flag cannot use Looks');
select is(tests.visible(tests.id('a'), 'select 1 from public.my_feature_flags() f where ''looks'' = any(f)'), 0,
  'paired check: the flag is off for that customer');

insert into private.feature_flag_users (flag_key, user_id)
select 'looks', u from unnest(array[tests.id('a'), tests.id('b'), tests.id('x')]) u;
insert into fx select 'style', key from public.look_styles where active order by sort_order limit 1;

insert into fx select 'wish', tests.scalar(tests.id('a'), format(
  $$select (public.create_wish(%L, current_date + 3, '10:00', '12:00')).id$$, (select v from fx where k = 'style')));
select ok(tests.id('wish') is not null, 'paired allow: a flagged customer creates a wish');
select is(tests.visible(tests.id('b'), format('select 1 from public.look_wishes where id = %L', tests.id('wish'))), 0,
  'another customer cannot read the wish');
select is(tests.run(tests.id('b'), format('select public.cancel_wish(%L)', tests.id('wish'))), 'P0002',
  'another customer cannot cancel the wish');
select is(tests.run(tests.id('x'), format($$select public.create_wish(%L, current_date + 3, '10:00', '12:00')$$, (select v from fx where k = 'style'))), '42501',
  'a barber cannot send wishes');
select is(tests.run(tests.id('x'), format($$select public.offer_for_wish(%L, %L, '10:00')$$, tests.id('wish'), tests.id('svc_x'))), 'P0002',
  'a barber without a matching proof look cannot offer');
select is(tests.run(tests.id('a'), format($$select public.create_look_draft(%L, array[%L], true)$$, tests.id('done'), (select v from fx where k = 'style'))), '42501',
  'a customer cannot capture a look');
select is(tests.run(tests.id('b'), format($$select public.submit_look_feedback(%L, %L, 'exact')$$, tests.id('done'), (select v from fx where k = 'style'))), 'P0002',
  'feedback needs your own completed booking');
select is(tests.run(tests.id('a'), format('select public.cancel_wish(%L)', tests.id('wish'))), 'ok',
  'paired allow: the owner cancels the wish');
select is(tests.run(null, 'select public.looks_feed()'), '42501', 'anon cannot read the feed');

select * from finish();
rollback;
