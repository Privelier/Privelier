-- Hardening bundle for three tracked, founder-approved findings. Each one is a
-- LATENT hole: none is exploitable through the app as it stands today, and each
-- is currently closed only by something OTHER than the guard that should be
-- closing it (a missing GRANT, a well-behaved client, an untouched column).
-- This migration moves all three from "safe by accident" to "safe by rule".
--
-- SCOPE: one RLS policy WITH CHECK (verification_requests), one CHECK
-- constraint (chat_read_state), one CREATE OR REPLACE of an existing trigger
-- function (bookings). Nothing else. NO new tables, NO new columns, NO data
-- migration, NO grant changes, NO trigger re-creation, NO index changes.
--
-- EXPLICITLY NOT DONE — see section 1's note: this migration does NOT add any
-- UPDATE grant on public.verification_requests. Postgres's own error HINT
-- suggests one; following it is a privilege escalation. Section 1 exists so
-- that following it would at least no longer be catastrophic — it is NOT
-- permission to follow it.
--
-- LIVE STATE VERIFIED 2026-07-21 (measured, not assumed):
--   * verification_requests_update_own: USING pins user_id + status in
--     (pending, rejected); WITH CHECK pins user_id ONLY. `authenticated` holds
--     column-level UPDATE on (id_image_url, license_image_url) and NO
--     table-level UPDATE.
--   * public.enforce_booking_status_transition() freezes exactly price,
--     service_id, date, time, location, customer_id, barber_id — not id, not
--     created_at.
--   * chat_read_state rows: no existing row has a future last_read_at, so the
--     new CHECK can be added VALIDATED without aborting.
-- Apply is transactional: any violating live row aborts the whole migration
-- cleanly rather than half-applying it. Whoever applies this should re-verify
-- the chat_read_state fact at apply time (same discipline as 0018 / 0020).
--
-- IDEMPOTENT / RE-RUNNABLE: the policy uses drop-then-create (0014/0015 idiom);
-- the CHECK is guarded in a DO block keyed on pg_constraint conname + conrelid
-- (0015 §3 / 0018 / 0020 idiom, since Postgres has no ADD CONSTRAINT IF NOT
-- EXISTS for CHECK); CREATE OR REPLACE FUNCTION is natively re-runnable.

-- ============================================================
-- 1. verification_requests_update_own — pin `status` in WITH CHECK.
--
--    TODAY: USING restricts WHICH rows may be updated (own row, and only while
--    pending or rejected), but WITH CHECK — which governs the row's state AFTER
--    the write — re-asserts ownership only. A caller who can issue an UPDATE at
--    all can therefore set status = 'approved' on their own request and forge
--    reviewed_by / reviewed_at: USING passes (the row was 'pending' BEFORE the
--    write), and WITH CHECK does not look at status at all.
--
--    WHY THAT IS NOT EXPLOITABLE RIGHT NOW, AND WHY THAT IS NOT GOOD ENOUGH:
--    the only thing stopping it is 0015 §6's column-grant guardrail —
--    `authenticated` holds UPDATE on (id_image_url, license_image_url) and
--    nothing else, so a status write dies 42501 at the privilege layer before
--    RLS is ever consulted. That is a grant, not a policy, and grants are
--    exactly the thing a future migration or a debugging session is most likely
--    to "fix". Postgres's 42501 HINT on that failure literally reads
--    `GRANT UPDATE ON public.verification_requests TO authenticated` — the wrong
--    fix was already attempted once from that hint (see 0020's header). One
--    person following the hint silently re-opens self-approval.
--
--    DO NOT ADD A TABLE-LEVEL UPDATE GRANT ON THIS TABLE. If some future need
--    genuinely requires it, the policy below is what keeps that from being a
--    security incident — do not weaken it in the same breath.
--
--    WHY THE POLICY AND NOT THE TRIGGER: 0015 §5's requeue trigger only forces
--    status back to 'pending' when an IMAGE column actually changes, so a
--    status-ONLY update sails straight through it untouched. The trigger is
--    deliberately shaped that way (a founder's dashboard approval must not be
--    clobbered by it), so widening the trigger would break the founders' review
--    path. WITH CHECK is the correct layer: it constrains the client's
--    post-write state without touching the service_role path at all (RLS does
--    not apply to service_role).
--
--    WHAT THIS FORBIDS: a client-issued UPDATE that leaves the row in any
--    status other than 'pending' or 'rejected'. The app never writes status —
--    submitVerificationDocument sends only an image column — so the honest path
--    is unaffected. The requeue trigger stamps 'pending', which satisfies the
--    predicate. Founder approvals run as service_role and bypass RLS entirely.
--
--    The predicate is intentionally identical to the USING clause so the two
--    read as one rule: a barber may touch their own request only while it is in
--    the queue, and may only leave it in the queue.
-- ============================================================

drop policy if exists verification_requests_update_own on public.verification_requests;
create policy verification_requests_update_own
  on public.verification_requests for update
  to authenticated
  using (
    user_id = auth.uid()
    and status in ('pending'::verification_status_type, 'rejected'::verification_status_type)
  )
  with check (
    user_id = auth.uid()
    and status in ('pending'::verification_status_type, 'rejected'::verification_status_type)
  );

-- ============================================================
-- 2. chat_read_state.last_read_at — bound the VALUE to (about) the past.
--
--    Closes the read-receipts security finding L1. Since 0017 this column is no
--    longer private read-state: it is a receipt the COUNTERPART can see. The
--    two write policies (0014, widened by 0017) constrain WHO writes and WHICH
--    room, but never the VALUE — so a raw-API participant can upsert a
--    far-future last_read_at and show the other person a permanent "Read" for
--    messages that have not been sent yet. Nothing in the app does this: the
--    marker is written as exactly the newest known message's server-generated
--    created_at (src/shared/unread.ts resolveReadMarker — the device clock is
--    deliberately never consulted), which is by construction already in the
--    past when the write happens. This constraint exists purely to bound raw
--    callers.
--
--    TOLERANCE DECISION — small forward tolerance, NOT a hard `<= now()`:
--
--      * `now()` is TRANSACTION START time, not wall time. Every legitimate
--        marker is a message's created_at stamped by the same Postgres cluster
--        in an EARLIER transaction, so `<= now()` holds for the app path with
--        room to spare, and the table's `default now()` satisfies it by exact
--        equality. A hard bound would work today.
--      * But the property the finding is about is a PERMANENT fake receipt. A
--        bounded window is not a durable lie: with a 1-minute ceiling, any
--        counterpart message sent more than a minute later is newer than the
--        forged marker and the room re-flags as unread on its own. The lie
--        expires without operator action. Hard-vs-tolerant is therefore very
--        nearly a wash on the security axis.
--      * On the availability axis they are NOT a wash. A CHECK constraint,
--        unlike this codebase's RLS/trigger guards, has NO service_role
--        exemption — it binds founder dashboard writes, future admin tooling
--        and any backfill too. A hard `<= now()` turns every near-boundary
--        write into a 23514 that surfaces to the user as "mark as read failed,
--        badge stuck", for zero additional protection against the actual abuse.
--      * So: `<= now() + interval '1 minute'`. It refuses the abuse the finding
--        describes, tolerates any plausible near-now write, and stays trivially
--        readable. 1 minute is a deliberate round number — small enough that a
--        forged receipt cannot outlive a conversation, large enough that no
--        honest write can ever trip it.
--
--    RETROACTIVE SAFETY (checked, not assumed). Two separate questions:
--      a) Existing rows. Every stored marker is a past timestamp, verified live
--         2026-07-21, so ADD CONSTRAINT's validation scan passes and no
--         NOT VALID + VALIDATE split is warranted. Adding it validated is what
--         we want anyway — a NOT VALID constraint would leave already-forged
--         rows permanently exempt, which is precisely the state to eliminate.
--      b) Dump/restore. A CHECK containing a non-immutable function is legal in
--         Postgres but is re-evaluated on every reload, so it is worth being
--         explicit about the direction: this predicate is UPPER-bounded by
--         now(), and now() only ever increases. A row that satisfies it today
--         satisfies it at every future restore, with more slack, forever. (The
--         unsafe shape is the mirror image — a LOWER bound against now(), e.g.
--         "must be in the future" — which rots. This is not that.) Untrusted
--         input is still the only thing being bounded; no row can become
--         invalid by the passage of time.
--
--    Same class as 0018's bundle and 0020 §2: a row-local predicate closing a
--    raw-API path the client-side guards structurally cannot reach.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_chat_read_state_last_read_not_future'
      and conrelid = 'public.chat_read_state'::regclass
  ) then
    alter table public.chat_read_state
      add constraint chk_chat_read_state_last_read_not_future
      check (last_read_at <= now() + interval '1 minute');
  end if;
end $$;

-- ============================================================
-- 3. enforce_booking_status_transition() — extend the column freeze to
--    `id` and `created_at`.
--
--    Closes the LOW tracked from the 0011 security gate. The freeze introduced
--    in 0003 and carried through 0011 lists price, service_id, date, time,
--    location, customer_id, barber_id — every column the booking's MEANING
--    depends on — but not the two columns describing its IDENTITY. RLS
--    bookings_update_participants lets either participant UPDATE the row, so a
--    raw-API participant can today rewrite a booking's primary key (breaking
--    every FK-adjacent reference the app resolves by id, including the chat
--    room created against it by 0013) or forge created_at (an audit/ordering
--    fact that will matter the moment money and disputes are involved). Neither
--    is a state-machine transition; both slip past the trigger because the
--    trigger never looks at those columns.
--
--    The app cannot notice the difference: both booking UPDATE paths
--    (requestsData.updateBookingStatus, bookingsData's customer cancel) send
--    exactly `{ status }` and nothing else, so NEW.id / NEW.created_at are
--    always identical to OLD's and the two new comparisons are always false.
--    Verified against the source, not assumed.
--
--    WHY A FULL CREATE OR REPLACE: the function is replaced wholesale (there is
--    no way to patch a plpgsql body in place), so the body below reproduces the
--    live 0011 definition VERBATIM — same LANGUAGE, same SET search_path, same
--    transition shapes in the same order, same actor comparisons, same RAISE
--    message strings byte-for-byte, same `auth.role() is distinct from
--    'service_role'` gating on every actor check. The ONLY differences from the
--    live body are the two added column comparisons in the freeze block and the
--    corrected attribution comment above it. The booking state machine is
--    unchanged by this migration; do not read the re-emitted body as a redesign.
--
--    The existing BEFORE UPDATE trigger `trg_enforce_booking_status_transition`
--    on public.bookings is deliberately NOT re-created here — it binds by name
--    and CREATE OR REPLACE FUNCTION swaps the body underneath it (same handling
--    as 0011).
--
--    service_role remains fully exempt from the freeze, as it has been since
--    0003: the two new comparisons live inside the existing non-service_role
--    guard, so a server-owned path can still correct an id or a created_at if
--    it ever legitimately needs to.
-- ============================================================

create or replace function public.enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  -- Column-immutability freeze (from 0003, actor rationale unchanged since
  -- 0011; 0021 added `id` and `created_at` to the frozen list — identity and
  -- audit columns, previously unfrozen and rewritable by either participant):
  -- only `status` may move, and only for non-service_role callers. Guarantees
  -- OLD.barber_id / OLD.customer_id are trustworthy actors for the checks below.
  if auth.role() is distinct from 'service_role' then
    if new.price is distinct from old.price
      or new.service_id is distinct from old.service_id
      or new.date is distinct from old.date
      or new.time is distinct from old.time
      or new.location is distinct from old.location
      or new.customer_id is distinct from old.customer_id
      or new.barber_id is distinct from old.barber_id
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Only booking status may be changed once a booking is created';
    end if;
  end if;

  -- Same-status write (e.g. a re-save that changes nothing): no state-machine
  -- transition to authorize. Shared by all callers, as before.
  if new.status = old.status then
    return new;
  end if;

  -- Transition SHAPE + actor matrix. Each actor RAISE is gated to
  -- non-service_role so the service_role path remains bounded only by the
  -- transition shape, exactly as it was before this migration.
  if old.status = 'pending' and new.status = 'accepted' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.barber_id then
      raise exception 'Only the barber may accept a booking';
    end if;
    return new;
  end if;

  if old.status = 'pending' and new.status = 'rejected' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.barber_id then
      raise exception 'Only the barber may reject a booking';
    end if;
    return new;
  end if;

  -- NEW founder-approved transition (2026-07-09): a customer may cancel their
  -- own booking while it is still pending. This shape did not exist in 0003.
  if old.status = 'pending' and new.status = 'cancelled' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.customer_id then
      raise exception 'Only the customer may cancel a pending booking';
    end if;
    return new;
  end if;

  if old.status = 'accepted' and new.status = 'completed' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.barber_id then
      raise exception 'Only the barber may complete a booking';
    end if;
    return new;
  end if;

  if old.status = 'accepted' and new.status = 'cancelled' then
    if auth.role() is distinct from 'service_role'
       and auth.uid() is distinct from old.barber_id
       and auth.uid() is distinct from old.customer_id then
      raise exception 'Only a booking participant may cancel an accepted booking';
    end if;
    return new;
  end if;

  raise exception 'Invalid booking status transition: % -> %', old.status, new.status;
end;
$function$;
