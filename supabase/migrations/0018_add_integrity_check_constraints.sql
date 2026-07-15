-- Additive integrity-constraint bundle (founder-directed, barber bio-edit
-- pipeline run — Stage 3 / T2). Design locked by architect-review
-- (APPROVED WITH CONDITIONS).
--
-- SCOPE: THREE CHECK constraints across three tables. Nothing else. No new
-- columns, no data changes, no RLS/policy changes, no indexes, no triggers.
-- Pure data-integrity hardening — each constraint closes a raw-API abuse path
-- that the client-side guards cannot enforce on their own.
--
-- WHY CHECK CONSTRAINTS (not triggers): these are simple, row-local,
-- immutable predicates — exactly what CHECK is for. They run on every INSERT
-- and UPDATE, including raw PostgREST/service-role writes the app never issues.
--
-- LIVE DATA VERIFIED NON-VIOLATING THIS SESSION (so the ADDs cannot abort on
-- existing rows):
--   * barber_profile: all bios are NULL           -> chk_barber_profile_bio_len holds
--   * messages:       0 empty, longest message 24 -> chk_messages_message_len holds
--   * portfolio:      0 rows                       -> chk_portfolio_image_url_folder holds
-- Apply is transactional: were any live row to violate a predicate, the whole
-- migration would abort and roll back cleanly, leaving the schema untouched.
--
-- IDEMPOTENT: Postgres has no ADD CONSTRAINT IF NOT EXISTS for CHECK, so each
-- ADD is guarded in a DO block that checks pg_constraint (conname + conrelid)
-- and only adds when absent — safe to run twice.

-- ============================================================
-- 1. barber_profile.bio — length/emptiness bound
--    bio is customer-facing (public via the barber_directory view) and
--    client-writable via RLS barber_profile_update_own. Without this a raw-API
--    caller could store whitespace-only or arbitrarily large bio text. NULL
--    stays allowed and means "no bio"; a present bio must be 1..500 chars after
--    trimming (so "   " is rejected, but leading/trailing space is tolerated).
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_barber_profile_bio_len'
      and conrelid = 'public.barber_profile'::regclass
  ) then
    alter table public.barber_profile
      add constraint chk_barber_profile_bio_len
      check (bio is null or char_length(btrim(bio)) between 1 and 500);
  end if;
end $$;

-- ============================================================
-- 2. messages.message — non-empty, sane maximum
--    Closes the tracked messages.message hardening gap: a raw-API participant
--    could otherwise insert empty or arbitrarily large message text, bypassing
--    the send path's client-side trim/guard. Message text must be 1..2000
--    chars after trimming (empty/whitespace-only rejected). NOT NULL is already
--    enforced by the column definition.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_messages_message_len'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint chk_messages_message_len
      check (char_length(btrim(message)) between 1 and 2000);
  end if;
end $$;

-- ============================================================
-- 3. portfolio.image_url — folder segment bound to owner
--    Closes tracked finding L1: binds the stored object path's first folder
--    segment to the owning barber_id so a barber cannot raw-insert a row whose
--    image_url points at another barber's folder (attribution/integrity). The
--    write path stores image_url as exactly `{barberId}/img-{ts}-{rand}.jpg`,
--    so split_part(image_url,'/',1) = barber_id::text holds by construction for
--    every legitimate row.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_portfolio_image_url_folder'
      and conrelid = 'public.portfolio'::regclass
  ) then
    alter table public.portfolio
      add constraint chk_portfolio_image_url_folder
      check (split_part(image_url, '/', 1) = barber_id::text);
  end if;
end $$;
