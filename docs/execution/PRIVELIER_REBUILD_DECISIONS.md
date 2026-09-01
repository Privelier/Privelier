# Privelier rebuild decision log

Last updated: 2026-09-01

This log records decisions for the Privelier Legendary Product Rebuild and Release Program. Locked founder decisions in AGENTS.md and docs/design remain authoritative unless a later explicit founder decision supersedes them. Repository evidence is preferred over stale prose; live production changes still require separate authorization.

## Decision record

### DEC-0001 — Two synchronized sources of truth during the rebuild

- Date: 2026-09-01
- Question: AGENTS.md says its Tasks section is the single source of truth, while the rebuild specification calls PRIVELIER_REBUILD_PLAN.md the canonical execution ledger.
- Options: silently replace AGENTS.md; duplicate all detail indefinitely; keep AGENTS.md as the product-backlog authority and the rebuild plan as the execution/evidence authority with mandatory synchronization.
- Decision: use the third option. Every open AGENTS.md item receives a stable rebuild task ID. New product work is added to AGENTS.md and the ledger. A completed AGENTS.md line is deleted only after its gate passes; the ledger retains permanent evidence.
- Rationale: preserves the existing authoritative backlog while providing resumable atomic status and evidence.
- Sources: AGENTS.md Tasks maintenance protocol; user rebuild specification, persistent_goal_and_continuity_protocol.
- Reversibility: reversible after founder approval to make AGENTS.md point directly to the new ledger.
- Approver: founder instruction supplied in this session; final source-of-truth consolidation remains a founder decision.
- Affected modules: AGENTS.md; docs/execution.

### DEC-0002 — Preserve the dirty working tree

- Date: 2026-09-01
- Question: how should rebuild work begin when main contains existing user changes?
- Decision: preserve AGENTS.md, app.json, and assets/marketing/city-goes-quiet-ad-v1.png exactly as found. Rebuild bootstrap files are isolated under docs/execution, docs/plans, and the exact artifacts ignore rule. Do not switch branches, stage, commit, revert, or rewrite the user changes during P00.
- Rationale: these changes are not known to belong to this run.
- Sources: git status at 435323785499c29bdfa22d6c99dd5101af15a332; workspace safety rules.
- Reversibility: yes.
- Approver: engineering safety default.
- Affected modules: Git working tree.

### DEC-0003 — P00 then P01 are the first safe milestones

- Date: 2026-09-01
- Question: should architecture, UI, auth, or schema work start immediately?
- Options: broad rebuild; release-only patching; frozen baseline followed by deterministic test/dependency health.
- Decision: choose frozen baseline, then test/dependency health. P02 and later cannot start until P01 is green.
- Rationale: the known Portfolio timeout and asynchronous test warnings make later evidence unreliable.
- Sources: rebuild BASE-005 and BASE-006; AGENTS.md build order; architect-review result.
- Reversibility: no practical reason to reverse.
- Approver: founder specification.
- Affected modules: all workstreams.

### DEC-0004 — P00–P11 are portfolios, not giant feature runs

- Date: 2026-09-01
- Question: how can the rebuild honor one feature per pipeline run?
- Decision: every behavior-changing slice under P02–P08 gets its own Plan → Design → Build → Validate → Secure → Integrate → Release run. P09 is a system-level closure pass and never substitutes for validation or security inside a feature run.
- Rationale: prevents an unreviewable rewrite and preserves the mandatory project pipeline.
- Sources: AGENTS.md orchestration pipeline and hard rules; rebuild feature_delivery_pipeline.
- Reversibility: no.
- Approver: founder specification.
- Affected modules: execution ledger.

### DEC-0005 — EAS identity is read-only until explicitly approved

- Date: 2026-09-01
- Question: which EAS project identity is current?
- Evidence: app.json currently contains project ID 4e46ae1b-e79e-4c7e-b407-7880f2cc047c; eas project:info resolves it to @aatt/privelier; reference build 3f1e4abb-23f9-47b6-9a75-2f8af1d5555c belongs to the same project and exact HEAD. The dirty AGENTS.md text mentions a conflicting @alitahaiostest/c44dc... project.
- Decision: treat @aatt/privelier as the observed baseline, preserve both dirty files, and block every EAS ownership, project-ID, bundle-ID, package-name, certificate, or store-identity mutation pending explicit founder approval.
- Rationale: observed tooling and the supplied reference build agree; mutating identity is explicitly approval-gated.
- Sources: local app.json; EAS CLI read-only output; rebuild target_repository.
- Reversibility: yes.
- Approver: founder required for any mutation.
- Affected modules: app.json; app.config.js; eas.json; future build variants.

### DEC-0006 — Supabase access is read-only during P00

- Date: 2026-09-01
- Question: may connected Supabase tooling be used immediately?
- Decision: use MCP for read-only inventory, logs, advisors, and controlled evidence. Do not apply migrations, mutate data, alter providers, deploy functions, or change live configuration without the exact target, tested migration, recovery posture, and explicit founder authorization.
- Rationale: the MCP points to the real hosted project; local Supabase CLI/test infrastructure is not currently available.
- Sources: AGENTS.md secrets/schema rules; rebuild authority_and_safety and migration_rules.
- Reversibility: no.
- Approver: founder required for live writes.
- Affected modules: Supabase project ajcsanrepboqcjgpzsaa.

### DEC-0007 — Timezone migration is a blocked design decision, not an implicit rewrite

- Date: 2026-09-01
- Question: how should the new UTC timestamptz plus IANA-timezone requirement coexist with the approved naive local DATE/TIME booking design?
- Evidence: docs/design/step-11-12-booking-flow-design-approval.md explicitly locks barber-local wall-clock date/time; the new rebuild contract requires UTC instants and an IANA timezone. Existing rows do not carry a reliable originating timezone.
- Decision: inventory and design may proceed, but the P02 timezone/backfill Build stage is blocked_decision until founders select a legacy-row timezone/backfill policy and approve the exact schema design. Adjacent booking-integrity work may continue if the schema architect proves it does not prejudge that decision.
- Rationale: guessing a timezone can silently move appointments.
- Sources: approved booking design; rebuild database_and_backend_contract.
- Reversibility: design is reversible; data conversion is not safely reversible without retained source values.
- Approver: founder plus supabase-schema-architect gate.
- Affected modules: bookings, availability, slot calculation, formatting, tests.

### DEC-0008 — Preserve the approved OAuth design until current official guidance is reconciled

- Date: 2026-09-01
- Question: should Google/Apple auth be redesigned before implementation?
- Decision: retain the approved browser-PKCE Google design and official iOS Apple control as the starting architecture. P03 must compare it against current official Expo, Supabase, Apple, and Google guidance and document any repository-tested incompatibility before changing it.
- Rationale: the approved design is provider-agnostic and preserves manual barber verification; version-sensitive details may have changed.
- Sources: docs/design/google-apple-oauth-signin-design-approval.md; rebuild authentication_contract and official_source_policy.
- Reversibility: yes before provider rollout.
- Approver: founder required for a material architecture change.
- Affected modules: src/auth; lib/supabase.ts; app config; EAS native builds.

### DEC-0009 — OAuth Server and the internal admin app remain deferred

- Date: 2026-09-01
- Question: are the on-hold OAuth 2.1 server and internal admin app part of this rebuild?
- Decision: no. Keep both visible as deferred_out_of_scope and do not resume them.
- Rationale: both AGENTS.md and the new rebuild scope place them on hold.
- Sources: AGENTS.md living backlog; rebuild product_truth_and_scope.
- Reversibility: founder may explicitly resume them in a separate pipeline.
- Approver: founder.
- Affected modules: none in this program.

### DEC-0010 — Separate role roots now; production identities later

- Date: 2026-09-01
- Question: how far may the two-app target proceed without store identity approval?
- Decision: implement independently testable Customer and Barber roots and a typed APP_VARIANT proposal/configuration in repository-local development and preview contexts. Do not change production identifiers, EAS ownership, signing, or store identities.
- Rationale: separates product architecture from externally consequential identity migration.
- Sources: AGENTS.md Product and Tech stack; rebuild build_variant_target.
- Reversibility: role-root separation is intended; variant identifiers remain reversible until approved.
- Approver: founder required for identity rollout.
- Affected modules: App.tsx, entry points, navigators, app/eas config.

### DEC-0011 — Available orchestration definitions live under .claude

- Date: 2026-09-01
- Question: how should stale .Codex references be handled?
- Decision: use the actual .claude/agents and .claude/commands definitions, plus currently installed .agents/skills and available Codex subagents. Log any unavailable named role and apply its documented gate manually only when no callable equivalent exists.
- Rationale: repository inventory shows no .Codex directory; silently invoking phantom tools would skip gates.
- Sources: repository file inventory; AGENTS.md Important distinction.
- Reversibility: yes if the harness layout changes.
- Approver: engineering evidence.
- Affected modules: orchestration only.

### DEC-0012 — Account deletion engineering waits only on the retention decision

- Date: 2026-09-01
- Question: is account deletion part of release scope?
- Decision: inventory store requirements, design reauthentication and the request path, and implement every policy-neutral part. Mark the destructive completion/retention behavior blocked_decision until founders approve retention/anonymization rules for marketplace records.
- Rationale: store compliance and user control matter, but legal retention cannot be invented by engineering.
- Sources: rebuild identity_and_role_invariants; authority_and_safety.
- Reversibility: yes before production data deletion.
- Approver: founder/legal product decision.
- Affected modules: auth, user profile, bookings/messages/reviews retention.

## Open decisions

| ID | Decision needed | Blocks | Owner | Exact next step |
|---|---|---|---|---|
| ODEC-001 | Legacy booking timezone and backfill policy | P02 timezone Build and live migration | Founders | Choose the source timezone policy after the schema architect presents measured live-data cases. |
| ODEC-002 | Production Customer/Barber identifiers, EAS projects, ownership, and migration strategy | P04 production variants and P10 release candidates | Founders | Approve exact identifiers only after the repository-local variant proposal and compatibility plan. |
| ODEC-003 | Account deletion retention/anonymization policy | P03 destructive deletion completion | Founders | Decide which marketplace records must be retained, anonymized, or deleted and for how long. |
| ODEC-004 | Whether messaging remains writable after rejected/cancelled bookings | Terminal-state chat policy | Founders | Confirm current always-open behavior or approve a separate read-only terminal-state feature run. |

