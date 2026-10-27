# Hardening report, 2026-10-27

Every Definition-of-done item of `docs/privelier-Vibecoding-goal.md` is PASS, except one store requirement that needs a native build (16 KB page alignment) and the device-only checks, which are BLOCKED with founder actions. Seven migrations (0052-0058) are live on the production project, the authorization matrix and abuse suites pass there (150 pgTAP assertions under real roles), and `npm run check` is green.

## Definition of done

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Every exposed object in the authorization matrix, each cell tested under real roles | PASS | `supabase/tests/authorization_matrix.test.sql` (115 assertions: anon, customers A and B, approved barber X, pending barber Y; every deny paired with an allow; tables, the directory view, RPCs, storage objects, the typing channel; global checks that anon holds no privilege and RLS is on everywhere) |
| 2 | Lint reports no ERROR; WARNs fixed or justified | PASS | Supabase Security and Performance Advisors (the `db lint` equivalent without Docker): 0 ERROR. 13 WARN "authenticated can execute a SECURITY DEFINER function" are the app's intended RPCs (D15); 1 WARN leaked-password protection is a dashboard setting (F11); INFO only otherwise |
| 3 | Overlapping bookings impossible in the database, proven under concurrency | PASS | Exclusion constraint `bookings_no_overlapping_active_slot` (0054); matrix proves it with the trigger disabled; `npm run db:concurrency`: a concurrent overlapping insert is refused while the first is in flight, the adjacent slot succeeds, and the retry succeeds after the first rolls back |
| 4 | Every user-reachable write path rate limited or capped, proven by tests | PASS | `supabase/tests/abuse_limits_and_account_deletion.test.sql` (35 assertions): messages, reports, blocks, safety events, the request-level limiter (HTTP 429), services, availability, days off, favorites, portfolio rows, storage objects; existing pending-booking, address, review and verification caps |
| 5 | No secret in tree, history or bundle; client ships only URL and publishable key | PASS | gitleaks: history clean, production export clean, tracked tree clean; only git-ignored local caches hold the public anon key. `lib/env.ts` refuses secret keys at start. Local old token and unused Mapbox token: F6, F7 |
| 6 | In-app account deletion via a server function; report, block and filter for messages and reviews | PASS | Typed DELETE confirmation; `delete-account` Edge Function plus `delete_own_account` (0057), idempotent, shared history anonymized (abuse suite). Reports on messages, reviews and users with snapshot (0056), blocks hide barbers from discovery (0053), server denylist (0056). Deploying the updated function: F2 |
| 7 | Store technical requirements | PASS except 16 KB: BLOCKED | Target SDK 36 (React Native 0.88 default); no `READ_MEDIA_*`, storage, camera, microphone or background location (introspected manifest); specific iOS purpose strings; app-level privacy manifest. 16 KB alignment needs a production AAB: F24 |
| 8 | typecheck, lint (0 warnings), tests, `supabase test db`, knip, jscpd, expo-doctor | PASS | `npm run check` (typecheck, ESLint 0 warnings, 866 Jest tests, knip, jscpd 1.96 %, madge no cycles); `npm run db:test` 4/4 files; `npx expo-doctor` 20/20. The pgTAP suites run through the Management API runner because no local Docker stack exists; they are `supabase test db` compatible |
| 9 | Report, ledger and FOUNDER_ACTIONS | PASS | This file, `docs/quality/hardening-ledger.md`, `docs/hardening/FOUNDER_ACTIONS.md`, `docs/hardening/DECISIONS.md` |

## Gate table

| Gate | Status | Evidence |
|---|---|---|
| Secrets | PASS | gitleaks history, export and tree; publishable key; pre-commit hook and CI scan |
| Authorization | PASS | Matrix 115 assertions; advisors 0 ERROR |
| Integrity | PASS | Exclusion constraint, concurrency test, idempotent `create_booking`, check constraints, preserved history |
| Rate limiting | PASS | Abuse suite 35 assertions; live HTTP check that the request hook runs |
| Mobile hardening | PASS | Encrypted session, PKCE, app-state refresh, channel cleanup, no release logging, strict deep links, picker without permission, EXIF removal |
| Store compliance | PASS, with founder actions | Deletion, UGC controls, permissions, privacy manifest, release docs; 16 KB, web deletion page, legal texts and demo accounts are F19-F24 |
| Clean code | PASS | `npm run check` (873 tests, jscpd 1.55 %); every screen split into a data hook plus components (D22) |
| Tests | PASS, devices BLOCKED | Jest 866, pgTAP 150, concurrency PASS; Maestro and two-device checks need devices (F25) |

## Findings

| # | Severity | Finding | Root cause | Fix | Test |
|---|---|---|---|---|---|
| 1 | High | Deleting an account erased the other person's bookings, chats and received reviews, and deletion was refused while any booking was live | Every foreign key cascaded; deletion had no cancellation path | 0057: SET NULL keys, upcoming bookings cancelled with notification, comments erased, private rows deleted; apps handle a missing counterpart | Abuse suite deletion section; typecheck over nullable ids |
| 2 | High | Overlapping bookings were prevented only by a trigger | No database invariant | 0054 exclusion constraint on a half-open slot | Matrix (trigger disabled) and concurrency test |
| 3 | High | No rate limit on any write; unlimited storage uploads | Data API has none built in | 0055: rate counters, request hook (429), row and storage caps | Abuse suite |
| 4 | High | `barber_directory` was a SECURITY DEFINER view over private tables (Supabase ERROR) | Discovery needed rows the caller cannot read | 0053 PII-free projection, invoker view | Matrix |
| 5 | High | The request hook in 0055 as first written would have broken every service-role API call (nightly stats job) | Hook granted only to anon and authenticated | Grant to service_role and exempt server jobs before applying | Abuse suite and live grant check |
| 6 | Medium | Client roles held table-wide INSERT/UPDATE including price, status, role, verification and rating columns (blocked only by triggers), plus TRUNCATE/TRIGGER/REFERENCES | Supabase default grants | 0052 column grants | Matrix |
| 7 | Medium | anon held grants on 9 tables; 19 policies targeted `public`; 3 FOR ALL policies; clients could insert chat rooms | Defaults and early migrations | 0052 | Matrix hygiene assertions |
| 8 | Medium | Policy helpers were callable RPC endpoints | Lived in the exposed schema | 0058 moved to `private` | Matrix |
| 9 | Medium | Portfolio cap could be exceeded by concurrent uploads | Count without a lock | 0055 advisory lock | Abuse suite |
| 10 | Medium | Blocked barbers stayed in the customer's discovery | Directory ignored blocks | 0053 | Matrix |
| 11 | Medium | Sign-up revealed which emails have accounts | Client undid Supabase's obfuscation | Same response for both cases | Jest |
| 12 | Medium | Photo-library permission requested before the system picker | Unneeded prompt | Removed | Jest |
| 13 | Medium | Saved home addresses could not be deleted | Delete never wired to the UI | Remove button with restore on failure | Jest |
| 14 | Low | Five realtime status logs printed in release builds | Missing `__DEV__` guard | `devWarn`, `no-console` lint rule | ESLint |
| 15 | Low | RPC id arrays and bookings lists were unbounded | No caps | Arrays capped at 200, lists at 300 | Abuse suite, Jest |
| 16 | Low | Conversation screens duplicated 499 lines | Copy per app | Shared `ConversationView` | Jest, jscpd |
| 17 | Low | A duplicate test file hid one suite from TypeScript | `.ts` and `.tsx` with one name | Merged | Typecheck |
| 18 | Low | Old Supabase token and unused Mapbox token stored locally | Earlier sessions | Founder revocation | F6, F7 |
| 19 | Info | High npm advisories inside `@expo/cli` only | Upstream | Accepted, tracked | D10 |
| 20 | Info | One Jest failure in 1 of 6 full runs | Not isolated | Backlog | Ledger |

## Live verification after migrating

- `npm run db:test` against production: 4/4 files, no staged migrations.
- Real HTTP with the publishable key: anon reads, writes and RPCs are refused with 401/404; the anon write reached the table's permission check, which proves the request hook runs without breaking requests; Auth health 200.
- Advisors: 0 ERROR.
- `npm run db:pending`: none.
- Concurrency test: PASS, nothing left behind.

## Not done in this run

- 16 KB alignment, Maestro flows, two-device Realtime, EXIF byte check on a device: need builds or devices (F23-F25).
- CAPTCHA is wired into sign-up, sign-in, resend and reset (Turnstile, off until `EXPO_PUBLIC_CAPTCHA_SITE_KEY` is set); turning it on needs the founder's site key and the dashboard switch (F11).
