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

## In progress

- C S1 feature flags: migration 0062, rollback, pgTAP test, client hook and
  unit tests written; unit tests pass.

## Next

- C S2 proof look and look match: 0063 written (core), next 0064 (reports
  and notifications), rollbacks, pgTAP tests, delete-account Edge Function,
  barber capture screen, customer confirm screen, look feedback on the review
  screen, Maestro flows.

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
