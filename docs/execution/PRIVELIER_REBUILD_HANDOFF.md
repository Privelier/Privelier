# Privelier rebuild handoff

Last updated: 2026-09-08
Current milestone: P01 — warning-free baseline and dependency health
Current atomic task: `P01-D` — triage one production dependency-advisory family at a time

## Resume safely

1. Read `AGENTS.md`, `docs/execution/PRIVELIER_REBUILD_PLAN.md`, this handoff, `PRIVELIER_REBUILD_DECISIONS.md`, and `PRIVELIER_RISK_REGISTER.md`.
2. Run `npm run context:check`. The graph semantic provider currently prevents a complete graph build; use tightly scoped reads only after recording that limitation.
3. Run `git status --short` and `git diff --check` before changing anything.
4. P01-C2 and P01-C1 automated/config gates are complete. Keep P01-C1's fresh Android/iOS release-device visual check open, and start P01-D with read-only dependency-path/reachability evidence before any remediation.
5. Keep P00-002 device evidence and P00-005 waitlist reconciliation visible as release blockers. Do not reset, clean, stage, commit, or overwrite the main workspace.

## Last completed atomic task

`P01-B2` Portfolio rapid-double-tap lifecycle correction, completed 2026-09-08. `EVID-P01-005` records the same-turn two-host-callback/one-upload invariant, warning-free focused 8/8, three 48/551 seven-worker runs, lint/typecheck, test validation, security PASS, and integration PASS. It does not close Expo, advisory, device, or waitlist work.

## Current workspace state

- P00 is `blocked_external`: P00-002 still requires an authorized Android device/test data, and P00-005 requires founder plus schema-owner direction. P01-A changed only `src/barber/screens/__tests__/VerifyScreen.test.tsx`; P01-B/B2 changed only the Portfolio test lifecycle. Its rapid-double-tap assertion uses a documented renderer-host callback solely for same-turn race coverage; no product path changed.
- An earlier release-validation update is present in `docs/project/ACTIVE_BACKLOG.md`; preserve it as user-visible project history.
- The Expo web server may be running from `npm run web -- --port 8081` for local UI smoke inspection. It is not release/device evidence.
- No application code, package manifest, migration, Supabase data, or hosted configuration was changed during P00-006.

## Known failing checks and blockers

| Category | Current fact | Required recovery |
| --- | --- | --- |
| Device validation | No Android device is attached. | Attach an authorized device before P00-002/P09 physical-flow work. |
| Maestro | CLI is not installed. | Install and verify it only when the device test environment is ready. |
| Live schema drift | Hosted `public.waitlist` has no matching committed local migration. It stores contact details, has RLS enabled, and has zero policies (fail-closed). | Founder direction plus `supabase-schema-architect`; no direct live changes. |
| Graph context | AST extraction works but the configured semantic backend lacks its SDK/configuration. | Fix the local Graphify provider or document the fallback; do not claim a complete graph query. |
| Test reliability | Portfolio is repeatably deterministic and its focused suite is now free of the prior harness `act()` warnings. Other test warning signatures remain separately visible in the full suite. | Continue evidence-driven P01 test-warning slices; do not suppress warnings. |
| Expo compatibility | Expo dependencies and supported splash config now pass Doctor 21/21; fresh native release-device splash appearance is unverified. | Keep the visual gate `blocked_external`; do not substitute Expo Go/web evidence. |
| Dependencies | `npm audit --omit=dev` reports 22 transitive advisories, including two high build-tool-chain findings and a moderate React Navigation query-string path. | P01 dependency-triage pipeline; never run a forced audit fix. |

## Last known-good verification

- Isolated `npm ci`: passed at detached `b30eccf`.
- `npm run lint` and `npm run typecheck`: passed in the isolated checkout.
- Serial `npm test -- --runInBand`: 48 suites and 551 tests passed; expected warning cleanup remains P01 work.
- `npx expo-doctor`: 19/21 checks passed; app-config and Expo package patch drift remain P01 work.
- Live read-only database check: expected core tables have RLS; only `bookings` and `messages` are Realtime-published.
- Fresh Supabase advisor check found the known callable `SECURITY DEFINER` warnings and the new `waitlist` RLS-without-policy ERROR; final security PASS is therefore not available.

## Exact next command

```powershell
git diff --check; git status --short
```

Then rebaseline Expo Doctor and run Expo's supported package check. Change only the seven SDK 57 patch targets and lockfile; do not alter splash configuration, product code, global Jest configuration, or audit advisories.
