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
  0 new failures. Commit f256166.

- C S4 look search: 0066 + rollback + pgTAP (match_look: proof in the style,
  free in the window by the same rule as validate_booking_slot incl. the
  30-minute travel buffer, same city, no block, never a location; private
  `look-references` bucket, owner upload, booked barber reads only while the
  request is pending or accepted; attach_look_reference gains the optional
  photo). delete-account also empties the client's `look-references` folder.
  Client: matchLook / uploadReferencePhoto / signReferencePhoto, LookSearch
  screen (style, 7 days, 4 windows, optional photo, instant matches, "Book at
  HH:MM" straight into the address step), "Find a look" on the Discover
  rail, barber reference note shows "booked through look search" and the
  photo. Maestro flow customer-look-search.yaml. Gate: 970 jest tests, 0 new
  failures. Commit: see git log ("Looks S4").

- C S5 look wish and offers: 0067 + rollback + pgTAP (look_wishes,
  look_wish_offers, create_wish / cancel_wish / wish_offers / accept_offer,
  open_wishes / offer_for_wish / withdraw_offer; expiry computed on read;
  offers only from approved same-city barbers with proof, inside the
  window, free by the booking rule incl. travel buffer, at the normal
  service price, note through the denylist; accept links a matching normal
  pending booking from create_booking and attaches the wish style and photo
  as the reference; notifications.booking_id nullable + look_wish_id +
  look_wish / look_offer events and push copy, every older event still
  needs its booking; reports for wish and offer; wish photo visible to
  barbers who may answer while it is open). Client: wishData, "Send as a
  wish" on an empty search, customer LookWishes screen (offers, book into
  the address step, withdraw, report), barber LookWishes screen (service,
  start, note, send, change, withdraw, report) with an entry in Requests,
  notification and push routing, shared LookOfferCard and openLookBooking.
  Gate: 994 jest tests, 0 new failures. Commit: see git log ("Looks S5").

- C S6 look pass: 0068 + rollback + pgTAP (my_looks(): the client's own
  confirmed or published looks, reference photo or booked feed look next to
  the result, result photos only while shown, can_rebook false across a
  block or for an unapproved barber; read-only, no table). Client:
  fetchMyLooks, useLookPass, LookPass screen (reference and result side by
  side on the portfolio grid, calm placeholders, "This look again" into the
  date step with the same barber and service). The Discover rail now keeps
  its title and the two entries (look search, look pass) when the city has
  no looks yet (it still hides on load failure). Also fixed: single look
  photos in S4/S5 (search photo, barber reference note, barber wish photo)
  rendered at about a quarter width; they now fill a half-width slot. Maestro
  flow customer-look-pass.yaml. Gate: 998 jest tests, 0 new failures.
  Commit: see git log ("Looks S6").

- Gap found while writing LOOKS.md: section 6 lists "Stil-Statistik im
  Studio" for barbers, never built (barber_look_stats was used only on the
  customer look detail). Added LookStatsCard in the Studio behind the flag
  (proof per style, exact-hit rate once revealed, nudge when empty, hidden on
  failure). No migration. Gate: 1001 jest tests, 0 new failures. Commit: see
  git log ("look stats in the Studio").

## In progress

- Final: LOOKS.md "what was built and how to switch it on" (exact SQL in
  order, flag for Taha and Ali), then the final MORNING.md pass.

## Next

- Nothing else in NIGHT_SHIFT.md after that.

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
