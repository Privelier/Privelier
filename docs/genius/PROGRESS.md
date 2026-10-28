# Night shift 2026-10-28: progress

Resume point for the next session. Updated after every item.

## Done

- A1 git fetch: origin/main at 501f7f2.
- A2 Local main (5e44332, an ancestor of origin/main) had 13 modified and 4
  untracked work files (chat counterpart names). Committed on
  backup/taha-2026-10-28 as de8c0ed. Not pushed. The 350 MB APK and a phone
  screenshot in .codex-eas-project-check/ stay untracked on disk (GitHub
  rejects files over 100 MB).
- A4 night/2026-10-28 created from origin/main (it tracks origin/main; push it
  with an explicit refspec, see MORNING.md).
- A5 First night commit 3db6644: GENIE_PROTOKOLL.md, LOOKS.md, TOUREN.md,
  NIGHT_SHIFT.md.
- A6 npm ci: exit 0. Baseline `npm run check` (see "Check baseline" below).
- B1 to B3: LOOKS_REVIEW.md written, LOOKS.md sections 5 and 6 improved.

- C S1 feature flags: commit f6797c7 (0062 + rollback + pgTAP, useFeatureFlag
  with 9 unit tests). No Maestro flow: S1 has no screen.

- C S2 proof look and look match: 0063 + 0064 with rollbacks and pgTAP,
  delete-account Edge Function (looks bucket, customer look photos),
  src/looks data layer, barber LookCapture screen (from completed booking
  details), customer LookConfirm screen (from the look_confirm notification
  and push), look question on the review screen, look reports, 2 Maestro
  flows. Gate: tsc/lint/knip/jscpd/madge green, jest 942 tests, 0 new
  failures. Commit: see git log ("Looks S2").

- C S3 feed, look detail, "This look": 0065 + rollback + pgTAP, looks_feed
  (customers only, same city, published, approved, no block, no client
  identity), attach_look_reference after create_booking, Discover rail with
  labelled portfolio fill, LookDetail screen with proof chain and hit rate,
  lookReference threaded through BookingDateTime/Location/Confirm (absent =
  unchanged flow), barber reference note, Maestro flow. Gate: 955 jest tests,
  0 new failures.

## In progress

- C S4 look search: 0066 + rollback written (match_look, look-references
  bucket, attach_look_reference with photo). Next: pgTAP test, data layer,
  LookSearch screen (style, day, window, optional photo, instant matches,
  book straight into the address step), entry from the Discover rail,
  Maestro flow.

## Next

- S4 look search, S5 wish and offers, S6 look pass.

## Check baseline (2026-10-28, origin/main 501f7f2, this machine)

`npm run check` fails at its first step, so tonight every step runs on its own:

| Step | Baseline | Cause |
|---|---|---|
| typecheck | 6 errors, all in `artifacts/privelier-rebuild/` | untracked local build copy; jest and eslint ignore `artifacts/`, tsconfig does not |
| lint | 0 | |
| jest | 60 of 898 failing, 24 suites | machine locale German and timezone Europe/Berlin; tests assume en-US/UTC like CI. List: docs/genius/jest-baseline-failures.txt |
| unused (knip) | green | |
| dup (jscpd) | 1.37 % | |
| circular (madge) | none | |

Commit rule used tonight: tsc has zero errors outside `artifacts/`, lint 0,
`python docs/genius/jest_compare.py compare <jest output>` reports 0 new
failures, knip, jscpd and madge green.

## Environment facts for the next session

- Supabase MCP server failed to connect tonight; no live reads were possible.
- No local Postgres, Docker or SQL parser is installed. pgTAP files are written
  but NOT executed. They run only through
  `python tools/db/supa.py test --with <migrations> -- <test>`, which executes
  the staged migrations inside a rolled-back transaction on the live project.
  That is a founder decision (night rule: no writes to the live database).
- `git config`, `git ls-tree` and writes outside the repo are not permitted in
  this session.
