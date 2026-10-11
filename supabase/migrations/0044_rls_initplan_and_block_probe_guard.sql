-- Speed rule (founder, 2026-10-11) + a privacy tightening. Behavior-neutral.
--
-- 1) auth_rls_initplan: 25 policies called auth.uid() per row. Each is
--    re-expressed with (select auth.uid()) so Postgres evaluates it once per
--    statement. The expressions were generated from the live pg_policies
--    text and differ ONLY in that wrapping. Storage policies are left alone.
-- 2) Unindexed foreign keys on notifications and user_reports get covering
--    indexes (cascade deletes and per-booking lookups).
-- 3) is_blocked_between() answered for ANY pair of users; it now answers
--    only when the caller is one of the two (the only way the RESTRICTIVE
--    message/booking policies call it), so nobody can probe who blocked whom.

alter policy availability_write_own on public.availability using ((barber_id = (select auth.uid()))) with check ((barber_id = (select auth.uid())));
alter policy barber_location_insert_own on public.barber_location with check (((user_id = (select auth.uid())) AND has_role('barber'::user_role)));
alter policy barber_location_select_own on public.barber_location using ((user_id = (select auth.uid())));
alter policy barber_location_update_own on public.barber_location using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy barber_profile_insert_own on public.barber_profile with check ((user_id = (select auth.uid())));
alter policy barber_profile_select_own_or_admin_or_approved on public.barber_profile using (((user_id = (select auth.uid())) OR is_admin() OR (verification_status = 'approved'::verification_status_type)));
alter policy barber_profile_update_own on public.barber_profile using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy bookings_insert_customer on public.bookings with check (((customer_id = (select auth.uid())) AND (status = 'pending'::booking_status_type) AND has_role('customer'::user_role) AND (EXISTS ( SELECT 1 FROM barber_profile bp WHERE ((bp.user_id = bookings.barber_id) AND (bp.verification_status = 'approved'::verification_status_type))))));
alter policy bookings_select_participants on public.bookings using (((customer_id = (select auth.uid())) OR (barber_id = (select auth.uid()))));
alter policy bookings_update_participants on public.bookings using (((customer_id = (select auth.uid())) OR (barber_id = (select auth.uid())))) with check (((customer_id = (select auth.uid())) OR (barber_id = (select auth.uid()))));
alter policy chat_read_state_insert_own on public.chat_read_state with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1 FROM chat_rooms cr WHERE ((cr.id = chat_read_state.chat_id) AND ((cr.customer_id = (select auth.uid())) OR (cr.barber_id = (select auth.uid()))))))));
alter policy chat_read_state_select_participants on public.chat_read_state using ((EXISTS ( SELECT 1 FROM chat_rooms cr WHERE ((cr.id = chat_read_state.chat_id) AND ((cr.customer_id = (select auth.uid())) OR (cr.barber_id = (select auth.uid())))))));
alter policy chat_read_state_update_own on public.chat_read_state using ((user_id = (select auth.uid()))) with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1 FROM chat_rooms cr WHERE ((cr.id = chat_read_state.chat_id) AND ((cr.customer_id = (select auth.uid())) OR (cr.barber_id = (select auth.uid()))))))));
alter policy chat_rooms_insert_participants on public.chat_rooms with check (((customer_id = (select auth.uid())) OR (barber_id = (select auth.uid()))));
alter policy chat_rooms_select_participants on public.chat_rooms using (((customer_id = (select auth.uid())) OR (barber_id = (select auth.uid()))));
alter policy messages_insert_participants on public.messages with check (((sender_id = (select auth.uid())) AND (EXISTS ( SELECT 1 FROM chat_rooms cr WHERE ((cr.id = messages.chat_id) AND ((cr.customer_id = (select auth.uid())) OR (cr.barber_id = (select auth.uid()))))))));
alter policy messages_select_participants on public.messages using ((EXISTS ( SELECT 1 FROM chat_rooms cr WHERE ((cr.id = messages.chat_id) AND ((cr.customer_id = (select auth.uid())) OR (cr.barber_id = (select auth.uid())))))));
alter policy portfolio_write_own on public.portfolio using ((barber_id = (select auth.uid()))) with check ((barber_id = (select auth.uid())));
alter policy services_write_own on public.services using ((barber_id = (select auth.uid()))) with check ((barber_id = (select auth.uid())));
alter policy users_update_own on public.users using ((id = (select auth.uid()))) with check ((id = (select auth.uid())));
alter policy verification_requests_insert_own on public.verification_requests with check ((user_id = (select auth.uid())));
alter policy verification_requests_select_own on public.verification_requests using ((user_id = (select auth.uid())));
alter policy verification_requests_update_own on public.verification_requests using (((user_id = (select auth.uid())) AND (status = ANY (ARRAY['pending'::verification_status_type, 'rejected'::verification_status_type])))) with check (((user_id = (select auth.uid())) AND (status = ANY (ARRAY['pending'::verification_status_type, 'rejected'::verification_status_type]))));
alter policy typing_broadcast_recv_participants on realtime.messages using (((extension = 'broadcast'::text) AND (split_part(realtime.topic(), ':'::text, 1) = 'typing'::text) AND (EXISTS ( SELECT 1 FROM chat_rooms cr WHERE (((cr.id)::text = split_part(realtime.topic(), ':'::text, 2)) AND ((cr.customer_id = (select auth.uid())) OR (cr.barber_id = (select auth.uid()))))))));
alter policy typing_broadcast_send_participants on realtime.messages with check (((extension = 'broadcast'::text) AND (split_part(realtime.topic(), ':'::text, 1) = 'typing'::text) AND (EXISTS ( SELECT 1 FROM chat_rooms cr WHERE (((cr.id)::text = split_part(realtime.topic(), ':'::text, 2)) AND ((cr.customer_id = (select auth.uid())) OR (cr.barber_id = (select auth.uid()))))))));

create index if not exists notifications_booking_id_idx on public.notifications (booking_id);
create index if not exists notifications_actor_id_idx on public.notifications (actor_id);
create index if not exists notifications_message_id_idx on public.notifications (message_id);
create index if not exists user_reports_booking_id_idx on public.user_reports (booking_id);

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select (select auth.uid()) in (p_a, p_b)
    and exists (
      select 1 from public.user_blocks ub
      where (ub.blocker_id = p_a and ub.blocked_id = p_b)
         or (ub.blocker_id = p_b and ub.blocked_id = p_a)
    );
$function$;
