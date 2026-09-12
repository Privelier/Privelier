# Privelier whole-app security audit — 2026-09-12

## Verdict

Security gate: **FAIL**. The application has strong baseline controls in several areas, but the live Supabase project has confirmed authorization and configuration findings that must be resolved before release. No source or live data was changed during this audit.

Audit environment: repository `main` at commit `82f81f8`, remote `origin/main` aligned, live Supabase project reached through the connected MCP server, and local Windows workspace. Secrets and private payloads were not copied into this report.

## Coverage ledger

| Area | Evidence | Status | Result / next action |
|---|---|---|---|
| Auth, session, provisioning, deep links | `src/auth/**`, `lib/supabase.ts`, `lib/secureStorage.ts`, auth tests, static secret scan | Inspected | Baseline controls present: server profile role, persisted session, strict callback validation, SecureStore-backed storage. Reassess the unauthenticated recovery/deep-link paths on a native device. |
| Customer app | `src/customer/**`, `CustomerNavigator.tsx`, customer tests, anonymous REST probes | Inspected | Data-layer tests pass. Live authorization gap exists in public `services`/`availability` policies; fix policies/grants and rerun role matrix. |
| Barber app | `src/barber/**`, `BarberNavigator.tsx`, barber tests, storage policy review | Inspected | Owner-scoped writes and manual verification paths are present. Upload type/size limits are absent live; add server-side bucket limits before public operation. |
| Shared data/realtime | `src/shared/**`, booking/message/read-state tests, realtime publication query | Inspected | `bookings`, `messages`, and `chat_read_state` are in `supabase_realtime`; local tests pass. Physical two-actor realtime delivery and reconnect behavior were not run. |
| Supabase tables/RLS/grants | live `pg_class`, `pg_policies`, grants, constraints, buckets, functions, publication queries | Inspected | RLS is enabled on all 13 public tables. Confirmed permissive-policy and exposed-function findings below. Ordinary authenticated adversarial fixtures were unavailable, so privileged SQL evidence is not treated as an RLS PASS. |
| Storage | live bucket metadata and storage policies; verification/portfolio modules | Inspected | `verification-docs` is private and `portfolio` is public. Neither bucket has a live size or MIME allowlist. Verification objects have no client delete path and can accumulate as orphans. |
| Dependencies/configuration | `package.json`, lockfile, Expo config, `expo-doctor`, `expo install --check`, `npm audit` | Inspected | Expo 21/21 and dependency alignment pass. `npm audit` fails with 21 findings (19 moderate, 2 high); see dependency section. |
| Tests/build tooling | Jest, TypeScript, ESLint, Expo checks, Maestro inventory | Inspected | 48 suites / 566 tests pass; typecheck, lint, Expo Doctor, and Expo install check pass. No `.github` CI directory exists. Maestro flows are authored but not executed here. |
| Native/release gates | `.maestro/**`, README, release readiness docs | Blocked | No current native device/session evidence in this audit; native visual, permission, process-restart, and two-user realtime gates remain open. |

## Confirmed findings

### SEC-001 — Anonymous services and availability reads bypass approved-only intent (High)

Evidence:

- Live grants give `anon` SELECT on `public.services` and `public.availability`.
- Live policies include `services_select_all` and `availability_select_all`, both `TO public USING (true)`.
- The later `services_select_own_or_approved` and `availability_select_own_or_approved` policies are permissive additions, so they do not narrow the older policy.
- Anonymous REST probes returned HTTP 200 with rows from both tables.
- The live aggregate currently has one pending barber with zero service/availability rows, so the probe does not prove that pending rows are currently present; it proves the server-side restriction is not enforced.

Impact: an unauthenticated caller can enumerate service names/prices and availability for any barber that has rows, including future unapproved accounts. This conflicts with the approved-only discovery design and creates a direct API bypass.

Required owner/action: `supabase-schema-architect` should remove or replace the legacy public SELECT policies, preserve only the intended approved/owner policy semantics, verify table grants, and run anonymous plus authenticated positive/negative controls with synthetic fixtures. Do not edit an applied migration.

### SEC-002 — `barber_directory` is a SECURITY DEFINER view (High / Supabase ERROR)

The live security advisor reports `public.barber_directory` as a SECURITY DEFINER view. The view selects a hand-picked projection and filters `verification_status = 'approved'`, but it executes with creator privileges rather than the querying user's RLS context. This is a high-risk maintenance boundary: future view changes or join changes can bypass table RLS unexpectedly.

Required owner/action: schema owner should convert the view to an explicit security-invoker design if supported by the installed Postgres/Supabase version, or replace it with a narrowly controlled projection/RPC. Re-run the security advisor and an anonymous/unrelated-user cross-account probe.

### SEC-003 — Five SECURITY DEFINER functions are callable by `authenticated` (Medium, scope-dependent)

The advisor reports authenticated EXECUTE on `get_barber_busy_slots`, `get_booking_counterparts`, `get_review_authors`, `has_role`, and `is_admin`. Their `search_path` is pinned in the live metadata and their intended read projections are documented, which reduces exploitability, but exposure of SECURITY DEFINER functions must be deliberate and tested with malformed IDs, unrelated IDs, empty arrays, and role-boundary fixtures.

Required owner/action: keep only the RPCs needed by the shipped clients, revoke all others from `authenticated`, and prove that each retained function returns only its intended projection for owner, participant, unrelated user, and anonymous callers.

### SEC-004 — Three trigger functions have mutable search paths (Medium)

The advisor reports mutable search paths for `protect_barber_verification_fields`, `enforce_portfolio_max_six`, and `enforce_review_requires_completed_booking`. Live function metadata confirms `proconfig` is null for these functions. Mutable search paths are a privilege-escalation risk for SECURITY DEFINER-adjacent database code and a drift from the hardening applied to other functions.

Required owner/action: schema owner should set an explicit safe search path and qualify sensitive references, then rerun advisors and migration replay checks.

### SEC-005 — Storage buckets have no file-size or MIME allowlist (Medium)

Live `storage.buckets` metadata reports null `file_size_limit` and null `allowed_mime_types` for both `portfolio` and private `verification-docs`. Client code passes a caller-provided MIME type and uploads the entire local file bytes. Image-picker selection is not a server-side content or resource boundary.

Impact: oversized or non-image uploads can increase storage cost, processing risk, and abuse surface; verification documents are especially sensitive.

Required owner/action: add reviewed bucket limits and server-side validation compatible with the actual mobile image formats. Retest upload rejection, partial failure cleanup, and private-object access.

### SEC-006 — Leaked-password protection is disabled (Medium)

The Supabase security advisor reports Auth leaked-password protection disabled. This allows passwords found in the Have I Been Pwned corpus unless another control prevents them.

Required owner/action: enable the provider setting, then verify signup and password policy behavior using synthetic test accounts.

### SEC-007 — Dependency audit remains failing (Medium / build-risk)

`npm audit --audit-level=moderate` exits 1 with 21 findings: 19 moderate and 2 high. The reported paths include `@xmldom/xmldom`, `js-yaml`, `uuid`, and `decode-uri-component` through Expo/navigation/build or test tooling. Expo compatibility checks pass, but the audit result is not a security PASS. Existing project evidence traces several findings to build-time or constrained runtime paths; that disposition should be revalidated after dependency changes and before enabling navigation linking or externally controlled config.

Required owner/action: keep a dependency-path disposition, monitor compatible upstream fixes, and avoid `npm audit fix --force` without a tested Expo/React Native compatibility plan.

## Positive evidence

- No tracked environment/private-key files were found; `.env` is ignored. No `service_role` key material was found in tracked paths or matching historical secret-file paths. The literal `service_role` references in migrations are policy/trigger logic, not credentials.
- Client configuration uses the Supabase anon key and public Mapbox token; the Mapbox download token is read only from EAS secret environment variables in `app.config.js`.
- All 13 live public tables have RLS enabled.
- `verification-docs` is live-private. Its storage policies are owner-folder scoped; the app does not build public or signed URLs for verification documents.
- Waitlist access is admin-only SELECT with authenticated table SELECT granted; anonymous SELECT and all client writes were denied in the targeted live check.
- Booking/message/read-state realtime publication membership is present for the expected tables.
- Live constraints include booking/service relationships, nonnegative price, message length 1–2000, rating 1–5, portfolio path ownership shape, verification document presence, and unique review/verification relationships.
- `npm run typecheck`, `npm run lint`, `npm test -- --runInBand --silent`, `npx expo-doctor`, and `npx expo install --check` passed. Jest: 48 suites, 566 tests, 0 snapshots.

## Blocked or not established

- No full authenticated authorization matrix was executed with independent synthetic customer, barber, unrelated user, and admin sessions. Privileged SQL and anonymous probes cannot prove ordinary-user RLS behavior.
- No security-auditor subagent or slash-command workflow was callable in this runtime; the applicable checks were performed directly and are reported as an inline audit, not as an agent-issued PASS.
- No Android/iOS native build/device run, Maestro flow, two-device realtime test, expired-session test, interrupted upload test, or release-binary inspection was completed.
- No restore/PITR verification or isolated fresh migration replay was performed.
- No full production performance measurement was performed. Supabase performance advisors report four unindexed foreign keys, 31 auth-RLS init-plan warnings, six unused indexes, and 16 multiple-permissive-policy warnings; these are follow-up performance/integration work, not security passes.

## Gate table

| Gate | Verdict | Evidence |
|---|---|---|
| Correctness | BLOCKED | Local application checks pass, but live approved-only service/availability authorization is not correct. |
| Tests | PASS (scoped) | 48 Jest suites / 566 tests; typecheck and lint pass. Existing React `act()` console warnings remain in test output. |
| Security | FAIL | SEC-001 through SEC-007; Supabase advisor has one ERROR and multiple WARN findings. |
| Supabase integrity | BLOCKED | RLS and constraints inventoried; ordinary-role adversarial matrix and fresh replay not run. |
| Native performance | BLOCKED | No representative release build/device measurements. |
| Integration | BLOCKED | No CI directory; Maestro and two-actor realtime flows not executed. |
| Release | FAIL | Required security gate is open; native and real-user Step 18 gates remain unverified. |

## Recommended order

1. Correct SEC-001 with a forward schema migration and verify anonymous/unrelated/approved-owner matrices.
2. Harden the view/functions/search paths and rerun Supabase security advisors.
3. Add bucket size/MIME limits and define verification-object retention/orphan cleanup.
4. Enable leaked-password protection and re-test auth policy behavior.
5. Reconcile dependency advisories without force upgrades.
6. Run the native Maestro and two-actor realtime gates, then repeat the final security and release review.
