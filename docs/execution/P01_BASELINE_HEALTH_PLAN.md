# P01 baseline health plan

Status: in progress — `P01-D1/D2` advisory dispositions complete with no compatible remediation; native release-device visuals remain `blocked_external`
Last updated: 2026-09-09
Scope: test-runtime reliability, Expo SDK compatibility, and production dependency advisory disposition. This portfolio does not change product behavior, database schema/data, Supabase configuration, or the P00 external blockers.

## Approved plan and architecture boundary

`task-decomposition-expert` and `architect-review` completed the Plan/Design gates on 2026-09-08. The review conditionally approved P01 only when its work is split into the following atomic slices. A green result for one slice never validates another.

| ID | Atomic slice | Ownership boundary | Prerequisites | Acceptance gate |
| --- | --- | --- | --- | --- |
| P01-001 | Reproducibility dossier | Read-only diagnostics in an isolated clean checkout. | P00 exit review. | Exact serial/parallel Jest warning and timeout signatures, Expo Doctor result, audit dependency paths, classification, and smallest proposed next slice; no mutation. |
| P01-A | One `act()`/test-environment warning root cause | Only the test setup, helper, or test lifecycle proven responsible. | P01-001 attribution. | Affected warning disappears without disabling `IS_REACT_ACT_ENVIRONMENT`, blanket console suppression, timeout inflation, or a product-behavior change. |
| P01-B | Deterministic Portfolio test execution | Only direct Portfolio test mocks, timers, cleanup, or proven async lifecycle. | P01-001 classification and P01-A if it exposes shared leakage. | Repeated isolated and parallel runs pass while preserving failed-upload/no-row, duplicate-upload, and delete-rollback assertions. |
| P01-B2 | Portfolio rapid-double-tap `act()` warning | Only the direct input simulation for the existing double-submit guard. | P01-B evidence. | The three overlapping-`act()` warnings disappear while the two-immediate-taps/one-upload invariant and all existing assertions remain proved; no warning suppression or product change. |
| P01-C2 | Expo SDK 57 supported patch alignment | The seven Expo-family patch mismatches and their lockfile effects only. | P01-001 rebaseline; architecture review already approved separation. | Expo-supported package alignment, `expo-doctor` patch finding removed, static/tests/bundle checks pass; no forced audit fix. |
| P01-D | Advisory disposition/remediation | One reachable dependency family at a time. | P01-C2 audit rebaseline. | Each advisory has a dependency path, runtime reachability assessment, compatible fix or explicit accepted disposition; no bulk upgrade. |
| P01-C1 | Splash configuration migration | Native startup configuration and its visual behavior only. | P01-001; separate design/build pipeline. | Sol 5.6 Ultra UI review, supported configuration migration, fresh native/web build, and later device visual evidence. |
| P01-EXIT | Portfolio exit review | Evidence, integration, and security only. | Every started slice terminal. | Repeated warning-free test matrix, lint/typecheck, Expo Doctor 21/21, audit disposition, dependency/lockfile review, security PASS, and explicit service-role scan. |

## Dependency graph

`P01-001 → P01-A → P01-B → P01-B2 → P01-C2 → P01-D → P01-EXIT`
`P01-001 → P01-C1 → P01-EXIT`

`P01-A` and `P01-C1` may be planned in parallel only after diagnostics, but implementation remains one atomic slice at a time. `P01-C1` is deliberately not bundled with patch alignment: it changes native startup presentation and therefore needs the project-mandated Sol 5.6 Ultra UI review. GPT-6 Astra is not required.

## Non-negotiables

- Do not suppress React warnings by disabling `IS_REACT_ACT_ENVIRONMENT`, hiding console output, or globally increasing timeouts.
- Do not use `npm audit fix`, `--force`, a bulk dependency upgrade, or direct lockfile edits.
- Do not change screens, routing, database schema/data, RLS, Realtime, hosted configuration, or Supabase keys as part of P01.
- Preserve existing user changes and use an isolated clean checkout for diagnostics/reproducibility work.
- Keep P00-002 Android-device evidence and P00-005 waitlist reconciliation visible as external release blockers.

## Immediate execution record

`P01-001` is complete; see `P01_REPRODUCIBILITY_DOSSIER.md`. `P01-A` changed only Verify’s test helper to await RNTL v14 `render`, then passed focused, seven-worker full-suite, lint, type-check, and scoped security gates. `P01-B` changed five ordinary Portfolio async actions to await RNTL v14 `fireEvent.press`; its focused suite passed three consecutive times and two seven-worker full-suite runs passed 48/551. `P01-B2` then changed only the intentional two-immediate-taps race harness: it invokes the renderer-exposed host `onClick` twice inside one synchronous `act`, followed by `waitFor` assertions for one permission request, upload, insert, and tile. Portfolio passed focused 8/8 without `act()` warnings and three seven-worker full-suite runs passed 48/551; lint, type-check, security, and integration passed. The host callback is an intentionally isolated RNTL-v14 renderer detail; the ordinary happy path still uses awaited `fireEvent.press`. `P01-C2` is next; P01-C1/D remain not started.

`P01-C2` is complete: Expo resolved only the seven approved SDK 57 patches and lockfile changes. `expo install --check`, clean `npm ci`, lint/typecheck, serial and seven-worker Jest (48/551), and web export pass; Expo Doctor is 20/21 solely for the separate unsupported splash field. Security PASS found no key, backend, configuration, or direct non-Expo dependency scope change. `P01-C1` is next and requires Sol 5.6 Ultra UI review.

`P01-C1` migrated only `app.json` from legacy `expo.splash` to one configured `expo-splash-screen` tuple using the existing seal, `#121214`, `contain`, and `imageWidth: 200`. Resolved config—with and without the conditional Mapbox plugin—preserves exactly one splash plugin. Expo Doctor is 21/21; dependency check, lint/typecheck, serial and seven-worker Jest (48/551), web export, independent test/security/integration gates pass. UI review is a conditional PASS: no further speculative change is warranted, but fresh Android/iOS release builds must still prove centering, sharpness, first-frame color, no white flash/scale pop, restoration hold, and successful dismissal. That visual gate is `blocked_external`.

`P01-D1` traced the runtime React Navigation chain: `@react-navigation/native@7.3.8 → @react-navigation/core@7.21.5 → query-string@7.1.3 → decode-uri-component@0.2.2`. The current latest compatible React Navigation 7 chain still declares `query-string: ^7.1.3`, so it cannot remove the advisory. `NavigationContainer` has no `linking` configuration; the sole handled external URI, `privelier://auth-callback`, is parsed through `expo-linking` and `URLSearchParams`, not React Navigation. Architecture conditionally approved an analysis-only accepted constrained-risk disposition: no package, lockfile, routing, source, schema, or UI change. Security and test/integration review pass this disposition. Reassess before enabling NavigationContainer linking, or when a compatible upstream chain eliminates `query-string`/`decode-uri-component`; any future remediation must re-prove the dependency graph, auth-callback behavior, tests, secret scan, and device malformed-URI handling. Security review also surfaced an independent existing auth-callback origin/path-validation concern, tracked as `RISK-028` for its own feature pipeline. Continue P01-D only with a different single advisory family.

`P01-D2` traced the high `@xmldom/xmldom@0.9.10` advisory only through Expo's Node-side prebuild chain: `expo-splash-screen@57.0.8 → @expo/config-plugins@57.0.9 → xcode@3.0.1 → simple-plist@1.3.1 → plist@3.1.1 → @xmldom/xmldom@0.9.10`. The separate `@expo/plist` copy at `0.8.15` is not the audited node. Expo 57 pins config plugins to `~57.0.9`; no newer compatible parent fixes the chain, although a theoretically compatible transitive patch exists. Direct transitive manipulation is out of scope. The committed base `app.json` is static; committed `app.config.js` conditionally adds the Mapbox plugin only when its EAS build-secret environment variable is present. Neither path accepts customer/barber network input or ships the XML parser in the app runtime. Architecture and security approved accepted bounded build-tool risk; integration passed after correcting the dynamic-config premise and confirming Expo Doctor 21/21. Reassess if Expo publishes an SDK-57-compatible remediation, config/native project input becomes external or contributor-untrusted, native folders are committed, or runtime XML/config parsing is introduced. Continue P01-D only with a different single advisory family.
