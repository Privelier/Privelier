# Hardening ledger

Running record for `docs/privelier-Vibecoding-goal.md`. Evidence is live (production project, metadata and synthetic users only) unless marked otherwise. Final results and the findings list: `docs/quality/2026-10-27-hardening-report.md`.

| Area | Evidence | Inspected | Tested | Finding / next action |
|---|---|---|---|---|
| Baseline | Commit `f5b484d`, clean tree; Expo SDK 58.0.19, React Native 0.88.0, React 19.3, supabase-js 2.110, npm lockfile; Postgres 17.6 | Yes | typecheck, lint, 864 tests green at start | No pre-existing failures |
| Secrets: tree, history, bundle | gitleaks 8.30.1 (redacted): history clean, production export clean; working-tree hits only in git-ignored caches (public anon JWT, Mapbox public token) and one local permission rule | Yes | Yes | Old personal access token in `.claude/settings.local.json` (F6); unused Mapbox token (F7) |
| Client keys and env | `lib/env.ts` validates URL and publishable key, refuses secret or service_role keys; `.env` uses `sb_publishable_` | Yes | `lib/__tests__/env.test.ts` | Rename in EAS and other machines (F1) |
| Pre-commit and CI secret scanning | `tools/hooks/install-gitleaks-hook.sh`, `.github/workflows/quality.yml` | Yes | Hook ran on a real commit | Install gitleaks on other machines (F26) |
| Grants and policies | 0052: anon has no privilege anywhere; column-level writes; all policies `TO authenticated`; no FOR ALL | Yes | Matrix: hygiene assertions | Done |
| Directory view | 0053: PII-free `barber_public_profile`, view is `security_invoker`, hides blocked barbers | Yes | Matrix | Supabase ERROR 0010 cleared |
| Authorization matrix | `supabase/tests/authorization_matrix.test.sql`, 115 assertions, 5 actors, paired allow/deny, real roles | Yes | Pass | Done |
| Storage | Buckets private/public as intended, 10 MB, image MIME allowlist, no listing, owner folders, object caps | Yes | Matrix and abuse suite | Signed URLs: none created by the client (founders use the dashboard) |
| Realtime | Only Broadcast channel (typing) is private with participant policies; Postgres Changes filtered by RLS | Yes | Matrix (typing channel) | Turn off public access, then device check (F10) |
| Location privacy | Exact point only in `barber_location` (owner-only); directory carries the offset point; no client distance from exact coordinates | Yes | Matrix | Live trip exception by founder decision (D9) |
| Overlap integrity | 0054 exclusion constraint on `tsrange` slot; zero existing overlaps before migrating | Yes | Matrix (trigger bypassed) and `npm run db:concurrency` PASS | Travel buffer decision (F15) |
| Idempotent booking | `create_booking` RPC with per-customer key; price and duration stamped server-side | Yes | Matrix, Jest | Done |
| Integrity checks | rating 1-5, message 1-2000, price > 0, duration > 0, portfolio cap under concurrency | Yes | Matrix and abuse suite | Done |
| Delete behaviour | 0057: shared history kept and anonymized | Yes | Abuse suite (deletion section) | Done |
| Performance | `auth.uid()` hoisted to InitPlan in all policies; FK indexes present; EXPLAIN on chat, bookings, directory | Yes | EXPLAIN only | No index change justified at current size |
| Generated types | `src/database.types.ts`, typed client | Yes | typecheck | Row types alias generated tables |
| Rate limits and caps | Messages 20/min, reports 10/h, blocks 30/h, safety 30/h, deletion 5/h, request writes 120/min per user and 600/min per IP, row caps, storage object caps | Yes | Abuse suite, 35 assertions | Done |
| Timeouts and page sizes | anon 3 s, authenticated 8 s; RPC arrays capped at 200; bookings views 300 rows; discovery capped | Yes | Abuse suite, Jest | Max rows setting (F13) |
| Auth abuse | Sign-up no longer reveals registered emails | Yes | Jest | CAPTCHA, confirmation, OTP, leaked passwords, redirects (F11) |
| Mobile hardening | Encrypted session storage, PKCE, refresh tied to app state, channels removed on sign-out, devWarn only, strict deep links | Yes | Jest | Done |
| Uploads | System picker without library permission; re-encode strips EXIF/GPS; 2048 px cap | Yes | Jest (contract) | Byte check on a device (F23) |
| Permissions and platform | Merged Android permissions: location, foreground-service location, notifications, internet; target SDK 36; iOS privacy manifest; expo-doctor 20/20 | Yes | `expo config --type introspect` | 16 KB alignment check on a build (F24) |
| Account deletion | Typed confirmation, Edge Function plus `delete_own_account`, idempotent | Yes | Abuse suite, Jest | Deploy updated function (F2); web deletion page (F19) |
| Reports, blocks, filter | Message and review reports with snapshot, blocks hide barbers, server denylist, zero-tolerance consent copy | Yes | Matrix, abuse suite, Jest | Moderation process (F18) |
| Release docs | `docs/release/*` | Yes | N/A | Demo accounts (F21) |
| Clean code | ESLint zero warnings with no-console, no-explicit-any, promise rules; knip clean; jscpd 1.96 %; no circular imports; conversation screens share one view | Yes | `npm run check` | 15 oversized screens remain (backlog, D22) |
| Dependencies | `npm audit --omit=dev`: 5 high, all inside `@expo/cli` | Yes | CI gate at critical | Watch Expo updates (D10) |
| Flaky test | One Jest failure in 1 of 6 full runs, not reproducible in 5 reruns | Partly | Not isolated | Backlog: run Jest with `--runInBand --detectOpenHandles` repeatedly to isolate |
| Maestro and devices | Flows exist in `.maestro/` | No | Blocked: no emulator or device session | F25 |
