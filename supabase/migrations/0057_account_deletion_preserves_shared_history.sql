-- Account deletion that keeps the other party's history intact
-- (hardening 2026-10-26, Phase 6; App Store 5.1.1(v), Google Play account
-- deletion, GDPR Art. 17).
--
-- Before: deleting an account cascaded through every foreign key, so the
-- OTHER participant silently lost their bookings, chat history and the
-- reviews they had received, and deletion was refused while any booking
-- was live.
-- Now delete_own_account():
--   1. cancels the caller's pending and future accepted bookings (a barber's
--      pending requests are rejected), notifying the other participant;
--   2. erases the caller's review comments (the star rating stays, so the
--      barber's aggregate does not shift);
--   3. deletes the auth user, which removes every private row (profile,
--      services, availability, addresses, favorites, location, verification
--      requests, push tokens, consent history, blocks, read state);
--   4. leaves shared rows (bookings, chat rooms, messages, reviews, reports,
--      safety events, notifications) in place with the deleted person's id
--      set to NULL, which the apps show as a former customer or barber.
-- It is idempotent: once the account is gone a repeat call does nothing.
-- Retention choices are recorded in docs/hardening/DECISIONS.md.

alter table public.bookings alter column customer_id drop not null;
alter table public.bookings alter column barber_id drop not null;
alter table public.bookings alter column service_id drop not null;
alter table public.chat_rooms alter column customer_id drop not null;
alter table public.chat_rooms alter column barber_id drop not null;
alter table public.messages alter column sender_id drop not null;
alter table public.reviews alter column customer_id drop not null;
alter table public.reviews alter column barber_id drop not null;
alter table public.user_reports alter column reporter_id drop not null;
alter table public.user_reports alter column reported_id drop not null;
alter table public.safety_events alter column user_id drop not null;

alter table public.bookings
  drop constraint bookings_customer_id_fkey,
  add constraint bookings_customer_id_fkey foreign key (customer_id) references public.users(id) on delete set null,
  drop constraint bookings_barber_id_fkey,
  add constraint bookings_barber_id_fkey foreign key (barber_id) references public.users(id) on delete set null,
  drop constraint bookings_service_id_fkey,
  add constraint bookings_service_id_fkey foreign key (service_id) references public.services(id) on delete set null;
alter table public.chat_rooms
  drop constraint chat_rooms_customer_id_fkey,
  add constraint chat_rooms_customer_id_fkey foreign key (customer_id) references public.users(id) on delete set null,
  drop constraint chat_rooms_barber_id_fkey,
  add constraint chat_rooms_barber_id_fkey foreign key (barber_id) references public.users(id) on delete set null;
alter table public.messages
  drop constraint messages_sender_id_fkey,
  add constraint messages_sender_id_fkey foreign key (sender_id) references public.users(id) on delete set null;
alter table public.reviews
  drop constraint reviews_customer_id_fkey,
  add constraint reviews_customer_id_fkey foreign key (customer_id) references public.users(id) on delete set null,
  drop constraint reviews_barber_id_fkey,
  add constraint reviews_barber_id_fkey foreign key (barber_id) references public.users(id) on delete set null;
alter table public.notifications
  drop constraint notifications_actor_id_fkey,
  add constraint notifications_actor_id_fkey foreign key (actor_id) references public.users(id) on delete set null;
alter table public.user_reports
  drop constraint user_reports_reporter_id_fkey,
  add constraint user_reports_reporter_id_fkey foreign key (reporter_id) references public.users(id) on delete set null,
  drop constraint user_reports_reported_id_fkey,
  add constraint user_reports_reported_id_fkey foreign key (reported_id) references public.users(id) on delete set null;
alter table public.safety_events
  drop constraint safety_events_user_id_fkey,
  add constraint safety_events_user_id_fkey foreign key (user_id) references public.users(id) on delete set null;

-- Clients cannot change barber_id or service_id after insert (status
-- transition trigger), so the slot check only needs to re-run when the time
-- itself changes; nulling a deleted participant must not re-validate a past
-- slot.
drop trigger trg_validate_booking_slot on public.bookings;
create trigger trg_validate_booking_slot
  before insert or update of date, time, duration_minutes on public.bookings
  for each row execute function public.validate_booking_slot();

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user uuid := (select auth.uid());
  v_stashed_role text;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = v_user) then
    return;
  end if;
  perform private.consume_rate('delete:' || v_user, 5, 3600);

  -- The status trigger still records the caller as the actor (auth.uid()),
  -- so the other participant is notified; the service-role claim only lifts
  -- the client-side transition and immutability rules for this erasure.
  v_stashed_role := current_setting('request.jwt.claim.role', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  update public.bookings b
     set status = case
       when b.barber_id = v_user and b.status = 'pending' then 'rejected'::booking_status_type
       else 'cancelled'::booking_status_type
     end
   where (b.customer_id = v_user or b.barber_id = v_user)
     and (b.status = 'pending'
       or (b.status = 'accepted' and b.date + b.time > localtimestamp));

  update public.reviews set comment = null where customer_id = v_user and comment is not null;

  delete from auth.users where id = v_user;

  perform set_config('request.jwt.claim.role', coalesce(v_stashed_role, ''), true);
end;
$function$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
