# Privelier rebuild execution ledger

Last updated: 2026-09-01

This is the canonical execution and evidence ledger for the Privelier Legendary Product Rebuild and Release Program. It does not replace product truth in `AGENTS.md`.

## Current program checkpoint

| Field | Value |
|---|---|
| Program status | `in_progress` |
| Active portfolio | `P00` - frozen baseline and execution bootstrap |
| Active writing task | `P00-013` - reconcile repository and live/local inventories |
| Baseline checkpoint | Historical P00 evidence was collected at `4353237`; it remains provenance only |
| Current checkpoint | `main` at `6f5654e` after a fast-forward-only pull on 2026-09-01 |
| Current working tree | `docs/execution/PRIVELIER_EVIDENCE_INDEX.md` modified and `docs/execution/PRIVELIER_REBUILD_PLAN.md` untracked for P00-009; unrelated untracked `.claude/settings.local.json` and `.tmp-pharmacy-schedules/` are protected and out of scope |
| Intended files for active task | Execution docs only; repository and hosted Supabase access remain read-only |
| Live impact | None; P00 hosted Supabase, provider, EAS, store, and production access is read-only |
| Last known-good checkpoint | P00-012 exact-HEAD reconstruction PASS; ignored snapshot removed after verified cleanup |
| Safe recovery | Inventory work is read-only; revert only incomplete execution-doc findings and never mutate hosted state |
| Resume point | Give every repository/live drift and control inventory item an evidence-linked disposition, then start P00-014 |
| Exact next task/command | Run read-only repository/control/config/dependency inventory and schema-architect live/local drift reconciliation |

## Scoped authority model

- `AGENTS.md` owns authoritative product truth, founder decisions, scope, schema constraints, build order, and the living open backlog.
- This ledger owns rebuild execution status, atomic-task sequencing, validation, evidence, recovery, and resumable handoff state.
- `PRIVELIER_REBUILD_DECISIONS.md` records durable program decisions and approval boundaries.
- `PRIVELIER_RISK_REGISTER.md` owns current risk classification and mitigation links.
- `PRIVELIER_EVIDENCE_INDEX.md` owns redacted evidence summaries. Bulky or sensitive artifacts never belong in this ledger.
- `docs/plans/2026-09-01-privelier-rebuild-program-design.md` owns the accepted operating model.
- A conflict between product truth and execution state stops work for a founder decision. It is never silently resolved in favor of either file.
- New product work is dual-written into `AGENTS.md` and this ledger. An `AGENTS.md` item is deleted only after every mapped child task passes. Its source ID and evidence remain here permanently.

## Status and transition rules

Allowed task statuses are `not_started`, `ready`, `in_progress`, `blocked_decision`, `blocked_external`, `failed`, `passed`, `deferred_out_of_scope`, and `superseded`.

- Exactly one writing task may be `in_progress` across this ledger.
- `passed` requires measurable acceptance criteria and an evidence ID.
- `blocked_decision` and `blocked_external` require an owner and an exact unblock action.
- `failed` requires failure evidence, a last-known-good checkpoint, a safe recovery action, and a resume point.
- `superseded` requires a replacement task ID and preserves its prior evidence.
- `deferred_out_of_scope` remains visible and can reopen only after an explicit founder decision.
- A task becomes `ready` only when every dependency has passed and every required approval is recorded.
- A release stage cannot pass before Plan, Design, Build, Validate, Secure, and Integrate have passed for the same feature run.

## Feature delivery contract

P00-P11 are portfolios, not giant feature runs. Every behavior-changing concern receives its own Run ID and the seven ordered stages below.

| Stage ID suffix | Stage | Required result |
|---|---|---|
| `S01` | Plan | Task decomposition, scope, non-goals, acceptance criteria, risks, and owners |
| `S02` | Design | Architect approval against schema, state machine, role boundaries, and approved decisions |
| `S03` | Build | Narrow implementation; schema work only by `supabase-schema-architect` |
| `S04` | Validate | Unit/integration/database tests and Maestro flow where applicable |
| `S05` | Secure | Explicit security PASS, including no client or history `service_role` leak |
| `S06` | Integrate | Query-performance and cross-feature integration checks |
| `S07` | Release | Evidence-linked closure or an honest external/decision blocker |

Run IDs use `RUN-Pxx-NNN`; stage records use `RUN-Pxx-NNN-S01` through `S07`. Several backlog sources may feed one run only when they describe the same behavior-changing concern. P09 and P11 prove the integrated system; they never substitute for a missing feature-stage gate.

## Feature-run register

No behavior-changing run is active during P00. The following known candidate runs reserve stable IDs and single-concern boundaries. P00-013 may add more runs after inventory reconciliation; it may not merge these concerns merely to reduce ceremony.

| Run ID | Single behavior-changing concern | Sources | Status | Entry condition |
|---|---|---|---|---|
| RUN-P02-001 | Make booking creation server-authoritative for future time, active availability, service duration, and interval overlap | SRC-AG-0025, SRC-AG-0026; RISK-001 | `not_started` | P01 passed; schema-architect decomposition; ODEC-001 isolated rather than guessed |
| RUN-P02-002 | Add an explicit closed/blackout availability representation | SRC-AG-0027 | `not_started` | RUN-P02-001 boundaries known; separate design approval |
| RUN-P03-001 | Add Google and Apple sign-in to the provider-agnostic provisioning path | SRC-AG-0004; DEC-0008 | `not_started` | Applicable P02 findings closed; current primary docs reconciled; founder provider prerequisites available |
| RUN-P04-001 | Separate Customer and Barber application roots without changing production identity | DEC-0010 | `not_started` | P03 route contract approved; ODEC-002 remains isolated to production rollout |
| RUN-P05-001 | Add the remaining approved Signet placements and native icon/splash assets | SRC-AG-0008 | `not_started` | Split repository-native UI placement from production identity mutation; founder asset review |
| RUN-P08-001 | Make read-receipt timestamp merging and hook teardown/outage behavior deterministic | SRC-AG-0047, SRC-AG-0048; RISK-017 | `not_started` | P01 deterministic test baseline passed |

### Reserved stage records

Each row below is a distinct gate record. A later status change requires its own acceptance evidence.

| Stage record | Run | Stage | Status |
|---|---|---|---|
| RUN-P02-001-S01 | RUN-P02-001 | Plan | `not_started` |
| RUN-P02-001-S02 | RUN-P02-001 | Design | `not_started` |
| RUN-P02-001-S03 | RUN-P02-001 | Build | `not_started` |
| RUN-P02-001-S04 | RUN-P02-001 | Validate | `not_started` |
| RUN-P02-001-S05 | RUN-P02-001 | Secure | `not_started` |
| RUN-P02-001-S06 | RUN-P02-001 | Integrate | `not_started` |
| RUN-P02-001-S07 | RUN-P02-001 | Release | `not_started` |
| RUN-P02-002-S01 | RUN-P02-002 | Plan | `not_started` |
| RUN-P02-002-S02 | RUN-P02-002 | Design | `not_started` |
| RUN-P02-002-S03 | RUN-P02-002 | Build | `not_started` |
| RUN-P02-002-S04 | RUN-P02-002 | Validate | `not_started` |
| RUN-P02-002-S05 | RUN-P02-002 | Secure | `not_started` |
| RUN-P02-002-S06 | RUN-P02-002 | Integrate | `not_started` |
| RUN-P02-002-S07 | RUN-P02-002 | Release | `not_started` |
| RUN-P03-001-S01 | RUN-P03-001 | Plan | `not_started` |
| RUN-P03-001-S02 | RUN-P03-001 | Design | `not_started` |
| RUN-P03-001-S03 | RUN-P03-001 | Build | `not_started` |
| RUN-P03-001-S04 | RUN-P03-001 | Validate | `not_started` |
| RUN-P03-001-S05 | RUN-P03-001 | Secure | `not_started` |
| RUN-P03-001-S06 | RUN-P03-001 | Integrate | `not_started` |
| RUN-P03-001-S07 | RUN-P03-001 | Release | `not_started` |
| RUN-P04-001-S01 | RUN-P04-001 | Plan | `not_started` |
| RUN-P04-001-S02 | RUN-P04-001 | Design | `not_started` |
| RUN-P04-001-S03 | RUN-P04-001 | Build | `not_started` |
| RUN-P04-001-S04 | RUN-P04-001 | Validate | `not_started` |
| RUN-P04-001-S05 | RUN-P04-001 | Secure | `not_started` |
| RUN-P04-001-S06 | RUN-P04-001 | Integrate | `not_started` |
| RUN-P04-001-S07 | RUN-P04-001 | Release | `not_started` |
| RUN-P05-001-S01 | RUN-P05-001 | Plan | `not_started` |
| RUN-P05-001-S02 | RUN-P05-001 | Design | `not_started` |
| RUN-P05-001-S03 | RUN-P05-001 | Build | `not_started` |
| RUN-P05-001-S04 | RUN-P05-001 | Validate | `not_started` |
| RUN-P05-001-S05 | RUN-P05-001 | Secure | `not_started` |
| RUN-P05-001-S06 | RUN-P05-001 | Integrate | `not_started` |
| RUN-P05-001-S07 | RUN-P05-001 | Release | `not_started` |
| RUN-P08-001-S01 | RUN-P08-001 | Plan | `not_started` |
| RUN-P08-001-S02 | RUN-P08-001 | Design | `not_started` |
| RUN-P08-001-S03 | RUN-P08-001 | Build | `not_started` |
| RUN-P08-001-S04 | RUN-P08-001 | Validate | `not_started` |
| RUN-P08-001-S05 | RUN-P08-001 | Secure | `not_started` |
| RUN-P08-001-S06 | RUN-P08-001 | Integrate | `not_started` |
| RUN-P08-001-S07 | RUN-P08-001 | Release | `not_started` |

## Approval and mutation boundaries

| Scope | Owner | Approver | Evidence required before mutation | P00 posture |
|---|---|---|---|---|
| `supabase/migrations/**`, schema, RLS, grants, triggers, storage policy | `supabase-schema-architect` | Founder for hosted application | Exact target, tested forward migration, adversarial checks, recovery posture, approval evidence ID | Read-only inventory only |
| Hosted Supabase data/config/provider/function changes | Assigned specialist | Founder | Exact project/rows/config, test evidence, recovery posture, approval evidence ID | Prohibited |
| EAS ownership, project IDs, bundle/package IDs, signing, credentials, store identity | Release owner | Founder | Approved identifier matrix and migration/recovery plan | Read-only metadata only |
| Google/Apple provider consoles and secrets | Auth owner | Founder | Current primary-doc design, redacted provider matrix, no secret in client/git/evidence | Prohibited |
| Paid services or production deployment | Program owner | Founder | Cost/scope approval and release evidence | Prohibited |
| App code and repository documentation | Owning feature role | Pipeline gates | Narrow tests and evidence appropriate to risk | Allowed only for the active atomic task |

## Portfolio register

| Portfolio | Name | Depends on | Status | Exit gate |
|---|---|---|---|---|
| P00 | Frozen baseline and execution bootstrap | None | `in_progress` | Reproducible baseline, canonical ledger, clean-snapshot feasibility, reconciled inventories, redacted evidence, and P00 final gate |
| P01 | Deterministic tests and dependency health | P00 | `not_started` | Clean install; repeated warning-free suite; advisory reachability classified |
| P02 | Database authority, schema drift, RLS and storage | P01 | `not_started` | Clean local reset, pgTAP/adversarial probes, booking integrity, and approval-gated hosted plan |
| P03 | Authentication and account lifecycle | P01, relevant P02 findings | `not_started` | Email/Google/Apple converge on one provisioning path; manual verification cannot be bypassed; deletion policy blocker explicit |
| P04 | Separate app roots, navigation and build variants | P01, P03 route contract | `not_started` | Independently testable Customer and Barber roots; no shared UI/navigation; production identities unchanged without approval |
| P05 | Design foundations, brand and accessibility | P01, P04 boundaries | `not_started` | Approved primitives/tokens/assets plus representative light/dark, large-text, and accessibility validation |
| P06 | Customer experience | P02-P05 applicable gates | `not_started` | Honest discovery, booking, inbox, account, and review flows with no fake controls |
| P07 | Barber experience | P02-P05 applicable gates | `not_started` | Honest studio, services, availability, location, portfolio, verification, and request flows |
| P08 | Realtime, resilience and performance | P06, P07 | `not_started` | Reconnect, duplicate, teardown, and rollback tests plus approved release-mode performance budgets |
| P09 | Cross-app device and end-to-end proof | P02-P08 | `not_started` | Maestro, two-user/two-device Realtime, full Step 18 flow, VoiceOver/TalkBack, and founder visual-review evidence |
| P10 | Release candidates and operations | P09 | `not_started` | Android and iOS candidates from one commit with approved identity/config/secrets matrix and recovery plan |
| P11 | Independent final review and reconciliation | P10 | `not_started` | Clean-checkout gates, complete inventory/crosswalk closure, and only `release_ready` or `repository_complete_release_blocked` |

P01 remains `not_started` until P00-014 passes. Production deployment is outside P10/P11 and remains a separate founder-approved action.

## Atomic task record contract

Every executable task record must contain: Task ID, Run ID or `PROGRAM`, portfolio, feature/slice, pipeline stage, atomic outcome, status, release class, source IDs, dependencies/blockers, owner and approver, intended files, mutation/live-impact scope, exact validation command, measurable acceptance criteria, decision/risk/evidence IDs, recovery and last-known-good checkpoint, started/updated/completed dates, and exact next task/command.

## P00 atomic ledger

P00 is program bootstrap, not an app feature run. Its deterministic order is P00-001 through P00-014; no later task may bypass its immediate predecessor.

### P00-001 - repository checkpoint

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Plan
- Atomic outcome: Record branch, HEAD, status, and recent history.
- Status / release class: `passed` / required.
- Source references: program specification; no AGENTS source.
- Dependencies / blockers: none / none.
- Owner / approver: program owner / none.
- Intended files and live impact: read-only Git; none.
- Exact validation command: `git status --short --branch; git rev-parse HEAD; git log -5 --oneline`.
- Acceptance: Repository metadata and protected pre-existing state are recorded without mutation.
- Decision / risk / evidence: DEC-0002; RISK-021; EVID-P00-001.
- Recovery / last known good: no mutation; historical checkpoint `4353237`.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-002.

### P00-002 - instruction and orchestration inventory

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Plan.
- Atomic outcome: Inventory applicable instructions, agents, commands, skills, and the ignored evidence path.
- Status / release class: `passed` / required.
- Source references: SRC-AG-0032, SRC-AG-0033, SRC-AG-0034.
- Dependencies / blockers: P00-001 / none.
- Owner / approver: program owner / none.
- Intended files and live impact: read-only inventory; the already-checkpointed `.gitignore` evidence rule; none.
- Exact validation command: `Get-ChildItem -LiteralPath '.\.claude\agents' -File; Get-ChildItem -LiteralPath '.\.claude\commands' -File; git check-ignore artifacts/privelier-rebuild/probe.txt`.
- Acceptance: One root AGENTS file, actual orchestration definitions, unavailable references, and the exact evidence ignore rule are recorded.
- Decision / risk / evidence: DEC-0011; RISK-020; EVID-P00-002 and EVID-P00-007.
- Recovery / last known good: no current mutation; historical checkpoint `4353237`.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-003.

### P00-003 - tool and read-only live-target inventory

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Plan.
- Atomic outcome: Inventory local tools and the connected Supabase target without retaining row data.
- Status / release class: `passed` / required.
- Source references: program specification; no AGENTS source.
- Dependencies / blockers: P00-002 / none.
- Owner / approver: program owner / none.
- Intended files and live impact: read-only local tool and Supabase metadata; none.
- Exact validation command: `node --version; npm --version; Get-Command graphify,supabase,maestro,adb -ErrorAction SilentlyContinue` plus Supabase MCP `get_project_url` and public table inventory.
- Acceptance: Tool availability, connected project ref, and RLS-enabled public-table count are recorded without rows or personal data.
- Decision / risk / evidence: DEC-0006; RISK-006, RISK-008; EVID-P00-003 and EVID-P00-004.
- Recovery / last known good: read-only; historical checkpoint `4353237`.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-004.

### P00-004 - EAS identity baseline

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Plan.
- Atomic outcome: Record current EAS project and reference-build metadata.
- Status / release class: `passed` / required.
- Source references: SRC-AG-0018.
- Dependencies / blockers: P00-003 / none.
- Owner / approver: program owner / none.
- Intended files and live impact: read-only EAS metadata; no identity or build mutation.
- Exact validation command: `npx eas-cli@latest project:info` and read-only `eas build:view` for build `3f1e4abb-23f9-47b6-9a75-2f8af1d5555c`.
- Acceptance: Observed project, build, platform, SDK, identifier, version, commit, and artifact expiry are recorded without signed URLs.
- Decision / risk / evidence: DEC-0005; RISK-005, RISK-006; EVID-P00-005 and EVID-P00-006.
- Recovery / last known good: read-only; historical checkpoint `4353237`.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-005.

### P00-005 - Graphify-scoped architecture query

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Plan.
- Atomic outcome: Query the knowledge graph before broad source browsing.
- Status / release class: `passed` / required.
- Source references: AGENTS graphify rule.
- Dependencies / blockers: P00-004 / none at the historical checkpoint; graph absence in the current workspace is routed to P00-013.
- Owner / approver: program owner / none.
- Intended files and live impact: read-only ignored graph; none.
- Exact validation command: `graphify query "Privelier role roots navigators screens data modules tests Supabase connectivity"`.
- Acceptance: A scoped subgraph is recorded as redacted evidence before raw source inventory.
- Decision / risk / evidence: DEC-0003; RISK-020; EVID-P00-008.
- Recovery / last known good: no mutation; historical checkpoint `4353237`.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-006.

### P00-006 - ledger architecture gate

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Design.
- Atomic outcome: Validate the canonical-ledger model before authoring.
- Status / release class: `passed` / required.
- Source references: DEC-0001 and accepted rebuild program design.
- Dependencies / blockers: P00-005 / none.
- Owner / approver: `architect-review` / program owner applying mandatory conditions.
- Intended files and live impact: read-only design review; none.
- Exact validation command: collaboration `architect-review` against AGENTS, decisions, evidence, risks, program design, and the P00 decomposition.
- Acceptance: Verdict covers scoped authority, 64-source freeze, portfolio/run separation, mutation approvals, one WIP task, sequential P00, evidence transitions, and current-state recovery.
- Decision / risk / evidence: DEC-0001, DEC-0003, DEC-0004, DEC-0006; RISK-020; EVID-P00-014.
- Recovery / last known good: no mutation; checkpoint `6f5654e`.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-007.

### P00-007 - canonical ledger authoring

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Build.
- Atomic outcome: Create the canonical execution ledger with required program structures.
- Status / release class: `passed` / required.
- Source references: DEC-0001 and accepted rebuild program design.
- Dependencies / blockers: P00-006 / none after architecture conditions were accepted.
- Owner / approver: program owner / architecture conditions.
- Intended files and live impact: `docs/execution/PRIVELIER_REBUILD_PLAN.md`; none.
- Exact validation command: `Test-Path '.\docs\execution\PRIVELIER_REBUILD_PLAN.md'; (Get-Content '.\docs\execution\PRIVELIER_REBUILD_PLAN.md' | Select-String -Pattern '^## ').Count`.
- Acceptance: Authority, statuses, delivery contract, approvals, P00-P11, task contract, P00 records, crosswalk, decisions, validation, and handoff sections exist.
- Decision / risk / evidence: DEC-0001, DEC-0003, DEC-0004; RISK-020; EVID-P00-012.
- Recovery / last known good: remove only the new ledger on failure; checkpoint `6f5654e`.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-008.

### P00-008 - AGENTS source crosswalk

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Validate.
- Atomic outcome: Freeze and validate the open AGENTS source snapshot.
- Status / release class: `passed` / required.
- Source references: SRC-AG-0001 through SRC-AG-0064.
- Dependencies / blockers: P00-007 / none.
- Owner / approver: program owner / none.
- Intended files and live impact: `docs/execution/PRIVELIER_REBUILD_PLAN.md`; none.
- Exact validation command: the source-count, ID-contiguity, uniqueness, fingerprint, and nonblank-mapping PowerShell checks in "Ledger validation."
- Acceptance: 61 checkbox sources plus 3 named prose sources map to 64 unique contiguous IDs; fingerprints are unique; mappings and dispositions are nonblank.
- Decision / risk / evidence: DEC-0001; RISK-020; EVID-P00-013.
- Recovery / last known good: patch only the crosswalk on failure; P00-007 passed.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-009.

### P00-009 - ledger integration conformance

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Validate.
- Atomic outcome: Prove the concrete ledger obeys the architecture conditions and has a consistent handoff.
- Status / release class: `passed` / required.
- Source references: all source IDs through the crosswalk; DEC-0001.
- Dependencies / blockers: P00-008 / concrete architect-review findings must be closed.
- Owner / approver: program owner / `architect-review` conformance PASS.
- Intended files and live impact: `docs/execution/PRIVELIER_REBUILD_PLAN.md` and `docs/execution/PRIVELIER_EVIDENCE_INDEX.md`; none.
- Exact validation command: run every command in "Ledger validation," `git status --short --branch`, and a read-only architect-review of this concrete file.
- Acceptance: One active writing task; exact sequential dependencies; P01 not ready; feature-run records exist; approvals and recovery are explicit; 64 sources have no orphan; checkpoint, affected files, and next command match Git state.
- Decision / risk / evidence: DEC-0001, DEC-0003, DEC-0004, DEC-0006; RISK-020, RISK-021; EVID-P00-015.
- Recovery / last known good: execution-doc conformance PASS; P00-007/P00-008 passed on `6f5654e`.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: after PASS, P00-010 and `npm ci`.

### P00-010 - lockfile-clean dependency install

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Validate.
- Atomic outcome: Install exactly the lockfile dependency graph.
- Status / release class: `passed` / required.
- Source references: dependency inventory; no direct AGENTS source.
- Dependencies / blockers: P00-009 / none after P00-009 passes.
- Owner / approver: dependency owner / none.
- Intended files and live impact: generated ignored `node_modules` only; no live impact.
- Exact validation command: capture manifest SHA-256 hashes and `git status --short`; run `& 'D:\Program Files\nodejs\npm.cmd' ci --cache '.\artifacts\privelier-rebuild\npm-cache'`; repeat hashes/status and `git diff -- package.json package-lock.json`.
- Acceptance: `npm ci` exits 0; manifests, execution docs, and protected unrelated paths are unchanged by the install.
- Decision / risk / evidence: DEC-0003; RISK-012, RISK-021; EVID-P00-016.
- Recovery / last known good: PowerShell `npm.ps1` was policy-blocked; sandbox cache/network attempts failed; the approved `npm.cmd` command with ignored workspace cache succeeded. Generated `node_modules` remains recoverable; P00-009 checkpoint.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-011.

### P00-011 - current reproducibility baseline

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Validate.
- Atomic outcome: Re-run the agreed current-HEAD quality and dependency baseline.
- Status / release class: `passed` / required.
- Source references: SRC-AG-0037; baseline evidence.
- Dependencies / blockers: P00-010 / none.
- Owner / approver: `test-engineer` / program owner.
- Intended files and live impact: read-only source and local caches; none.
- Exact validation command: `npm run typecheck`; `npm run lint`; `npm test -- --runInBand`; `npx expo-doctor`; `npx expo install --check`; `npm audit`.
- Acceptance: Each exit code and warning class is recorded; any nondeterministic warning or failure remains open for P01 rather than being called green.
- Decision / risk / evidence: DEC-0003; RISK-004, RISK-012; EVID-P00-009 and EVID-P00-017.
- Recovery / last known good: no source mutation; typecheck/lint passed, Jest reproduced the PortfolioScreen timeout, Expo Doctor/dependency checks passed, audit findings remained open; P00-010 checkpoint.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-012.

### P00-012 - clean-snapshot feasibility

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Integrate.
- Atomic outcome: Prove exact HEAD can be reconstructed, installed, and checked away from the protected working tree.
- Status / release class: `passed` / required.
- Source references: program clean-checkout requirement.
- Dependencies / blockers: P00-011 / local Supabase reset remains a separate P00-013 finding if CLI/config is absent.
- Owner / approver: program owner and `test-engineer` / none.
- Intended files and live impact: verified task-specific temporary worktree/directory only; none.
- Exact validation command: create a task-specific ignored directory, `git archive` exact HEAD into it, install with the lockfile and ignored npm cache, run typecheck/lint/Jest, compare active-workspace status/digest, verify the snapshot's resolved absolute path is inside `artifacts/privelier-rebuild`, then remove only that snapshot.
- Acceptance: Current working tree status is byte-for-byte unchanged; isolated install/check results and limitations are recorded.
- Decision / risk / evidence: DEC-0002, DEC-0003; RISK-004, RISK-008, RISK-021; EVID-P00-018.
- Recovery / last known good: exact-HEAD snapshot reconstructed and verified; PowerShell long-path cleanup removed only the resolved ignored snapshot; P00-011 checkpoint.
- Dates: started, updated, completed 2026-09-01.
- Exact next task: P00-013.

### P00-013 - full inventory reconciliation

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Integrate.
- Atomic outcome: Reconcile repository, controls, dependencies, Graphify, and read-only live/local schema inventories into stable dispositions.
- Status / release class: `in_progress` / required.
- Source references: all SRC-AG IDs; EVID-P00-011; RISK-003, RISK-008, RISK-014.
- Dependencies / blockers: P00-012 / Supabase CLI may be absent; hosted reads only.
- Owner / approver: program owner; schema findings to `supabase-schema-architect` / founder for any later live mutation.
- Intended files and live impact: execution docs and read-only catalog metadata; no hosted write.
- Exact validation command: tracked file/control/config/dependency inventories, current Graphify availability/update query if installed, Supabase MCP migration/catalog reads, and a clean local reset feasibility check if tooling exists.
- Acceptance: Remote-only waitlist migration, suspected `reviews.created_at` drift, graph absence, controls/screens/config/dependencies, and every crosswalk source have an evidence-linked disposition or compliant future run.
- Decision / risk / evidence: DEC-0006; RISK-003, RISK-008, RISK-014, RISK-020; EVID-P00-011 plus evidence pending.
- Recovery / last known good: documentation-only reconciliation; P00-012 checkpoint; no live rollback is needed because no live write is authorized.
- Dates: started and updated 2026-09-01; completion pending.
- Exact next task: P00-014.

### P00-014 - P00 Secure, Integrate, and Release gate

- Run ID: `PROGRAM`
- Portfolio / stage: `P00` / Secure, Integrate, Release.
- Atomic outcome: Freeze an honest P00 baseline and make P01 ready only if every P00 gate passed.
- Status / release class: `not_started` / release blocker.
- Source references: all P00 tasks and all source crosswalk entries.
- Dependencies / blockers: P00-013 / any failed P00 task reopens its owner; external blockers are recorded, not waived.
- Owner / approver: `security-auditor`, `context-manager`, program owner / founder only if a decision is required.
- Intended files and live impact: execution docs and redacted evidence only; none.
- Exact validation command: execution-doc secret/PII scan, Git status/diff review, full P00 evidence/dependency check, crosswalk-orphan check, and independent security/integration reviews.
- Acceptance: No secret/PII evidence; protected paths untouched; P00-001 through P00-013 passed; P01 changed from `not_started` to `ready`; exact next command and residual blockers recorded.
- Decision / risk / evidence: DEC-0001 through applicable DEC-0012; RISK-006, RISK-011, RISK-020, RISK-021; terminal evidence pending.
- Recovery / last known good: failed gate leaves P00 active and reopens the owning task; P00-013 checkpoint.
- Dates: not started; updated 2026-09-01.
- Exact next task: P01-001 only after PASS.

## AGENTS.md source snapshot and crosswalk

Snapshot rule: `SRC-AG-0001` through `SRC-AG-0064` are immutable identifiers assigned on 2026-09-01. Their numbers are never recomputed from line numbers. The fingerprint is the durable normalized anchor. A source may later map to several atomic child tasks, but no source may be deleted from `AGENTS.md` until all mapped children pass.

The `Mapped task` values in this crosswalk are stable routing placeholders, not executable atomic task records and not status-bearing work items. Their dispositions are source metadata. Before any placeholder becomes executable, its portfolio must create a task record conforming to the atomic-task contract, including owner, approver, dependencies, blocker status, exact unblock action, validation, evidence, and recovery. The compliant blocked-decision/external owners and unblock actions known today are centralized in "Open decisions and external approvals."

| Source ID | Fingerprint | AGENTS.md source | Mapped task | Portfolio | Disposition |
|---|---|---|---|---|---|
| SRC-AG-0001 | `auth-maestro-stage6` | Step 5 - Stage 6 test-engineer and four auth flows | P01-BL-001 | P01/P09 | Open; tooling in P01, hardware flows in P09 |
| SRC-AG-0002 | `users-city-covering-index` | Step 5 - city discovery covering index | P02-BL-001 | P02 | Open; schema-architect only |
| SRC-AG-0003 | `anon-bootstrap-grants` | Step 5 - anon leftover privilege cleanup | P02-BL-002 | P02 | Open; schema-architect only |
| SRC-AG-0004 | `google-apple-signin` | Google and Apple sign-in | P03-BL-001 | P03 | Open; approved design, schema sign-off then provider implementation |
| SRC-AG-0005 | `oauth-server` | OAuth 2.1 Server | DEF-BL-001 | Deferred | `deferred_out_of_scope`; founder may reopen separately |
| SRC-AG-0006 | `internal-admin-app` | Internal admin app | DEF-BL-002 | Deferred | `deferred_out_of_scope`; founder may reopen separately |
| SRC-AG-0007 | `signet-device-review` | Signet visual review in both themes | P09-BL-001 | P09 | `blocked_external`; founder/device session |
| SRC-AG-0008 | `signet-ranked-placements` | Signet colophon, icon, splash, optional confirmation placement | P05-BL-001 | P05 | Open; split asset and UI runs before Build |
| SRC-AG-0009 | `signet-logo-token-lint` | Optional logo-token ESLint hardening | P05-BL-002 | P05 | Optional follow-up |
| SRC-AG-0010 | `discover-screen-review` | Discover/Home screen | P06-BL-001 | P06/P09 | Code evidence needs P00 reconciliation; founder review remains |
| SRC-AG-0011 | `barber-profile-screen-review` | Barber profile detail screen | P06-BL-002 | P06/P09 | Code evidence needs P00 reconciliation; founder review remains |
| SRC-AG-0012 | `bookings-tab-review` | Customer Bookings tab | P06-BL-003 | P06/P09 | Code evidence needs P00 reconciliation; founder review remains |
| SRC-AG-0013 | `inbox-tab-review` | Customer Inbox tab | P06-BL-004 | P06/P09 | Code evidence needs P00 reconciliation; founder review remains |
| SRC-AG-0014 | `account-tab-review` | Customer Account tab | P06-BL-005 | P06/P09 | Code evidence needs P00 reconciliation; founder review remains |
| SRC-AG-0015 | `remaining-customer-screens` | Remaining customer screens and account stats | P06-BL-006 | P06 | Open; decompose honest remaining behavior separately |
| SRC-AG-0016 | `barber-location-device-gate` | Barber location capture founder on-device gate | P09-BL-002 | P09 | `blocked_external`; founder/device/live data |
| SRC-AG-0017 | `barber-location-independent-security` | Independent security-auditor rerun for location | P11-BL-001 | P11 | Required independent follow-up; no bypass of prior feature gate |
| SRC-AG-0018 | `current-android-map-build` | Current Android development build installation handoff | P09-BL-003 | P09 | `blocked_external`; expiring external artifact/device |
| SRC-AG-0019 | `explore-map-device-review` | Explore map and LocationEdit founder review | P09-BL-004 | P09 | `blocked_external`; founder/device session |
| SRC-AG-0020 | `map-low-followups` | Map attribution overlap and future clustering | P06-BL-007 | P06/P09 | Low follow-up; first item device-dependent |
| SRC-AG-0021 | `barber-side-screens` | Barber-side screen rebuild/review | P07-BL-001 | P07/P09 | Code evidence needs P00 reconciliation; founder review remains |
| SRC-AG-0022 | `auth-role-restyle` | Auth and role-select restyle | P05-BL-003 | P05/P09 | Code evidence needs P00 reconciliation; visual review remains |
| SRC-AG-0023 | `services-availability-maestro` | Barber services and availability Maestro flows | P09-BL-005 | P09 | `blocked_external`; P01 tooling prerequisite |
| SRC-AG-0024 | `discovery-maestro` | Customer discovery Maestro flow | P09-BL-006 | P09 | `blocked_external`; P01 tooling prerequisite |
| SRC-AG-0025 | `booking-duration-overlap` | Duration-overlap booking guard | P02-BL-003 | P02 | Release blocker; combine only with same appointment-integrity run |
| SRC-AG-0026 | `booking-server-validation` | Server-owned future, availability, and overlap validation | P02-BL-004 | P02 | Critical release blocker; schema-architect only |
| SRC-AG-0027 | `availability-blackouts` | Closed/blackout availability representation | P02-BL-005 | P02 | Follow-up; separate feature run |
| SRC-AG-0028 | `booking-maestro` | Customer booking Maestro flow | P09-BL-007 | P09 | `blocked_external`; P01 tooling prerequisite |
| SRC-AG-0029 | `booking-status-realtime-device` | Two-session booking status and reconnect gate | P09-BL-008 | P09 | `blocked_external`; required before Step 18 |
| SRC-AG-0030 | `requests-maestro` | Barber request accept/reject Maestro flow | P09-BL-009 | P09 | `blocked_external`; P01 tooling prerequisite |
| SRC-AG-0031 | `verification-submission-live-gate` | Live verification document submission and approval gate | P09-BL-010 | P09 | `blocked_external`; required live founder/device procedure |
| SRC-AG-0032 | `fullstack-agent-stack-definition` | Rewrite fullstack-developer agent for Expo/Supabase | P00-BL-001 | P00 | Open orchestration reconciliation; no product behavior |
| SRC-AG-0033 | `debugger-model-pin` | Remove or update stale debugger model pin | P00-BL-002 | P00 | Open orchestration reconciliation |
| SRC-AG-0034 | `agent-registry-gap` | Architect/realtime agent registration gap | P00-BL-003 | P00 | Open tooling inventory; current harness can use Codex subagents |
| SRC-AG-0035 | `missing-rn-maestro-skills` | Install missing RN and Maestro skills | P01-BL-002 | P01 | Open tooling task; verify source and permissions first |
| SRC-AG-0036 | `supabase-advisor-findings` | Security-advisor findings and leaked-password toggle | P02-BL-006 | P02 | Mixed accepted/design/founder action; split before execution |
| SRC-AG-0037 | `verifyscreen-suite-instability` | VerifyScreen full-suite pollution | P01-BL-003 | P01 | Reconcile against current 550-test warning baseline |
| SRC-AG-0038 | `chat-two-device-gate` | Chat send/receive two-session gate | P09-BL-011 | P09 | `blocked_external`; required before Step 18 |
| SRC-AG-0039 | `chat-history-pagination` | Conversation history growth and pagination | P08-BL-001 | P08 | Performance follow-up |
| SRC-AG-0040 | `unread-marker-race` | Read-marker recovery race | P08-BL-002 | P08 | Resilience follow-up |
| SRC-AG-0041 | `unread-clock-scan-cap` | Device-clock and scan-cap unread edge case | P08-BL-003 | P08 | Optional resilience follow-up |
| SRC-AG-0042 | `chat-read-state-service-role` | Future service-role grants on chat_read_state | DEF-BL-003 | Deferred | `deferred_out_of_scope`; only if admin tooling needs it |
| SRC-AG-0043 | `terminal-booking-chat-policy` | Messaging after rejected/cancelled bookings | P02-BL-007 | P02 | `blocked_decision`; ODEC-004, founders decide |
| SRC-AG-0044 | `typing-public-channel-auth` | Narrow live verification of typing-channel authorization | P09-BL-012 | P09 | Live security gate; never blanket-enable private channels |
| SRC-AG-0045 | `read-receipt-comment-drift` | Correct stale read-receipt rationale comments | P08-BL-004 | P08 | Documentation-only follow-up within realtime reconciliation |
| SRC-AG-0046 | `customer-chat-header-copy` | Correct customer chat header copy | P06-BL-008 | P06 | Small UI copy run; still follows full pipeline if behavior changes |
| SRC-AG-0047 | `receipt-timestamp-compare` | Normalize unread marker timestamp comparison | P08-BL-005 | P08 | Realtime correctness follow-up |
| SRC-AG-0048 | `realtime-hook-test-gaps` | Outage and room-switch realtime hook tests | P08-BL-006 | P08 | Required resilience validation |
| SRC-AG-0049 | `realtime-warnings-rate-limit` | Realtime warning hygiene and typing rate-limit residual | P08-BL-007 | P08 | Split client-log and server-limit concerns before work |
| SRC-AG-0050 | `receipts-typing-device-gate` | Two-device receipts and typing gate | P09-BL-013 | P09 | `blocked_external`; required before Step 18 |
| SRC-AG-0051 | `verification-founder-e2e` | Founder review-path end-to-end gate | P09-BL-014 | P09 | `blocked_external`; dashboard founder action |
| SRC-AG-0052 | `verification-status-drift` | Two verification status surfaces can drift | P02-BL-008 | P02 | Schema-architect design; no live write without approval |
| SRC-AG-0053 | `portfolio-maestro` | Portfolio upload/delete Maestro flow | P09-BL-015 | P09 | `blocked_external`; P01 tooling prerequisite |
| SRC-AG-0054 | `portfolio-security-followups` | Portfolio orphan, MIME/size, and error-copy follow-ups | P02-BL-009 | P02 | Split storage-policy and client robustness runs |
| SRC-AG-0055 | `barber-dashboard-device-review` | Barber dashboard founder visual review | P09-BL-016 | P09 | `blocked_external`; founder/device session |
| SRC-AG-0056 | `requests-history-scaling` | Dashboard/Requests Phase 2 query scaling | DEF-BL-004 | Deferred | `deferred_out_of_scope`; Phase 2 |
| SRC-AG-0057 | `barber-bio-device-review` | Barber bio-edit founder review | P09-BL-017 | P09 | `blocked_external`; founder/device session |
| SRC-AG-0058 | `barber-bio-moderation` | Public bio moderation/disintermediation | DEF-BL-005 | Deferred | `deferred_out_of_scope`; Phase 2 policy |
| SRC-AG-0059 | `step18-full-flow` | Full real-user Step 18 flow | P09-BL-018 | P09 | Release blocker; depends on all required prior gates |
| SRC-AG-0060 | `reviews-device-gate` | Reviews founder on-device gate | P09-BL-019 | P09 | `blocked_external`; code evidence reconciled first |
| SRC-AG-0061 | `full-app-ultra-device-review` | Full-app Ultra founder visual review | P09-BL-020 | P09 | `blocked_external`; required before release |
| SRC-AG-0062 | `phase2-payments-disputes` | Stripe, disputes, refunds, cancellation-fee policy | DEF-BL-006 | Deferred | `deferred_out_of_scope`; Phase 2 founder decision |
| SRC-AG-0063 | `phase2-inhome-safety` | Live location and SOS safety features | DEF-BL-007 | Deferred | `deferred_out_of_scope`; Phase 2/3 liability gate |
| SRC-AG-0064 | `phase2-email-change` | Service-owned email-change synchronization | DEF-BL-008 | Deferred | `deferred_out_of_scope`; Phase 2 |

## Open decisions and external approvals

| Decision | Blocks | Owner | Exact unblock action |
|---|---|---|---|
| ODEC-001 legacy booking timezone/backfill policy | P02 timezone Build and hosted migration | Founders + schema architect | Present measured live-data cases and approve one explicit legacy-row timezone policy |
| ODEC-002 production Customer/Barber identities and EAS strategy | P04 production variants and P10 candidates | Founders | Approve the exact identifier/ownership/migration matrix after repository-local variant design |
| ODEC-003 account deletion retention/anonymization | Destructive P03 deletion completion | Founders | Approve retained, anonymized, and deleted records plus retention periods |
| ODEC-004 terminal-booking messaging policy | Any behavior change to cancelled/rejected chat | Founders | Confirm always-writable chat or approve a separate read-only-terminal-state run |
| EXT-001 Maestro and device matrix | P09 device flows | Founders + test owner | Provide/install approved tooling and attach the required Android/iOS/two-session environment |
| EXT-002 Google/Apple provider credentials | P03 provider E2E | Founders | Configure provider consoles/Supabase and provide redacted confirmation, never secrets |

## Ledger validation

Run from the repository root. These checks are read-only.

```powershell
$agents = Get-Content -LiteralPath '.\AGENTS.md'
$checkboxCount = ($agents | Where-Object { $_ -match '^- \[ \] ' }).Count
if ($checkboxCount -ne 61) { throw "Expected 61 AGENTS checkbox sources; found $checkboxCount" }

$proseHeadings = @(
  '### Google + Apple sign-in',
  '### OAuth 2.1 Server',
  '### Internal admin app'
)
foreach ($heading in $proseHeadings) {
  if (($agents | Select-String -SimpleMatch $heading).Count -ne 1) {
    throw "Missing or duplicate prose source: $heading"
  }
}

$plan = Get-Content -LiteralPath '.\docs\execution\PRIVELIER_REBUILD_PLAN.md'
$sourceRows = $plan | Where-Object { $_ -match '^\| SRC-AG-\d{4} \|' }
$ids = $sourceRows | ForEach-Object { (($_ -split '\|')[1].Trim()) -replace '^SRC-AG-', '' }
$fingerprints = $sourceRows | ForEach-Object { ($_ -split '\|')[2].Trim().Trim('`') }
$mappings = $sourceRows | ForEach-Object { ($_ -split '\|')[4].Trim() }
$dispositions = $sourceRows | ForEach-Object { ($_ -split '\|')[6].Trim() }
if ($ids.Count -ne 64) { throw "Expected 64 crosswalk rows; found $($ids.Count)" }
if (($ids | Sort-Object -Unique).Count -ne 64) { throw 'Duplicate source ID' }
if (($fingerprints | Sort-Object -Unique).Count -ne 64) { throw 'Duplicate source fingerprint' }
if (($mappings | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -ne 0) { throw 'Blank task mapping' }
if (($dispositions | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -ne 0) { throw 'Blank disposition' }
$expected = 1..64 | ForEach-Object { '{0:D4}' -f $_ }
if (Compare-Object -ReferenceObject $expected -DifferenceObject $ids) { throw 'Non-contiguous source IDs' }

$wip = $plan | Select-String -Pattern '^- Status / release class: `in_progress` /'
if ($wip.Count -ne 1) { throw "Expected one active writing task; found $($wip.Count)" }
if (($plan | Select-String -Pattern '^### P00-\d{3} -').Count -ne 14) { throw 'Expected 14 P00 task records' }
if (($plan | Select-String -Pattern '^\| P01 \|.*\| `not_started` \|').Count -ne 1) { throw 'P01 became ready before P00-014' }

$runs = $plan | Select-String -Pattern '^\| RUN-P\d{2}-\d{3} \|' | ForEach-Object { ($_ -split '\|')[1].Trim() }
foreach ($run in ($runs | Sort-Object -Unique)) {
  $stageCount = ($plan | Select-String -Pattern "^\| $run-S0[1-7] \|").Count
  if ($stageCount -ne 7) { throw "$run has $stageCount stage records instead of 7" }
}

git status --short --branch
```

Acceptance for P00-007/P00-008/P00-009:

- The AGENTS checkbox count is 61 and the three named prose sources are present.
- The crosswalk count and unique count are 64; the contiguous comparison emits no differences.
- The executable task-record WIP count is exactly one and matches "Current program checkpoint."
- P00 dependencies are strictly sequential; P01 is not ready before P00-014.
- All blocked work has an owner and exact unblock action.
- No P00 task authorizes a live mutation.
- Current HEAD/status, intended files, recovery, resume point, and exact next task are mutually consistent.

## Current handoff

P00-006 through P00-011 passed their program/evidence gates, while RISK-004 and RISK-012 remain open. P00-012 proved exact-HEAD reconstruction: package hashes matched, an offline lockfile install succeeded, typecheck/lint passed, and isolated Jest passed 550/550 while emitting the same `act()` warning classes. The contrast with P00-011's 549/550 Portfolio timeout confirms nondeterminism rather than a stable product failure. Active-workspace status/hashes were unchanged, and the verified ignored snapshot was removed. P00-013 is the sole active task; hosted access remains read-only.
