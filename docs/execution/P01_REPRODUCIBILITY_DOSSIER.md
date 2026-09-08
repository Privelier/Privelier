# P01 reproducibility dossier

Status: complete — diagnostics only
Date: 2026-09-08
Checkout: clean detached `b30eccf` at `C:\Users\original\AppData\Local\Temp\privelier-rebuild-p00-b30eccf`
Mutation: none — no source, dependency, config, schema, data, or hosted-service change.

## Jest matrix

| Command | Worker mode | Result | Evidence and interpretation |
| --- | --- | --- | --- |
| `npm test -- --runInBand` | one worker | 48 suites / 551 tests passed in 13.434 s | Reproduces persistent React testing warnings but not a failing assertion. |
| `npm test -- --maxWorkers=50%` | four workers | 48 suites / 551 tests passed in 8.076 s | The earlier Portfolio timeout did not reproduce at bounded concurrency. |
| `npm test` | Jest default; seven workers on this eight-core host | 47 suites / 550 tests passed; `VerifyScreen` had one failure in 8.817 s | Failing first test reported `render function has not been called` from `renderLoaded` while querying the global `screen`. The earlier P00 concurrent Portfolio timeout therefore remains nondeterministic evidence, not a reason to change Portfolio in this slice. |
| `npx jest src/barber/screens/__tests__/VerifyScreen.test.tsx --runInBand` | one worker | 1 suite / 5 tests passed in 2.835 s | Confirms the Verify failure is order/concurrency/lifecycle-sensitive rather than a stable production assertion failure. |

`npx jest --showConfig` reports the React Native preset environment, `jest.setup.ts` as a setup file, and `maxWorkers: 7`. The setup explicitly sets `globalThis.IS_REACT_ACT_ENVIRONMENT = true`; disabling it, suppressing console output, or globally increasing timeouts is prohibited as a remediation.

## Warning attribution

The reproducible React warnings are not a generic configuration absence. Their first mapped state transitions are in real screens, reached from tests that do not fully await their async lifecycle:

| Surface | Direct evidence | Classification | Proposed owner/slice |
| --- | --- | --- | --- |
| `VerifyScreen.test.tsx` | `renderLoaded` calls synchronous `render(<VerifyScreen />)` then immediately uses shared `screen`/`waitFor`; async effect state writes occur at VerifyScreen lines 79, 85, 90, and 91. Press-driven async permission/upload flows are also initiated outside an explicit awaited boundary. The default-worker flake occurs in this file; isolated in-band run passes with the same `act` warnings. | Proven test-lifecycle candidate; no product bug has been established. | `P01-A`: test-engineer must make one minimal test-lifecycle correction and show the relevant warning/failure disappears without changing `VerifyScreen` behavior. |
| `PortfolioScreen.test.tsx` | Its helper already awaits React Native Testing Library v14 `render`, but multiple permission/upload/delete flows still emit `act` and overlapping-act warnings at PortfolioScreen lines 147–168 and 180–185. P00’s one concurrent timeout was here, but two P01 concurrent runs passed. | Separate nondeterministic candidate; root cause not yet proven. | `P01-B` only after P01-A; preserve the failed-upload/no-row, duplicate-upload, and delete-rollback assertions. |
| Typed-error tests | Auth/customer/barber data-layer tests intentionally exercise failure mapping, which emits `__DEV__` `console.warn` logging of mocked errors. | Expected diagnostic logging, separate from React `act` warnings. | Do not suppress in P01-A; decide noise policy only through a separate explicit test/logging review if needed. |

## Expo configuration and compatibility

`npx expo-doctor` reports 19/21 checks passing:

1. `app.json` retains the obsolete top-level `expo.splash` field.
2. Seven Expo SDK 57 patch mismatches: `expo` 57.0.18 → ~57.0.20; `expo-constants` 57.0.16 → ~57.0.17; `expo-dev-client` 57.0.16 → ~57.0.18; `expo-font` 57.0.2 → ~57.0.3; `expo-image-picker` 57.0.14 → ~57.0.16; `expo-linking` 57.0.8 → ~57.0.9; and `expo-secure-store` 57.0.2 → ~57.0.3.

These are deliberately split: `P01-C2` may evaluate only Expo-supported patch alignment, while `P01-C1` is a native startup/UI configuration migration requiring Sol 5.6 Ultra review and later visual/device evidence. Neither begins in this task.

## Production audit classification

`npm audit --omit=dev --json` reports 22 findings: 20 moderate, two high, and zero critical. It is a dependency graph report, not authorization for an automatic remediation.

| Dependency path / family | Current assessment | Disposition |
| --- | --- | --- |
| `expo` → `@expo/cli` / configuration/build tooling; `@expo/fingerprint` → `minimatch` → `brace-expansion` and `@expo/xcpretty` → `js-yaml` | Both high findings are present in the Expo tooling graph. No Metro-runtime reachability claim was made from this command alone. | Reassess after P01-C2 changes the supported Expo graph; then remediate or explicitly disposition in P01-D. |
| `@react-navigation/native` → `@react-navigation/core` → `query-string` → `decode-uri-component` | Direct navigation dependency family with moderate findings, including a major-version audit suggestion. | P01-D must determine shipped runtime reachability and supported compatible parent version; no major downgrade/upgrade or audit fix in diagnostics. |
| Jest/ESLint transitive chains also surface `brace-expansion`/`js-yaml` in `npm ls` | Development/build paths coexist with the Expo graph, so this output does not justify declaring a finding development-only. | Keep in P01-D’s dependency-path ledger. |

## P01-001 exit decision

`P01-001` is complete. The next eligible atomic slice is `P01-A`, scoped only to a single evidence-backed Verify test lifecycle cause. `P01-B`, `P01-C2`, `P01-D`, and `P01-C1` remain not started. P00-002 (device) and P00-005 (waitlist reconciliation) remain independent release blockers.
