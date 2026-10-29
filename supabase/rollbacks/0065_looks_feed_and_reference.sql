-- Rollback for 0065_looks_feed_and_reference.sql. Apply before the 0064 and
-- 0063 rollbacks. Drops every booking-to-look reference (the bookings
-- themselves are untouched) and narrows photo access back to the S2 rule
-- (only the look's own customer).

drop function if exists public.attach_look_reference(uuid, uuid, text);
drop function if exists public.looks_feed(text, timestamptz, integer, uuid);

create or replace function private.can_view_look_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.flag_enabled('looks') and exists (
    select 1
    from public.look_photos p
    join public.looks l on l.id = p.look_id
    cross join private.looks_settings s
    where p.storage_path = p_name
      and l.customer_id = (select auth.uid())
      and l.submitted_at is not null
      and (
        l.status in ('confirmed', 'published')
        or (l.status = 'draft' and l.submitted_at > now() - make_interval(days => s.draft_valid_days))
      )
  );
$function$;

drop table if exists public.look_references;
