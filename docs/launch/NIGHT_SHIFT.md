# Night shift 2026-10-28: Privelier Looks

Owner: Taha (founder). Executor: Claude Code, unattended, in print mode.
Taha is asleep. Nobody can answer questions or approve anything tonight.
Work through everything below in order, as far as you get. Never stop to
ask. When something needs Taha, write it into docs/genius/MORNING.md and
continue.

docs/launch/LAUNCH_PROGRAM.md is superseded by Ali's hardening run
(docs/quality/2026-10-27-hardening-report.md). Do not execute it.

## Night rules (they override every other file tonight)

- Work only on the local branch night/2026-10-28. Never touch main.
- Never push, never pull after the start, never force anything. Commits stay
  local. Taha pushes in the morning.
- No writes to the live database. Allowed Supabase MCP calls: list_tables,
  list_migrations, list_extensions, list_edge_functions, get_advisors,
  get_logs, search_docs. Migrations are written as files (next free number),
  each with a rollback file in supabase/rollbacks/ and pgTAP tests in
  supabase/tests/, never applied.
- No deleting files, no git reset, clean, restore, stash or checkout -- .
- No EAS builds, no new native dependencies tonight. Use what is installed.
- Do not redesign. Use the existing design tokens, glass primitives, motion
  kit, components, i18n setup and testID conventions. Do not change existing
  booking states or the existing solo booking flow.
- `npm run check` must be green before every commit. If an item cannot be
  made green, commit nothing for it, note it in MORNING.md, move on.
- If a command is denied by permissions, do not retry it in another form.
  Note it and continue.
- Keep docs/genius/PROGRESS.md updated after every item (done, in progress,
  next), so the next session can resume exactly.
- Never print or commit secret values.

## Part A: safe sync

1. git fetch.
2. If there are local changes or local commits that origin/main does not
   have: create branch backup/taha-2026-10-28 and commit them there, EXCEPT
   docs/launch/, docs/genius/ and .claude/settings.local.json. Do not push.
3. docs/launch/ and docs/genius/ are untracked: never stash, move or delete
   them.
4. Create night/2026-10-28 from origin/main and switch to it.
5. First commit on the night branch: docs/genius/GENIE_PROTOKOLL.md,
   docs/genius/LOOKS.md, docs/genius/TOUREN.md and docs/launch/NIGHT_SHIFT.md.
6. npm ci (or npm install if ci fails), then npm run check. Record the
   baseline. Pre-existing failures are recorded, not fixed.

## Part B: pessimistic review of LOOKS against the real code

The founder chose docs/genius/LOOKS.md (Looks plus Wish). docs/genius/TOUREN.md
is rejected: never build it.

1. Read LOOKS.md completely, then review it against the real code and attack
   it pessimistically: reviews (0022, 0036 to 0038), portfolio and storage
   (0016, 0047), EXIF handling, reports and denylist (0056), rate limits
   (0055), account deletion (0057), blocks (0042, 0053), notifications (0035,
   0049), barber_stats (0050), the booking creation path (0054 create_booking)
   and the customer and barber screens involved.
2. Web research: verify the novelty claims in LOOKS.md section 5 (Booksy,
   Fresha, Treatwell, Planity, Squire, theCut and others). Cite URL and date.
   Correct any claim that turns out wrong.
3. Write docs/genius/LOOKS_REVIEW.md: every blocker, every conflict with a
   founder rule, every place where the spec does not fit the code, each with
   the fix. Then update LOOKS.md to the improved version. Never change the
   concept, the founder rules or decisions L1 to L6; build with the
   suggested defaults and keep them configurable.

## Part C: build LOOKS behind a feature flag, slice by slice

Follow LOOKS.md section 8. Every slice is complete on its own: migration
files with rollback and pgTAP tests (allow and deny cases under real roles,
following supabase/tests/authorization_matrix.test.sql), domain logic with
unit tests, screens, German and English strings, accessibility labels,
testIDs, Maestro flow files. `npm run check` green, then commit.

- S1 Feature flags: feature_flags, feature_flag_users, my_feature_flags(),
  client hook that returns "off" when the function is missing, errors or the
  flag is absent. Nothing new is visible until the migration is applied and
  a user is added to the flag.
- S2 Proof look and look match: barber captures the result after
  "complete" with the existing system photo picker (no camera permission,
  no app config change, no new build; a camera option is a later founder
  decision), customer confirms "Is this your cut?" and consent to show,
  look feedback exact / close / miss, barber_look_stats with a minimum count.
  Extend reports, denylist, rate limits, notifications and account deletion
  in their own migration files with tests.
- S3 Looks feed in Discover, look detail with the proof chain, "This look"
  into the existing booking flow with the reference attached.
- S4 Look search with instant matches (proof in style, free in the window,
  same city), never exposing exact locations.
- S5 Look wish and offers, price fixed to the barber's service price,
  accept creates a normal pending booking through the existing path.
- S6 Look pass.

Finally update LOOKS.md with what was built and how to switch it on: the
exact SQL to apply the migrations in order and to add Taha and Ali to the flag.

## Part D: docs/genius/MORNING.md (write last, update whenever you skip something)

German, tables, no em dashes:

1. Was die pessimistische Prüfung (LOOKS_REVIEW.md) gefunden und verbessert hat, in 5 Sätzen
2. Was heute Nacht gebaut wurde: Schritt, Status, Commit
3. Was Taha freigeben muss, in dieser Reihenfolge: pushes (Befehle), Migrationen (was sie ändern, Risiko, Rollback), Feature-Schalter einschalten
4. Entscheidungen L1 bis L6, jeweils mit Empfehlung, plus neue Entscheidungen aus der Prüfung
5. Was Taha am Handy testen soll, und ob ein neuer nativer Build nötig ist
6. Wichtig vor dem Start: Die App braucht in .env jetzt EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY statt des alten Anon-Keys (docs/hardening/FOUNDER_ACTIONS.md, F1), sonst startet sie nicht
7. Wo es morgen weitergeht: der genaue nächste Schritt aus PROGRESS.md
