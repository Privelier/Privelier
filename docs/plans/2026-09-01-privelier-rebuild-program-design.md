# Privelier rebuild program design

Status: accepted by the authoritative 2026-09-01 execution specification; architecture gate approved with conditions.

## Chosen operating model

Three models were considered. A broad rewrite would move quickly at first but destroy the ability to attribute regressions, preserve approved decisions, or pass the mandatory one-feature pipeline. A release-only patch set would be smaller, but it would leave the known navigation split, database-authority gaps, incomplete authentication, accessibility gaps, and fake or placeholder surfaces intact. The chosen model is a gated rebuild program: freeze a reproducible baseline, stabilize evidence, then execute small feature slices in dependency order.

P00–P11 are portfolios. A portfolio may contain several independent feature runs, but a run may contain only one behavior-changing concern. Every run uses Plan, Design, Build, Validate, Secure, Integrate, and Release. Each stage has a stable ID in the execution ledger, explicit file ownership, a narrow validation command, and a recovery note. A failed gate reopens its owning task. Completed historical work is audited and reused; it is not rebuilt merely because the program is new.

The first safe path is P00 followed by P01. P02 begins only after deterministic tests exist. Database, authentication, navigation, foundations, role experiences, and performance then proceed in dependency order. P09 is a cross-application proof pass, P10 creates release candidates, and P11 independently reconciles the full diff and evidence. Production deployment remains a separate founder-approved action.

## Architecture and boundaries

The repository remains one React Native and Expo codebase with one Supabase backend. Customer and Barber become separate application roots, navigation trees, branded entry contexts, and eventually separate build variants. Shared code is limited to stable foundations, types, data utilities, and explicitly approved primitives; role UI and navigation do not cross-import. The database role remains the sole routing authority after initial provisioning. APP_VARIANT may guide onboarding but never authorization.

Supabase remains the only backend. Schema changes are forward-only migrations owned by the schema-architect role, tested locally with pgTAP and adversarial actor cases before any hosted action. Booking creation becomes one atomic server-owned operation covering approval, service ownership, snapshots, future time, availability and exceptions, complete interval overlap, concurrency, idempotency, and actor transitions. The old naive-local-time design conflicts with the new UTC/IANA target; that conversion is isolated behind a founder decision rather than guessed.

Authentication providers converge on the existing session-driven provisioning state machine. Google and Apple implementation begins from the approved PKCE design, then is reconciled with current primary documentation and installed Expo/Supabase versions. Manual barber verification remains independent of provider and cannot be bypassed. OAuth Server and the internal admin app stay out of scope.

## Failure, security, and recovery model

The execution ledger is the durable machine-readable-by-humans checkpoint. Only one atomic task is in progress per writing agent. Before editing, the ledger records intended files, validation, and recovery. After editing, the narrow check runs, evidence is indexed, and status changes only when acceptance criteria pass. The handoff always names the exact next command, working-tree state, affected files, failures, blockers, and last known-good checkpoint.

Sensitive evidence is minimized. The repository commits only redacted summaries and cryptographic hashes. Bulky evidence lives in the exact ignored artifacts path. No service-role credential, provider secret, Mapbox download token, signed log URL, personal data, exact address, message, or identity document may be retained. A discovered credential is rotated; deletion from the latest tree is not treated as remediation.

Live Supabase access is read-only during reconnaissance. Hosted migrations, data writes, provider configuration, EAS identity changes, store operations, paid services, and production deployment each retain their explicit approval gates. Independent work continues around external blockers. The only terminal release outcomes are repository_complete_release_blocked or release_ready; a missing device, provider credential, policy decision, or live authorization cannot be reported as passed.

## Test and release strategy

Evidence begins with a warning-free deterministic unit/component baseline. Each feature adds pure logic tests, screen/mutation integration tests, database allow/deny and concurrency tests where relevant, and a Maestro flow for critical user behavior. Realtime features additionally prove duplicate delivery, reconnect resync, optimistic rollback, teardown, and two-device behavior. Accessibility is validated with VoiceOver and TalkBack, large text, reduced motion, keyboard, theme, and representative window sizes.

Performance is measured in release builds before optimization. Startup, Home load, appointment open, booking submit, chat send, list responsiveness, memory, network calls, and bundle composition receive reproducible scenarios and no-regression budgets. P10 builds clean Android and iOS candidates from the same tested commit in a production-like staging environment. P11 runs independent code and security reviews, reconciles every inventory item, repeats the clean-checkout gates, and produces the founder release decision with exact residual risks and next actions.

