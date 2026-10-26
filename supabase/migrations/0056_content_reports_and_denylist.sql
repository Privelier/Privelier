-- User-generated content safety (hardening 2026-10-26, Phase 6; App Store
-- guideline 1.2, Google Play UGC policy).
--
-- 1. Reports can target a user, a chat message or a review. The reporter
--    must be able to see the target (a message in their own conversation,
--    or any review), and the reported text is snapshotted onto the report
--    so the founders can act on it even after the content is deleted.
-- 2. A server-side denylist rejects listed terms in chat messages and
--    review comments before they are stored (SQLSTATE PA030). Matching is
--    on whole words after lowercasing and stripping punctuation. The list
--    is deliberately small (slurs and direct threats in English and
--    German); founders extend it in private.content_denylist.

alter table public.user_reports
  add column target_type text not null default 'user'
    check (target_type in ('user', 'message', 'review')),
  add column target_id uuid,
  add column target_excerpt text check (target_excerpt is null or char_length(target_excerpt) <= 2000),
  add constraint user_reports_target_present
    check ((target_type = 'user') = (target_id is null));

grant insert (target_type, target_id) on public.user_reports to authenticated;

create or replace function private.resolve_report_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reporter uuid := new.reporter_id;
begin
  new.target_excerpt := null;
  if new.target_type = 'message' then
    select m.message, m.sender_id into new.target_excerpt, new.reported_id
    from public.messages m
    join public.chat_rooms cr on cr.id = m.chat_id
    where m.id = new.target_id
      and (cr.customer_id = v_reporter or cr.barber_id = v_reporter)
      and m.sender_id <> v_reporter;
    if not found then
      raise exception 'message not found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'review' then
    select r.comment, r.customer_id into new.target_excerpt, new.reported_id
    from public.reviews r
    where r.id = new.target_id and r.customer_id is distinct from v_reporter;
    if not found then
      raise exception 'review not found' using errcode = 'P0002';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.resolve_report_target() from public, anon, authenticated;

create trigger trg_resolve_report_target before insert on public.user_reports
  for each row execute function private.resolve_report_target();

-- 2. Denylist ------------------------------------------------------------
create table private.content_denylist (
  term text primary key check (term = lower(btrim(term)) and term <> ''),
  added_at timestamptz not null default now()
);
alter table private.content_denylist enable row level security;
revoke all on private.content_denylist from public, anon, authenticated;

insert into private.content_denylist (term) values
  ('kill yourself'), ('kys'), ('i will kill you'), ('i am going to kill you'),
  ('nigger'), ('nigga'), ('faggot'), ('retard'), ('tranny'), ('chink'), ('spic'), ('kike'),
  ('bring dich um'), ('ich bring dich um'), ('ich werde dich umbringen'), ('töte dich'),
  ('neger'), ('kanake'), ('schwuchtel'), ('missgeburt'), ('fotze'), ('hurensohn')
on conflict do nothing;

create or replace function private.assert_allowed_text(p_text text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_norm text;
begin
  if p_text is null or btrim(p_text) = '' then
    return;
  end if;
  v_norm := ' ' || regexp_replace(lower(p_text), '[^[:alnum:]äöüß]+', ' ', 'g') || ' ';
  if exists (
    select 1 from private.content_denylist d
    where v_norm like '% ' || d.term || ' %'
  ) then
    raise exception 'This text contains language that is not allowed on Privelier'
      using errcode = 'PA030';
  end if;
end;
$function$;
revoke all on function private.assert_allowed_text(text) from public, anon, authenticated;

create or replace function private.screen_message_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_allowed_text(new.message);
  return new;
end;
$function$;

create or replace function private.screen_review_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.assert_allowed_text(new.comment);
  return new;
end;
$function$;
revoke all on function private.screen_message_text() from public, anon, authenticated;
revoke all on function private.screen_review_text() from public, anon, authenticated;

create trigger trg_screen_message_text before insert on public.messages
  for each row execute function private.screen_message_text();
create trigger trg_screen_review_text before insert or update of comment on public.reviews
  for each row execute function private.screen_review_text();
