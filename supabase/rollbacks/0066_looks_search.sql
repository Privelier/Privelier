-- Rollback for 0066_looks_search.sql. Apply before the 0065 rollback.
-- DESTRUCTIVE for reference photos: drops look_references.photo_path. Empty
-- and delete the `look-references` bucket in the dashboard (Storage); SQL
-- cannot remove the files. Restores the three-argument attach_look_reference.

drop function if exists public.match_look(text, date, time, time);

drop policy if exists look_references_insert_own on storage.objects;
drop policy if exists look_references_select_own_or_booked on storage.objects;
drop policy if exists look_references_delete_own on storage.objects;
drop function if exists private.can_view_reference_photo(text);

drop function if exists public.attach_look_reference(uuid, uuid, text, text);
create or replace function public.attach_look_reference(p_booking_id uuid, p_look_id uuid, p_style text)
returns public.look_references
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_booking public.bookings;
  v_row public.look_references;
begin
  perform private.assert_looks_enabled();
  perform private.consume_rate('look_reference:' || v_uid, 30, 3600);
  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id and b.customer_id = v_uid and b.status = 'pending';
  if not found then
    raise exception 'pending booking not found' using errcode = 'P0002';
  end if;
  if not private.valid_look_styles(array[p_style]) then
    raise exception 'invalid style' using errcode = '22023';
  end if;
  if p_look_id is not null and not exists (
    select 1 from public.looks_feed(null, null, 1, p_look_id) f
    where f.barber_id = v_booking.barber_id
  ) then
    raise exception 'look not found' using errcode = 'P0002';
  end if;
  insert into public.look_references (booking_id, customer_id, look_id, style)
  values (p_booking_id, v_uid, p_look_id, p_style)
  returning * into v_row;
  return v_row;
end;
$function$;
revoke all on function public.attach_look_reference(uuid, uuid, text) from public, anon;
grant execute on function public.attach_look_reference(uuid, uuid, text) to authenticated;

alter table public.look_references drop column if exists photo_path;
alter table private.looks_settings
  drop column if exists search_max_window_hours,
  drop column if exists search_step_minutes;
