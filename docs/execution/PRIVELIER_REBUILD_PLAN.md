# Privelier rebuild execution ledger

Status: in progress
Last updated: 2026-09-08
Authority: `AGENTS.md` remains the product-backlog source of truth. This ledger is the execution and evidence record required by [the rebuild specification](./privelier-codex-master-rebuild-prompt.json).

## Operating rules

- One behavior-changing slice uses the full Plan → Design → Build → Validate → Secure → Integrate → Release pipeline. No later portfolio starts before its dependency gate passes.
- `supabase-schema-architect` exclusively owns schema, migration, RLS, storage-policy, and live-database changes. P00 has read-only Supabase access only.
- Use Sol 5.6 Ultra only for application structure, navigation/UI, accessibility presentation, visual refinement, and app polishing. Use economical specialist work for tooling, tests, backend, database, security, performance, and release operations.
- A `blocked_external` or `blocked_decision` task is recorded honestly and does not become done without the required input.

## Critical path

`P00-006` → `P00-003` → `P00-004` → `P00-005` → P00 exit review → P01 warning-free baseline → P02 database gate → P03 authentication → P04–P08 product portfolios → P09 validation → P10 release readiness → P11 audit and handoff.

The device walkthrough is parallel to P00 but remains an external prerequisite for a release-ready claim. It must not be simulated as a completed physical-device test.

## P00 — repository reconnaissance and frozen baseline

| ID | Task | Priority | Status | Dependencies | Ownership | Acceptance evidence | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P00-001 | Capture governed baseline metadata, tool availability, live read-only inventory, baseline checks, and risk decisions. | Critical | done_with_evidence | None | Release/tooling | `EVID-P00-001` through `EVID-P00-011`; decisions and risk register. | Revalidate only when its evidence becomes stale. |
| P00-002 | Walk through the dated Android reference build and capture redacted device evidence. | Critical | blocked_external | Compatible Android device, reference artifact, safe test accounts. | Mobile + test | Device/OS record, redacted flow capture, native Mapbox/keyboard/inset observations. | Attach an authorized Android device; do not enter credentials or submit an account without the required test data and confirmation. |
| P00-003 | Prove clean-checkout reproducibility in an isolated checkout. | Critical | done_with_evidence | P00-006 complete; preserve the current dirty workspace. | Tooling + test | `EVID-P00-012`: detached `b30eccf` checkout completed `npm ci`, type-check, lint, and serial Jest (48 suites / 551 tests). Expo Doctor found two failures, including seven Expo SDK patch mismatches; audit found 22 advisories. | Hand the warnings and compatibility/advisory work to P01 after P00 exits. |
| P00-004 | Complete the screen, route, control, state, deep-link, test-ID, entry/exit, and data-source inventory. | Critical | done_with_evidence | P00-003 baseline available. | Context + mobile | `EVID-P00-013` through `EVID-P00-025` and `PRIVELIER_SCREEN_AND_FLOW_INVENTORY.md` cover the root/auth/customer/barber routes, controls, states, data paths, selector patterns, and the auth-only deep-link boundary. | Hold the inventory fixed; carry RISK-024/RISK-025 and device evidence to their later atomic slices. |
| P00-005 | Reconcile remote-only `public.waitlist` migration drift. | Critical | blocked_external | Founder direction and schema-owner review. | Supabase schema architect | Forward-only committed migration or founder-approved retirement, policy decision, live verification, and updated migration ledger. | Keep the table fail-closed; no direct DB/data action. |
| P00-006 | Create and maintain the canonical ledger and crash-recovery handoff. | Critical | done_with_evidence | None | Release/tooling | `PRIVELIER_REBUILD_PLAN.md` and `PRIVELIER_REBUILD_HANDOFF.md` created on 2026-09-08; required task, status, blocker, and next-command fields verified with `git diff --check`. | Keep both current at every task boundary. |
| P00-007 | Review P00 exit conditions and open only the eligible next portfolio. | Critical | done_with_evidence | P00-002 through P00-006 terminal or explicitly blocked with evidence. | Architect + context | `EVID-P00-026`: P00-001/003/004/006 are evidenced; P00-002 and P00-005 are explicitly blocked; documentation-only diff passes. | P01 is eligible to begin its own Plan phase. Keep P00-002/P00-005 as release blockers. |

## Portfolio ledger

| Portfolio | Purpose | Status | Depends on | Primary owner | Evidence required before close | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| P00 | Repository reconnaissance and frozen baseline | blocked_external | None | Release/tooling | P00-001–P00-007 evidence | Exit review permits P01, but P00-002 device evidence and P00-005 waitlist reconciliation remain external release blockers. |
| P01 | Stabilize tests and dependency health | in_progress | P00 exit review | Test + dependency owners | `P01_BASELINE_HEALTH_PLAN.md`; repeated warning-free tests; advisory dispositions | Plan P01-D advisory work one dependency family at a time; P01-C1 native visuals remain externally blocked. |
| P02 | Database correctness and release blockers | not_started | P01 green | Schema architect | Clean DB reset, RLS/adversarial proofs, approved timezone decision | Do not start while P01 is open. |
| P03 | Authentication, identity, and provisioning | not_started | P02 database gate | Full-stack + mobile | Provider and real-device evidence; manual-verification proof | Founder provider-console actions remain external. |
| P04 | Navigation and application structure | not_started | P01 green; P02/P03 contracts respected | Sol 5.6 Ultra UI + mobile | Role-isolated navigation and route tests | Requires Sol 5.6 Ultra. |
| P05 | Design system and shared foundations | not_started | P04 architecture | Sol 5.6 Ultra UI | Token, theme, state, and accessibility tests | Requires Sol 5.6 Ultra. |
| P06 | Customer experience rebuild | not_started | P02–P05 applicable gates | Sol 5.6 Ultra UI + full-stack | Truthful flows, state matrix, accessibility evidence | Requires Sol 5.6 Ultra. |
| P07 | Barber experience rebuild | not_started | P02–P05 applicable gates | Sol 5.6 Ultra UI + full-stack | Truthful flows, state matrix, accessibility evidence | Requires Sol 5.6 Ultra. |
| P08 | Performance, reliability, and observability | not_started | Stable P04–P07 surfaces | Performance + full-stack | Release-mode budgets, offline/reconnect/error evidence | Measure before adding dependencies. |
| P09 | Automated, on-device, accessibility, and visual validation | not_started | P02–P08 applicable gates | Test + Sol 5.6 Ultra UI | Dated Maestro, device, accessibility, and visual review evidence | Requires real devices; visual work requires Sol 5.6 Ultra. |
| P10 | Build, environment, CI, and release readiness | not_started | P09 | Release + security | Clean Android/iOS release candidates and final security evidence | Founder/store/provider access may be needed. |
| P11 | Independent final audit and handoff | not_started | P10 | Independent audit | Reconciled ledger, evidence, risks, and exact external checklist | No production release without explicit founder approval. |

## Current recovery point

Current atomic task: `P01-D` advisory triage. `EVID-P01-008` records P01-D1's React Navigation `query-string` accepted constrained risk; `EVID-P01-009` records P01-D2's Expo prebuild `@xmldom/xmldom` accepted bounded build-tool risk. Neither has a compatible remediation or application/dependency change. P01-D may assess only one remaining advisory family at a time. `EVID-P01-007` records P01-C1's one-file supported splash migration and 21/21 Expo Doctor result; its code/config gates pass, while native Android/iOS release-device visuals remain `blocked_external`. P00-002 (device) and P00-005 (waitlist schema) remain external release blockers.

Known blockers: no Android device is attached; Maestro is not installed; the hosted `waitlist` table has no committed local migration and no RLS policies; the graph semantic provider is not configured locally; Jest emits known `act()` warnings; and npm audit needs a compatible-remediation review rather than an automatic fix.
