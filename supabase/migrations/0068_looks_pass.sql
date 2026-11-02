-- Looks slice S6: the look pass (docs/genius/LOOKS.md, bonus after B5).
--
-- The client sees their own looks privately: what they asked for (their
-- reference photo, or the feed look they booked from) next to the result,
-- and can book the same barber again. Read-only, no new table.
--
-- Only the caller's own looks they confirmed as their cut ('confirmed' or
-- 'published'); drafts, declined and withdrawn looks never appear. Result
-- photos exist only for published looks: the app removes the files of a
-- look that is not shown (S2), so a confirmed look shows its styles only.
-- can_rebook is false when the barber is no longer approved or either side
-- blocked the other; create_booking enforces the same anyway.

create or replace function public.my_looks()
returns table (
  look_id uuid,
  booking_id uuid,
  barber_id uuid,
  barber_name text,
  barber_image text,
  styles text[],
  status text,
  appointment_date date,
  service_id uuid,
  service_name text,
  photo_paths text[],
  reference_style text,
  reference_photo_path text,
  reference_look_id uuid,
  reference_look_photo text,
  can_rebook boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select l.id,
         l.booking_id,
         l.barber_id,
         bp.name,
         bp.profile_image,
         l.styles,
         l.status,
         b.date,
         sv.id,
         sv.name,
         case when l.status = 'published'
           then array(select ph.storage_path from public.look_photos ph where ph.look_id = l.id order by ph.position)
           else '{}'::text[]
         end,
         r.style,
         r.photo_path,
         r.look_id,
         (select ph.storage_path
            from public.looks rl
            join public.look_photos ph on ph.look_id = rl.id
           where rl.id = r.look_id and rl.status = 'published'
           order by ph.position
           limit 1),
         coalesce(bp.approved, false) and not private.is_blocked_between(l.customer_id, l.barber_id)
  from public.looks l
  join public.bookings b on b.id = l.booking_id
  left join public.barber_public_profile bp on bp.barber_id = l.barber_id
  left join public.services sv on sv.id = l.service_id
  left join public.look_references r on r.booking_id = l.booking_id
  where l.customer_id = (select auth.uid())
    and private.flag_enabled('looks')
    and private.has_role('customer'::public.user_role)
    and l.status in ('confirmed', 'published')
  order by b.date desc, l.created_at desc
  limit 100;
$function$;

revoke all on function public.my_looks() from public, anon;
grant execute on function public.my_looks() to authenticated;
