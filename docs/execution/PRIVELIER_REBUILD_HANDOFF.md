# Privelier rebuild handoff

Last updated: 2026-09-09
Current milestone: P01 — warning-free baseline and dependency health
Current atomic task: `P01-D` — triage one production dependency-advisory family at a time

## Resume safely

1. Read `AGENTS.md`, `docs/execution/PRIVELIER_REBUILD_PLAN.md`, this handoff, `PRIVELIER_REBUILD_DECISIONS.md`, and `PRIVELIER_RISK_REGISTER.md`.
2. Run `npm run context:check`. The graph semantic provider currently prevents a complete graph build; use tightly scoped reads only after recording that limitation.
3. Run `git status --short` and `git diff --check` before changing anything.
4. P01-C2 and P01-C1 automated/config gates are complete. P01-D1 accepted the React Navigation `query-string` path as constrained risk: no linking is configured, no compatible upstream fix exists, and no package change is authorized. P01-D2 accepted the audited Expo XML parser as bounded build-tool risk: its config is committed and EAS-secret-gated, and no compatible Expo 57 parent fix exists. Keep P01-C1's fresh Android/iOS release-device visual check open; select one different advisory family for the next P01-D cycle.
5. Keep P00-002 device evidence and P00-005 waitlist reconciliation visible as release blockers. Do not reset, clean, stage, commit, or overwrite the main workspace.

## Last completed atomic task

`P01-D2` Expo XML parser advisory disposition, completed 2026-09-09. `EVID-P01-009` records the high audited config/prebuild-only dependency path, the committed static-base plus EAS-secret-gated dynamic Mapbox config boundary, and the absence of a compatible Expo 57 parent remedy. It is an accepted bounded build-tool risk, not a dependency remediation; other advisory families, device evidence, and waitlist reconciliation remain open.

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
| Dependencies | `npm audit --omit=dev` reports 22 advisories (19 moderate, three high). P01-D1 disposed only the React Navigation `query-string` path: no external URI parser reachability exists while navigation linking is absent, and latest compatible React Navigation still requires it. | Triage one remaining family at a time; never run a forced audit fix. Re-review this path before adding navigation linking or when upstream provides a compatible fix. |
| Expo XML parser | Audited `@xmldom/xmldom@0.9.10` is restricted to Expo's Node-side prebuild chain. The base app config is static; its only dynamic plugin is Mapbox, conditional on a controlled EAS secret. | P01-D2 accepted bounded build-tool risk. Re-review if Expo offers a compatible parent remediation, config/native input becomes external or contributor-untrusted, native folders are committed, or runtime XML parsing is added. |
| Auth URL intake | The current callback parser accepts token fragments without first verifying the expected callback scheme/path. | `RISK-028`: run a separate auth validation pipeline with adversarial wrong-origin/path token tests; do not fold it into dependency triage. |

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

Then choose one remaining advisory family, establish its exact dependency path and production/build reachability, and obtain architecture review before any compatible remediation. Do not alter splash configuration, product code, global Jest configuration, either accepted-risk disposition, or use a forced audit fix.
