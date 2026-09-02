# Privelier rebuild completion checklist

Last reviewed: 2026-09-02

This checklist summarizes the work proven against the P00–P11 rebuild program. A checked item means repository evidence exists; an unchecked item remains open or externally blocked. It is a status view, not permission to skip the mandatory Plan → Design → Build → Validate → Secure → Integrate → Release pipeline.

Authoritative source: [privelier-codex-master-rebuild-prompt.json](./privelier-codex-master-rebuild-prompt.json). Detailed historical progress remains in [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md), and the [evidence index](./PRIVELIER_EVIDENCE_INDEX.md).

## Completed or proven

- [x] Repository instructions and approved design records were inventoried; graphify was queried before codebase inspection.
- [x] Supabase project connectivity, live tables, migration ledger, RLS status, and database advisors were checked through the Supabase MCP.
- [x] Customer and Barber role roots, separate navigation trees, auth provisioning, discovery, profiles, services, availability, bookings, requests, portfolio, verification, chat, reviews, and location surfaces exist in the app code.
- [x] Server-owned booking price stamping and service/barber ownership checks are live.
- [x] Booking validation migrations 0024–0028 are live: future time, active availability containment, duration snapshots, duration-aware overlap rejection, per-barber/date concurrency serialization, optimized availability indexes, and booking INSERT RLS reconciliation.
- [x] Busy-slot reads use the immutable booking duration snapshot.
- [x] The authoritative booking state machine and actor-aware transition checks remain intact.
- [x] Authenticated rollback-safe probes passed for valid, past, outside-window, overlapping, back-to-back, cross-customer, direct-status, barber-role, and duration-mutation cases.
- [x] Booking validation contract SQL and realtime duration-equality regression coverage were added.
- [x] TypeScript, lint, full Jest suite (550 tests), and targeted booking tests (26 tests) passed.
- [x] Booking-validation security gate passed; no service-role credential exists in client code or git history.
- [x] Booking changes were committed and pushed in commit `5cd75bf`.
- [x] The Ultra UI pass is code-complete across the recorded increments; shared primitives, brand mark, customer surfaces, barber surfaces, booking, reviews, location, and accessibility treatments were applied without new dependencies.
- [x] Android development build and EAS project configuration have been recorded; Maestro flows have been authored in the repository.

## Still open or externally blocked

- [ ] P00 baseline closure: clean-checkout reproducibility, complete inventory reconciliation, canonical plan/handoff artifacts, and remote-only waitlist migration drift remain to be reconciled.
- [ ] P01 warning-free baseline: fix the known React test `act()`/cross-suite warning behavior and triage the recorded npm advisories without unsafe forced upgrades.
- [ ] P02 database completion: resolve the rebuild program's UTC/IANA timezone decision, availability-closure/exception semantics, idempotency/concurrency test evidence, and any remaining database advisor findings.
- [ ] P03 Google/Apple provider implementation and real-device provider tests remain founder/provider-console dependent.
- [ ] P04 final navigation information-architecture consolidation and role-variant release design remain unfinished.
- [ ] P05–P07 founder on-device visual review remains open across both apps, themes, typography, accessibility sizes, and all major states.
- [ ] P08 release-mode performance, memory, network, bundle, offline, and reconnect budgets have not been fully measured and recorded.
- [ ] P09 Maestro CLI execution, two-device Realtime/chat verification, TalkBack/VoiceOver checks, and the full screenshot/Appshot matrix remain open.
- [ ] P10 clean Android and iOS release candidates, CI/EAS gates, store metadata, signing, and production-like staging checks remain open; production deployment is separately approval-gated.
- [ ] P11 final independent full-program audit and release decision remain open until the preceding items are closed.
- [ ] Deferred by policy: Stripe/payments, subscriptions, AI recommendations, push notifications, automated KYC/biometrics, multi-country/multi-currency logic, OAuth Server, internal admin app, dispute/refund policy, and in-home safety features.

## Current outcome

`repository_complete_release_blocked`: the repository contains substantial completed implementation and tested booking hardening, but the rebuild program is not yet `release_ready` because device, provider, baseline-warning, performance, and final release gates remain open.
