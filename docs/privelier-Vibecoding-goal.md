# Privelier — harden, de-vibe, and make store-ready

Save this file in the repo as `docs/hardening/codex-goal.md`, then start Codex with the one-line `/goal` at the bottom.

---

## Objective

Bring the Privelier codebase (Customer app, Barber app, shared code, Supabase backend) to the standard of a senior engineering team: no data exposure, no privilege escalation, no unbounded abuse paths, database-enforced business rules, clean and consistent code, and nothing that gets the apps rejected by Apple App Store or Google Play review.

Work in phases, in order. Each phase ends with evidence (command output, test results, file references), not claims. Preserve existing behavior unless you are fixing a confirmed defect, and every behavior change ships with a test that fails without the fix.

## Definition of done

The goal is complete only when every item is PASS, or BLOCKED with the exact reason and the founder action that unblocks it:

1. Every table, view, function, storage bucket and realtime channel reachable by `anon` or `authenticated` appears in the authorization matrix, and each allowed and denied cell has a passing automated test run under real roles. ✅
2. `supabase db lint` (or the Security and Performance Advisors through the Supabase MCP, if connected) reports no ERROR, and every remaining WARN is fixed or justified in the report. ✅
3. Overlapping bookings for the same barber are impossible at the database level, proven by a concurrency test. ✅
4. Every write path a user can reach has a rate limit or hard cap, proven by tests. ✅
5. No secret exists in the working tree, git history, or a built JS bundle (gitleaks or trufflehog, redacted output). The app ships only the project URL and the publishable key. ✅
6. Both apps have in-app account deletion backed by a server-side function, plus report, block and content filtering for chat messages and reviews. ✅
7. Store technical requirements pass: Android target SDK 36, 16 KB page size compatibility, no `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`, specific iOS permission strings, privacy manifest coverage. ✅
8. `typecheck`, `lint` (zero warnings), unit and integration tests, `supabase test db`, knip, jscpd and `npx expo-doctor` all pass. ✅
9. `docs/quality/<YYYY-MM-DD>-hardening-report.md` contains the gate table, the ledger, and `docs/hardening/FOUNDER_ACTIONS.md` lists every dashboard-only step. ✅

## Product context

- Privelier is a private, premium, on-demand barber marketplace: verified independent barbers travel to customers' homes, offices or hotels.
- Two separate Expo / React Native apps (Customer and Barber) share one codebase and one Supabase backend: Postgres, Auth, Storage, Realtime, RLS. There is no custom server.
- Roles: customer, barber, admin. Admin is the two founders working directly in the Supabase dashboard; there is no admin app or hidden admin mode, and none should be added.
- Booking lifecycle: `pending → accepted → completed`, `pending → rejected`, `pending/accepted → cancelled`. Only the booking's barber accepts, rejects or completes; only the customer cancels their own pending booking. Price is snapshotted at booking time.
- Chat: one thread per booking, text only, maximum 2000 characters, realtime, read receipts and typing indicators over private broadcast channels.
- Reviews: only after a completed booking, only by that booking's customer, 1–5 stars plus optional comment, one per booking.
- Barber verification is manual. ID and license photos live in a private bucket and only the founders approve or reject. Portfolio photos (max 6) are public.
- A barber's exact location is private. A database trigger stores a one-time 200–500 m randomized public offset for the Explore map.
- Known gaps you must close: the double-booking guard only blocks identical start times, not overlaps; there is no account deletion; there is no report, block or filter for chat or reviews.
- Not in scope, do not build: payments or Stripe, push notifications, live location or SOS, automated ID or biometric checks, an admin app, Google or Apple sign-in, analytics vendors, multi-currency.

## Operating rules

1. Read `AGENTS.md` and any nested instructions first, and follow them where they are stricter than this file. If the repo contains engineering or UI skill files, agent profiles under `.claude/agents/`, or audit conventions, use them. If `npm run context:check` / `context:query` exist, use them before reading source.
2. Work on a new branch `hardening/<YYYY-MM-DD>`. Commit once per coherent change, with short imperative messages and no emoji. Never force-push and never rewrite existing history.
3. Keep a ledger at `docs/quality/hardening-ledger.md`: area, evidence, inspected / tested status, finding, next action. Update it after every phase. After any context compaction, re-read this file and the ledger before continuing.
4. Database changes are new forward-only migration files under `supabase/migrations/`. Never edit an applied migration. Test them against the local stack (`supabase start`, `supabase db reset`), regenerate types, and confirm a clean replay from zero.
5. Never apply migrations to a linked remote project, never run destructive SQL on production, never rotate or create keys, and never change dashboard settings. Write each such step, exactly, into `docs/hardening/FOUNDER_ACTIONS.md`.
6. Never print, log or commit a secret value. Report secret findings as file, commit and secret type only. A real exposed secret is treated as compromised: remove it from the code and add a rotation step to FOUNDER_ACTIONS.
7. Use metadata and aggregate queries for live diagnosis. Do not read real user rows. Tests use synthetic users only.
8. For a decision that is irreversible or is product policy, choose the conservative default named in this file, record it in `docs/hardening/DECISIONS.md`, and keep going. Stop only on an item that would destroy data.
9. Any UI you add or touch uses the existing design tokens and components: dark mode default, brass accent used sparingly, hairline borders instead of shadows, no gradients, sentence case, the existing heading and body fonts. Do not add or change logo usage; if a logo is unavoidable, use only the full PRIVELIER wordmark, never the circular P mark.

## Phase 0 — Baseline ✅

- Record the commit, the dirty diff, installed Expo SDK, React Native and Supabase client versions, and the package manager from the lockfile.
- Run the existing typecheck, lint and test scripts and record pre-existing failures separately from anything you introduce.
- Inventory both app entry points, routes, shared modules, Supabase migrations, functions, buckets, policies, realtime usage and app config (`app.json` / `app.config.*`, `eas.json`).
- Diff live schema against migrations if the Supabase MCP is connected (metadata only). Record any drift.

## Phase 1 — Secrets control ✅

- Scan the working tree and full git history with gitleaks or trufflehog. Build a production JS bundle for each app (`npx expo export`) and scan it as well.
- Confirm the only Supabase values in client code are the project URL and the publishable (or legacy anon) key. Any `service_role` or `sb_secret_` value in client code, `EXPO_PUBLIC_*`, `app.json` extra, or `eas.json` is a critical finding.
- Rename the client env var to `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, validate required env vars once at startup with a clear error, and keep `.env*` gitignored with a placeholder-only `.env.example`.
- Add a gitleaks pre-commit hook and CI step.
- FOUNDER_ACTIONS: create publishable and secret keys, ship a build that uses them, then disable the legacy anon and service_role keys before Supabase's late-2026 removal. Inventory every secret (database password, SMTP, EAS token, Apple and Google signing keys) with where it is stored and who can rotate it. Back up the Android upload keystore and confirm Play App Signing.

## Phase 2 — Database authorization (RLS, grants, functions, views, storage, realtime) ✅

Run catalog queries and fix every hit:

- Tables in exposed schemas without RLS, and tables with RLS enabled but no policy.
- Policies using `true`, `TO public`, or `FOR ALL`; UPDATE policies missing `WITH CHECK`; INSERT policies missing `WITH CHECK` on ownership columns (`sender_id`, `customer_id`, `barber_id`, `reviewer_id`).
- Any authorization based on `user_metadata` / `raw_user_meta_data`, including signup triggers that copy a role from metadata. Roles come from a protected table or `app_metadata`.
- Default table grants to `anon`: revoke everything the logged-out experience does not need.
- Client-writable protected columns: price, status, role, `verified` / `verification_status`, verification reviewer fields, rating aggregates, exact coordinates. Block them with column-level grants or a trigger; state transitions go through narrow RPCs.
- Views without `security_invoker = true`, and materialized views reachable by the API.
- `SECURITY DEFINER` functions: move internal ones to a non-exposed schema, revoke `EXECUTE` from `anon` and `authenticated` unless intended, set `search_path = ''`, fully qualify names, and make every one compare its inputs against `(select auth.uid())`.
- `pg_graphql`: if unused by the code, add disabling it to FOUNDER_ACTIONS.
- Storage: the verification bucket is private, owner-path policies use `auth.uid()`, only founders read, no list access for others. Every bucket has `file_size_limit` and an `allowed_mime_types` allowlist (JPEG, PNG, WebP or HEIC as used; never SVG or HTML). The portfolio bucket is publicly readable by URL but has no policy that allows listing every object. Object names are random UUIDs. Signed URLs live no longer than needed (default 60 seconds for verification documents).
- Realtime: every channel is `private: true`, with `realtime.messages` policies restricting select and insert to the two participants of that booking. Add to FOUNDER_ACTIONS: turn off "Allow public access" in Realtime settings.
- Location privacy: no table, view, RPC or realtime payload returns a barber's exact coordinates to anyone except that barber. Any distance or sort exposed to clients is computed from the public fuzzed coordinate, rounded to 0.5 km, so trilateration from several fake positions reveals nothing new.

Authorization matrix and tests:

- Actors: anon, customer A, customer B, approved barber X, pending barber Y. Founder access is through the dashboard and needs no client test.
- For every exposed object, and for select, insert, update, delete, RPC execute, object download, object list and channel join, write the expected allow or deny.
- Implement it as pgTAP tests (`supabase test db`) plus client integration tests that sign in synthetic users with the publishable key against the local stack. Every deny case has a matching allow case so an empty result cannot pass by accident. Service-role results never count as proof.
- Required scenarios: self-promotion via metadata or profile update; barber self-approval; reading another barber's exact location; joining or reading another booking's chat; sending a message as someone else; reviewing a booking that is not yours, not completed, or already reviewed; editing price, status or rating aggregates directly; downloading, listing or guessing verification documents; any write as anon.

## Phase 3 — Data integrity and performance ✅

- Overlaps: add a `tstzrange` slot to bookings (from start time and the snapshotted duration), enable `btree_gist`, and add `EXCLUDE USING gist (barber_id WITH =, slot WITH &&) WHERE (status IN ('pending','accepted'))`. Use half-open ranges `[start, end)`. First run an aggregate query for existing overlaps; if any exist, document them and add the cleanup step to FOUNDER_ACTIONS instead of failing the migration. Do not invent travel buffers; record that choice in DECISIONS. Prove it with a test that fires two concurrent overlapping inserts.
- Booking creation is one RPC in a transaction that takes `service_id` and start time, derives price and duration from the service row, rejects a client-supplied price, and accepts an idempotency key (`unique (customer_id, idempotency_key)`) so double taps cannot create two bookings.
- Check constraints for rating 1–5, message length 1–2000 after trim, positive price and duration, and the six-photo portfolio cap enforced under concurrent inserts. Money is integer minor units; times are `timestamptz`.
- Foreign keys use deliberate `ON DELETE` behavior that preserves booking, review and message history.
- Performance: wrap `auth.uid()` and similar calls as `(select auth.uid())` in policies and inside function bodies; index every column used by a policy filter and every foreign key; add `TO authenticated` to policies; remove joins from policies where a helper returning a fixed set works; select explicit columns instead of `*`; use keyset pagination with a hard page size for chat, bookings and discovery. Verify with `EXPLAIN` on representative queries and do not add an index without plan evidence.
- Realtime cost: if chat or booking status uses Postgres Changes with RLS, measure it and move to database-triggered broadcast on private channels only if the evidence supports it. Record the result.
- Regenerate TypeScript types from the database and remove hand-written duplicates.

## Phase 4 — Rate limiting and DDoS resistance ✅

There is no built-in rate limit on the Supabase Data API, so every user-reachable write path needs one of these:

- Business caps as triggers: at most 3 pending bookings per customer (DECISIONS default), at most 20 messages per minute per sender per booking, portfolio cap of 6, one verification submission in review at a time.
- Request-level limit for writes: a `db_pre_request` function that counts write requests per authenticated user and per IP in a private table with an index and periodic cleanup, rejecting with HTTP 429 above a threshold. Reads are not limitable there; protect them with the next item.
- Expensive-read protection: keep or tighten role `statement_timeout` (default anon 3 s, authenticated 8 s), enforce a maximum page size in every RPC, and ensure no endpoint returns an unbounded list.
- Edge Functions: each verifies the user JWT and applies a per-user limit backed by a private table (no new paid service without a DECISIONS entry).
- Client behavior: on 429 or a cap error, show a calm message and back off. Never retry non-idempotent writes automatically.
- Auth abuse goes to FOUNDER_ACTIONS: CAPTCHA (Turnstile or hCaptcha) on signup, sign-in and password reset in both apps and the website; email confirmation on; OTP expiry of 3600 seconds or less; tightened auth rate limits; leaked-password protection if the plan supports it; exact redirect URLs with no wildcards; MFA on every Supabase org member; spend cap or usage alerts. In code, wire the CAPTCHA token into the auth calls and make the UI response identical whether or not an email exists.
- Cost-based DDoS: compress and resize portfolio images to fixed maximum dimensions before upload to limit public egress.

## Phase 5 — Mobile app hardening ✅

- Supabase client: publishable key only; session persisted with the encrypted pattern from Supabase's Expo guide (AES key in SecureStore, ciphertext in AsyncStorage) if sessions are currently stored in plain AsyncStorage; PKCE; `detectSessionInUrl: false`; auto-refresh paused and resumed with app state.
- Sign-out and account switch clear query caches, remove every realtime channel, and cancel in-flight requests so no data from the previous account can appear.
- No `console.*` in production builds: enforce `no-console` in lint and strip it in release builds. Never log tokens, addresses, phone numbers, document URLs or message text.
- Deep links and auth redirects: validate every parameter and accept only the app's own scheme and hosts.
- Images: use the system photo picker; re-encode every upload (portfolio and verification) so EXIF and GPS metadata are removed, and add a test that inspects the output file and finds no GPS tags.
- Permissions: remove `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE` and any background location from the merged Android manifest; keep location when-in-use only, and only if used; write specific iOS purpose strings per feature.
- Over-the-air updates: if `expo-updates` is used, document code signing setup in FOUNDER_ACTIONS and keep OTA for fixes only.
- Platform: target SDK 36 through `expo-build-properties` if needed; confirm the Expo SDK and native modules support 16 KB pages; handle Android edge-to-edge and predictive back; run `npx expo-doctor` and `npx expo install --check` and fix findings deliberately.
- Do not add certificate pinning or root or jailbreak detection; record why in DECISIONS (server-side enforcement, certificate rotation risk).

## Phase 6 — Store compliance ✅

- Account deletion in both apps, reachable from Account and Studio settings: typed confirmation, then an Edge Function `delete-account` that verifies the JWT, uses the secret key from function secrets only, cancels the user's pending and future accepted bookings, deletes their storage objects and personal rows, anonymizes shared booking, review and message rows so the other party's history stays intact, deletes the auth user last, and is idempotent. Document retention in DECISIONS and a web deletion-request page in FOUNDER_ACTIONS (Google Play requires a web link).
- User-generated content: `reports` table (reporter, target type message / review / user, target id, reason, created_at; reporter inserts own, only founders read), `blocks` table (blocker, blocked). A block prevents new messages and new bookings between the pair and hides a blocked barber from that customer's discovery. Report entry points on each chat message and each review. A server-side denylist check rejects listed terms in messages and review comments. Terms acceptance with a zero-tolerance clause is stored with version and timestamp at signup. A support contact is visible in Account.
- Apple privacy manifest: declare required-reason APIs through the Expo config and confirm every native dependency ships its own manifest.
- Release docs: `docs/release/app-review-notes-customer.md` and `-barber.md` (demo account placeholders with no real passwords, how a reviewer sees barbers, what manual verification means and that the demo barber is pre-approved); `docs/release/data-inventory.md` mapping every data type collected (location, photos, ID documents, messages, contact info) to purpose, storage, retention and third parties, for App Privacy labels and the Play Data safety form.
- Remove template leftovers: default Expo screens, placeholder text, sample images, unused icons and splash assets. Confirm the two apps have distinct names, bundle IDs, icons and audiences, and that no barber screen is reachable from the Customer app or vice versa.

## Phase 7 — Clean code pass ✅

Goal: the codebase reads like the work of one careful senior engineer. Reduce code; never change behavior without a test.

- Tooling: TypeScript `strict` with no new `any`; ESLint with typescript-eslint (`no-explicit-any`, `no-floating-promises`, `no-misused-promises`, `no-console`, `no-unused-vars`, react-hooks rules) at zero warnings; Prettier; knip with no unused files, exports or dependencies; jscpd under a 3% duplication threshold; madge or dependency-cruiser with no circular imports. Add the scripts to `package.json` and CI.
- Comments: delete comments that narrate what the code does, step-by-step tutorial comments, and decorative banners. Keep short comments that explain why, non-obvious constraints, and links to external rules.
- Error handling: remove try/catch blocks that only log and rethrow, or that swallow errors and return defaults. Remove fallback chains that hide broken state. Handle errors at the boundary where the user can be told something true.
- Abstractions: inline single-use wrappers, factories with one implementation, and premature generic helpers. Three similar lines beat a speculative abstraction.
- Duplication: one implementation each for date and time formatting, price formatting, Supabase data access per entity, error mapping, and validation.
- Naming: write `docs/glossary.md` with the canonical domain terms taken from the database (customer, barber, booking, service, review, message, portfolio, verification) and rename code to match. Remove versioned or vague names (`New`, `2`, `final`, `temp`, `helper`, `data`).
- Size and structure: split screens over about 300 lines by responsibility (data hook, presentational components). One consistent data-fetching and state pattern across features.
- Remove dead code, commented-out code, TODOs (fix them or move them to the backlog), mock data in production paths, emoji in logs and copy, and magic numbers (named constants in one place, matching database limits).
- README: plain, accurate setup and scripts, no marketing language.

## Phase 8 — Verification and handoff ✅

- Run: typecheck, lint, unit and integration tests, `supabase test db`, `supabase db lint`, knip, jscpd, circular-import check, gitleaks on tree and history, `npx expo-doctor`, `npx expo install --check`, and a production export of both apps. Run Maestro flows if an emulator or device is available, otherwise mark them BLOCKED.
- Write `docs/quality/<YYYY-MM-DD>-hardening-report.md` with a gate table (secrets, authorization, integrity, rate limiting, mobile hardening, store compliance, clean code, tests), each PASS / FAIL / BLOCKED / N/A with evidence, plus the findings list (severity, evidence, root cause, fix, test).
- Finish FOUNDER_ACTIONS.md as an ordered checklist and DECISIONS.md with every default you chose.
- Do not deploy, publish, push to production or open store submissions.

## /goal command

```
/goal Execute docs/hardening/codex-goal.md end to end, phase by phase. Keep docs/quality/hardening-ledger.md current and re-read both files after any context compaction. Finish only when every Definition-of-done item is PASS or BLOCKED with evidence and a founder action.
```
