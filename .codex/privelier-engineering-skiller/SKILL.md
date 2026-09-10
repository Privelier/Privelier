---
name: privelier-engineering-skiller
description: "Audit, debug, test, harden, and optimize Privelier's React Native/Expo apps and Supabase backend. Use for whole-app engineering reviews, confirmed bug fixes, database health, security, measured smoothness, missing essentials, and release readiness. Route visual and journey design to privelier-ui-ux-skiller."
---

# Engineering and security skiller

Make Privelier dependable for customers booking a private barber at home, barbers managing visits, and the two founders operating the service. Find failures that matter, repair their causes, and substantiate the result. Treat excellence as a continuing, evidence-based engineering practice; never promise zero bugs, perfect security, or unlimited scalability.

## Select the working mode

- **Whole-app audit:** inventory both apps and their shared backend, inspect every first-party code area in bounded passes, and reconcile product capabilities with the active backlog. A request to review/check produces findings; a request to fix/improve also authorizes scoped local repairs. Do not quietly convert an audit-only request into implementation.
- **Targeted repair:** reproduce the reported failure and follow its dependencies. Expand only when evidence shows a shared cause; do not rerun an unrelated whole-app audit.
- **Release readiness:** account for the full release surface and every required gate, including real users and devices. This is a readiness review; publishing, deploying, or changing external access still follows the user's actual authorization.
- A request to create or edit this skill changes the skill artifact only. It does not initiate an app audit or database operation.

Use the current request and prior authorization; do not ask again for already authorized work. Challenge legacy technical conventions with a concrete alternative and evidence. Reversible refactoring and fixing confirmed defects are appropriate when requested. General demands for perfection do not define missing product policy or authorize destructive live-data changes, new paid services, external communications, or collecting new sensitive data.

## Establish context and evidence

1. Resolve the Privelier repository from the active workspace. Read its full `AGENTS.md` and applicable nested instructions. Check the current diff; preserve user and collaborator changes. Use current decisions rather than copying this skill's assumptions into the application.
2. Before source exploration, run `npm run context:check`, then `npm run context:query -- query "<focused engineering question>"`. If missing, bootstrap the graph; if stale, refresh it. Query by subsystem. Where insufficient, use `context:pack` only for explicit tracked, non-secret files, then read exact source ranges. If graph tooling fails, record that failure and continue scoped direct inspection instead of claiming graph coverage.
3. For a full audit, enumerate tracked files and explicitly selected untracked app files, routes, shared modules, Supabase objects, migrations, tests, build profiles, CI, and configuration. Exclude generated/vendor/build content with a stated reason. A graph search or a test run is not a review of all code. Audit first-party files in manageable batches and use the lockfile for third-party dependency analysis.
4. Read `package.json`, the lockfile, app configuration and relevant test instructions. Discover installed versions and scripts rather than assuming the versions present when this skill was written. Locate backlog sections with `rg`; a whole-backlog read is appropriate only for the requested broad audit or release planning.
5. Discover actual Supabase, shell, device, testing and collaboration tools before scheduling them. Use the connected Supabase MCP for live facts when available. Record the project/environment and use metadata or aggregate queries before any user data. Never request keys or private documents merely to inspect the architecture.

Maintain one coverage ledger in the repository's existing audit/report convention, or a task-scoped `docs/quality/<date>-<scope>.md` when no convention exists:

| Area / file group / journey | Evidence and environment | Inspection status | Test status | Finding / next action |
|---|---|---|---|---|
| Customer, barber, shared, Supabase, tooling | Commit plus dirty diff, file lines, command or live result, device/build | Inspected / uninspected / blocked / N/A with reason | Passed / failed / not run / blocked / N/A | Owner and acceptance check |

Persist the ledger during long work. Distinguish source evidence, mocked behavior, local DB tests, live-role tests, device tests, measurements, and hypotheses. Keep private payloads and secrets out of artifacts. Finish every in-scope accessible area; do not silently sample a few files and label the whole app clean.

## Orchestrate repairs and reviews

Follow **Plan → Design → Build → Validate → Secure → Integrate → Release** for each feature repair. Independent read-only probes can run in parallel. Keep feature implementation cycles separate and respect the current build order and documented environmental exceptions.

Resolve profile paths first. At creation time, profiles and command instructions were found under `.claude/agents/` and `.claude/commands/`; `.Codex/` references in project prose were stale. Search known project locations if paths change. A Markdown agent profile is not automatically a callable tool, and a slash command is not a PowerShell command.

| Stage | Required responsibility and concrete output |
|---|---|
| Plan | `task-decomposition-expert`: problem, reproduction, acceptance checks, dependencies, file ownership and bounded tasks before edits. |
| Design | `architect-review`: data contracts, state machine, both-app effects, failure modes, migration need and rollout/recovery plan. |
| Schema, if needed | `supabase-schema-architect` alone owns DDL, migrations, constraints, indexes, triggers, functions, RLS and grants; stage changes and execute the verified `supabase-schema-sync` workflow within authorization. |
| Build | `fullstack-developer` for backend/data logic without schema edits. Add `supabase-realtime-optimizer` for booking/chat, with live publication, replica identity and RLS facts explicitly supplied. |
| UI collaboration | UI structure, components, navigation, accessibility presentation and polishing go to the UI peer using **Sol 5.6 Ultra** (`gpt-5.6-sol`, `ultra`) under the current founder rule. Engineering owns diagnosis, measurement and nonvisual correctness. |
| Validate | `test-engineer`: targeted regressions plus relevant unit, integration, DB and Maestro coverage. Use `debugger` when a stage fails; fix the cause and repeat the affected checks. |
| Secure | `security-auditor`: execute the applicable checks in the verified `security-audit` and `supabase-security-audit` workflows and issue an explicit scoped PASS, FAIL or BLOCKED with evidence. |
| Integrate | `database-optimizer` checks affected query performance; `context-manager` checks existing features, both app builds, generated types and backlog integration. Mark genuinely unaffected DB checks N/A with reason. |
| Release | Verify no changes invalidated prior gates, produce the release verdict and remaining conditions, and perform only authorized release actions. |

When the host exposes generic subagents, read and assign the verified role profile to a real collaborator with a precise responsibility. Do not substitute an unowned general worker for the schema specialist. If delegation is unavailable, carry out available non-schema review work locally and disclose the missing role gate; do not claim the prescribed agent participated. Load only relevant installed skills. Apply RN and Maestro practices directly if referenced skills remain absent.

Read command workflows and run their relevant underlying checks when slash execution is unavailable; report that accurately. Adapt shell syntax to the actual host. Do not follow legacy instructions that dump `.env*`, raw secret matches or private records into model context. Reuse recent evidence only if the code and environment affecting it have not changed. Any integration edit that affects behavior reopens its relevant validation/security checks.

## Correctness and business invariants

Trace each high-risk operation through UI event → state/hook → data access → authenticated request → DB constraint/RLS → response/realtime → both affected app states. Test denied as well as allowed behavior.

- **Auth and roles:** signup/profile consistency, partial signup recovery, trusted role assignment, no customer-to-admin or self-verification escalation, persisted session restoration, token refresh, password recovery/deep links, sign-out cleanup and account switching. Check that cached data, subscriptions and async callbacks from the previous account cannot leak into the next.
- **Separate apps:** verify customer and barber app entry points, branding/build configuration and navigation isolation. Shared backend utilities must not expose the other role's protected experience. Route gating improves UX; server authorization remains necessary.
- **Discovery:** only approved barbers appear; city filtering is correct; empty cities, null/old profile data and concurrent verification changes behave truthfully. Verify whether both `verified` and `verification_status` are involved and detect contradictory states.
- **Services and availability:** ownership, valid price/duration, zero versus absent values, date/time parsing, day boundaries, local timezone/DST where relevant, service fitting within a window, overlapping windows, unavailable dates, stale slots and service edits/deletion. Establish actual semantics for pending slot reservations and travel/buffer time; do not invent policy to resolve ambiguity.
- **Bookings:** verify durable price snapshots, customer/barber/service relationships, server enforcement of actor rules, replay/double-submit handling, concurrent slot contention, retry after uncertain completion, and atomic state changes. A client-side disabled button cannot prevent double booking.
- **State machine:** reconcile the latest instructions, migrations and live constraints. Current persisted statuses are `pending`, `accepted`, `rejected`, `completed`, `cancelled`. The documented lifecycle also mentions `rated` and `archived`; verify how those are represented before changing code. Never add enum values merely to make that wording line up.
- **Actors:** only the barber accepts/rejects/completes; only the customer cancels their own pending booking; either participant can cancel an accepted booking. Exercise every allowed branch plus unauthorized, stale and terminal-state transitions. Verify the persisted result, not just a local toast.
- **Chat:** room membership tied to its booking, correct sender identity, one intended room per booking, nonempty bounded messages, deterministic ordering and pagination, duplicate suppression and explicit sent/pending/failed states. Inspect any booking-state limits on access; do not invent them. Preserve drafts and reconcile uncertain sends without claiming delivery.
- **Portfolio and reviews:** ownership, the six-image cap under concurrent inserts, upload/DB partial failure and orphan cleanup, valid ratings, correct booking participants, completed-booking eligibility and the intended review uniqueness. Verify aggregate ratings cannot be forged by clients.
- **Verification:** manual ID/license review, private bucket/object access, approved-only visibility, restricted reviewer actions and audit fields. No automatic biometrics/OCR feature is implied by improving engineering.

## Security, privacy and abuse resistance

Use a threat model specific to stranger-to-stranger services at home: outsider, unrelated customer, unrelated barber, malicious participant, expired session and admin. For each sensitive data class, map who may read/write it, at what booking/verification stage, and through which endpoint.

- Inspect exposed tables, views, RPCs, functions, Storage and Realtime independently. Check table grants and column protection as well as RLS `USING`/`WITH CHECK`, permissive policy composition, ownership reassignment, view security behavior, function execution grants, `SECURITY DEFINER` and safe `search_path`. Protect price/status/role/verification/reviewer fields from unauthorized writes.
- Build an authorization matrix with anonymous, owner, participant, unrelated authenticated user and admin rows; include read/insert/update/delete, RPC, object download and subscriptions. Run real authenticated positive and negative controls on synthetic fixtures. A privileged MCP SQL result or service-role request does **not** prove RLS works. An unexpected empty result also needs a valid positive control.
- Confirm verification images and home addresses cannot be obtained through public URLs, list operations, predictable object paths, signed-link leakage, verbose errors or cross-account caches. Bound signed-link lifetime. Validate upload type, size, ownership, overwrite/delete behavior and handling of sensitive metadata; inspect public portfolio files separately.
- Verify secure session/token storage appropriate to the installed Expo stack, transport security, auth redirect allowlists, deep-link input validation, least app permissions, and safe recovery behavior. Never trust a role in user-editable metadata. Evaluate mobile WebViews, web targets, CORS and web-specific injection only if present.
- Scan working tree, tracked history and relevant build artifacts/configuration for privileged keys, private credentials and leaked tokens using redacted tooling. Report file/commit identifiers and secret type, never the value. Distinguish public Supabase anon/publishable keys from `service_role`/secret keys. Check `.gitignore`; ensure private keys are absent from Expo public environment variables and shipped bundles.
- If a credential is actually exposed, treat it as compromised. Remove the leak, identify rotation/revocation and dependent deployment steps, and complete authorized containment; never assert that deleting the string repairs the exposure. Do not expose the key while proving it exists.
- Check practical abuse limits for auth, message floods, booking spam and uploads through the existing backend. Inspect logs/error boundaries for passwords, session tokens, exact home addresses, ID/license URLs and private chat content. Diagnostics should identify failures without collecting unnecessary personal data.
- Review dependency advisories, lockfile integrity, native permissions and CI secret exposure. Trace advisory relevance and reachable impact; do not dismiss a transitive issue or blindly run force upgrades. Check any applicable account deletion, retention, export, consent and store privacy requirements against current official sources when evaluating them; distinguish implementation gaps from legal conclusions.

Do not add analytics, monitoring vendors or new backend APIs automatically. Prefer existing Supabase diagnostics and local tools; bring a concrete proposal when an external dependency changes data handling or cost.

## Supabase integrity and future database health

Use live schema metadata and migration files together. Record environment/date and compare tables, columns/types, defaults, nullability, primary/foreign keys, uniqueness/check/exclusion constraints, indexes, policies, grants, functions, triggers, extensions, Storage settings and publication membership. Use bounded aggregate checks for duplicates, invalid states, orphans and drift before accessing individual records.

- Examine delete/update cascades, nullable relationships, money representation, timezone semantics, transaction boundaries, retry/idempotency behavior and concurrency guarantees. Preserve booking history when service/profile data changes. Put true invariants in the DB through the schema owner, not solely in app validation.
- Evaluate schema organization by data ownership, integrity and query usage. Do not rename/rebuild tables, normalize everything, add partitions or introduce abstractions just to make the database look tidy. Propose changes for demonstrated anomalies, maintenance cost or workload risk.
- Inspect security/performance advisors through available MCP tools and investigate findings. Advisor silence is not evidence of complete security. Use representative query plans, pagination, projections, RLS predicate/index behavior, join costs, N+1 calls and count queries; account for realistic data volume and write cost before adding indexes.
- Prefer `EXPLAIN` or existing statistics for live diagnosis. Reserve `EXPLAIN ANALYZE`, load tests and expensive probes for an appropriate test environment: they execute queries and can cause load or mutations. Do not disable RLS to improve a benchmark.
- Review migration ordering, local/live drift, type generation and compatibility with still-installed older mobile clients. Test fresh replay and upgrade from representative previous state in an isolated database. Do not rewrite an applied migration to conceal drift; use a reviewed forward migration and staged, reversible rollout where possible.
- For schema changes, have the schema owner document lock/backfill risk, batching, validation, backup/recovery and forward-fix or rollback strategy, with data preservation and deployment ordering. A migration prepared locally is not a live deployment.
- Assess measured growth risks: large message histories, image storage, connection/subscription counts, slow RLS filters, stale statistics, dead tuples and retry storms. Use expected workloads and documented limits; avoid pretending to predict every future issue.
- Confirm recoverability, backup/PITR availability for the actual plan, environment separation and a restore verification plan. Perform restore, reset, production backfill or destructive cleanup only on the authorized target. Never use production as a disposable test database.

## Realtime and resilience

For a missing update, inspect available Supabase Realtime logs first (`query_logs`/`get_logs` as actually exposed), then live publication membership, relevant replica identity, grants/RLS and client subscription state. Do not prescribe `REPLICA IDENTITY FULL` for every table; establish the event payload requirements and cost.

Exercise subscription readiness versus initial fetch, events arriving during fetch, duplicate/out-of-order events, reconnect and gap refetch, foreground/background changes, logout/unmount cleanup and token renewal. Test rapid mutations from both participants, optimistic rollback, permission denial, stale responses overwriting newer state and eventual reconciliation with server truth. Do not promise Realtime event delivery beyond what is verified.

Test slow, offline, interrupted and restored networks; bounded timeouts/retries/backoff; safe cancellation of async work; and uncertain server outcomes. Avoid automatic retries of non-idempotent writes without a proven strategy. Keep read caches usable without making false claims that pending operations succeeded. Coordinate visible offline/retry states with the UI peer.

## Measure smoothness and efficiency

Profile before optimizing, using production-like native release builds on representative devices, including a modest Android device where available. A web preview or debug emulator cannot establish release smoothness. Record app/commit, build mode, device/OS/refresh rate, dataset size, network conditions, cache state, scenario and sample count.

Measure cold/warm startup, first usable content, interaction latency, navigation transitions, scroll/list frame times, JS/UI stalls, peak/retained memory, image decoding/cache behavior, bundle/native binary size, request count/bytes, query latency, reconnect behavior and background resource use. Use distributions when samples support them; do not manufacture p95 from one run.

Define budgets from the existing baseline and target devices before making a claim. As a frame-budget reference, 60 Hz allows roughly 16.7 ms per frame and 120 Hz roughly 8.3 ms; an average alone can hide visible stalls. Trace long tasks, repeated renders, layout churn, oversized assets, unnecessary startup imports, unbounded list rendering, subscription leaks and redundant fetching. Optimize the measured bottleneck, then compare under equivalent conditions. Avoid automatic memoization, global cache replacement or adding a list/animation library without evidence.

The UI peer owns interaction/motion and component changes using the selected UI model; this skill supplies traces, budgets and regression checks. Record native metrics as not measured if hardware/builds are unavailable, and continue useful static and backend work.

## Meaningful validation

Discover current scripts first. The repository had `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, Jest/React Native Testing Library, and `.maestro/README.md` when this skill was created. Use the lockfile's package manager. Expo compatibility diagnostics are available through the documented `npx expo-doctor` and `npx expo install --check` workflows; inspect output and make dependency changes deliberately.

- Capture a baseline for the actual scope; separate pre-existing failures from regressions without ignoring either. Run targeted checks while repairing and relevant integration checks after. Do not rerun broad suites without a changed artifact, failure or unresolved concern.
- Add tests that exercise the failure and would fail for the broken behavior: state/actor transitions, slot boundaries, concurrency, authorization denials, retry reconciliation, query results and user-observable behavior. Avoid shallow snapshots, implementation-mirroring tests, coverage-percentage targets without risk rationale, and tests for trivial reversible text/style edits.
- Use integration tests against an isolated Supabase instance or approved test environment, with disposable synthetic users and deterministic fixtures. Supabase client tests and SQL/pgTAP tests answer different questions. Elevated setup credentials stay server-side and out of the mobile test bundle; assertions use the intended ordinary roles.
- Follow current Maestro house style, stable selectors, explicit session setup and bounded observable waits. Avoid arbitrary sleeps, credentials embedded in flows and retries that conceal broken behavior. Include pending creation, accept/reject/cancel, customer status delivery and two-way booking chat; add verification/discovery and other affected flows as relevant.
- Real multi-actor evidence matters: use independent customer/barber sessions and the required physical two-device gate. Mocks and manually refetching a status do not pass a Realtime test. Unavailable physical gates remain tracked environmental blockers for development and block the final Step 18 release gate.
- Validate affected native builds and app variants. Test process restart, expired auth, interrupted uploads, permissions denied, larger data, older installed client compatibility and edge dates when relevant. Confirm test cleanup only removes owned fixtures.

## Missing essentials and maintainability

For broad audit/release mode, map intended capabilities to routes/data paths, tests and founder operating procedures. Classify each gap as **confirmed defect**, **suspected risk needing evidence**, **missing current-phase essential**, **approved deferred capability**, or **optional improvement**. Rank by user harm, exploitability, data loss, core journey blockage and founder effort; describe concrete symptoms rather than accumulating speculative features.

Consider auth recovery, incomplete onboarding, empty discovery, unavailable barbers, booking cancellation/conflicts, chat failure recovery, manual verification rejection/resubmission, support/reporting, account/data lifecycle, offline recovery and founder operational handoffs. Assess existing implementation and real requirements before calling one missing. Engineering defects can be fixed within authorization; undefined business policy needs a concrete decision proposal.

Retain the known in-home safety, dispute resolution and refund/cancellation-fee policy gaps. Revisit them explicitly for Phase 2/3; do not silently implement live tracking, SOS, Stripe, subscriptions, push, AI recommendations, analytics, multi-currency or automated KYC as an audit repair.

Check module ownership, circular dependencies, duplicate business rules, generated types, dead/unreachable code and configuration drift. Refactor only where it reduces an observed defect risk or change cost. Prefer the smallest maintainable solution for two founders. Check CI reproduces meaningful gates, both app release identities/configurations are correct, and operational diagnostics/recovery steps are usable.

## Close with verifiable results

Record findings with severity, evidence, reproduction, expected/actual result, affected role/data, root cause, repair, regression proof, owner and status. Separate fixed items, verified nonissues, unresolved defects, untested hypotheses and product decisions. Keep the user's final response concise and link the durable report.

Update affected backlog sections, preserve unrelated edits, remove tasks only when their gate fully passes, and add the repository's `<!-- PROGRESS: ... -->` marker if interrupted. Run `npm run context:update` after source changes. Do not create a commit or deployment merely to finish the checklist.

Provide a gate table: correctness, tests, security, Supabase, native performance, integration and release, each **PASS / FAIL / BLOCKED / N/A** with evidence. PASS is scoped to completed checks; N/A needs a reason. Audit completion is different from application readiness. No overall release PASS while a required security, live DB, physical-device or unresolved blocking defect gate is open. Averages and successful unrelated checks cannot cancel a failed gate.

The final handoff states what changed, why, what ran and its result, what could not be checked, and the next concrete action. Never report an agent ran, a command passed, a migration deployed or the full codebase was reviewed unless the evidence supports that exact claim.

## Official references to consult when relevant

Read current documentation for the installed versions and the specific question; these links are entry points, not dependency pins or a requirement to browse them all on every run.

- [Supabase database tests](https://supabase.com/docs/guides/database/testing): client integration tests and SQL/pgTAP workflows.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): policy semantics and privileged-access caveats.
- [React Native performance](https://reactnative.dev/docs/performance): native performance diagnosis and release-build measurement.
- [Expo development tools](https://docs.expo.dev/develop/tools/): current compatibility diagnostics and native tooling.
