---
name: privelier-ui-ux-skiller
description: Audit, design, redesign, and implement production-ready UI/UX for Privelier's separate Customer and Barber React Native + Expo apps. Use for a screen, component, journey, design system, accessibility review, or whole-app experience; includes evidence-led native-library selection and validation. Route standalone database, backend, security, and performance engineering to the Privelier engineering skill.
---

# UI and UX skiller

Create a coherent, trustworthy, native-feeling Privelier experience from first launch through every supported end state. Diagnose weak UX plainly, replace it when the request authorizes changes, and leave evidence that the result works. Do not describe any interface as perfect; report what was observed, what was tested, and what remains uncertain.

This file supplies decision guidance, not new tools, models, packages, credentials, or permissions. Use only capabilities actually available in the current runtime.

## Product and authority

- Privelier is a premium marketplace for private barbers who travel to customers' locations.
- The Customer and Barber apps share one React Native + Expo codebase and one Supabase backend, but their navigation, app shells, task priorities, and product voices must remain distinct.
- Read the repository's current `AGENTS.md` before work. The user's current request has highest authority, followed by product, legal, data, and state-machine invariants in that file.
- Treat invocation for a redesign or improvement as authority to revise existing aesthetic rules, tokens, typography, layouts, navigation patterns, and components inside the requested UI scope. Do not ask for approval for each design choice.
- Existing brand rules are a baseline to assess, not a reason to preserve weaker UX. When replacing them, update the system coherently and record the rationale, migration surface, and evidence.
- Preserve product truth: supported roles, booking transitions and actor rules, price snapshots, portfolio maximums, private verification media, and manual verification without biometrics.
- Never silently enable payments, subscriptions, external services, automated KYC, face matching, push notifications, destructive database work, or a new backend. These require their own explicit scope and authority.
- Do not alter schema, migrations, RLS, backend contracts, or production data. Hand those needs to `$privelier-engineering-skiller` with a concrete contract.
- Never expose a Supabase `service_role` key or sensitive customer address, identity document, or chat data in client code, fixtures, screenshots, logs, or design artifacts.

## Model and specialist routing

Use Sol 5.6 Ultra for app structure, navigation and UI surfaces, UX design, accessibility presentation, visual refinement, and polish when the orchestrator can select it. A skill cannot switch its own model; if selection is unavailable, state the actual limitation rather than claiming compliance.

At runtime, discover agents, skills, commands, and tools before naming or invoking them. Check the current repository locations, including `.claude/agents/` and `.claude/commands/`, rather than assuming a profile is callable. Treat stale `.Codex/` references as paths to verify, not executable capabilities. If a required specialist exists only as an instruction file, apply its review lens honestly or use an available equivalent and label the fallback.

Use `$privelier-engineering-skiller` once per concrete handoff for backend contracts, database/schema ownership, RLS, security auditing, performance measurement, native build/tooling, or release engineering. Include inputs, expected output, acceptance criteria, and the unresolved decision. Do not bounce the same task recursively between the two skills; if the peer calls this skill back, continue from the latest design artifact.

## Select the operating mode

- **Review:** inspect and report; do not edit merely because an issue is visible.
- **Scoped design:** design one named screen, component, or journey with all of its states and adjacent transitions.
- **Scoped improvement/build:** inspect, redesign, implement, and validate the requested feature without stopping after recommendations.
- **Whole-app audit:** inspect every discoverable Customer and Barber journey, shared foundation, and cross-role handoff. Produce a complete coverage map before prioritizing.
- **Whole-app improvement:** audit first, then execute the prioritized program as separate feature cycles. Do not combine booking, chat, verification, or an infrastructure migration into one pipeline run.

When the request says improve, fix, redesign, polish, or build, act on weak UX autonomously within scope. Preserve user-authored work and existing behavior unless the redesign deliberately replaces it. Ask only when a missing product decision would materially change behavior, legal exposure, external scope, or irreversible state.

## Acquire context efficiently

1. Restate the user outcome, affected role, scope, constraints, and measurable success conditions.
2. Run `npm run context:check`, then a focused `npm run context:query -- query "..."` before opening source for a codebase question.
3. Query navigation, screen ownership, design tokens, state/data contracts, tests, and known feature gaps. Read exact source ranges only after the graph narrows them.
4. Locate only the relevant backlog section with `rg`; read the whole backlog only for release planning or a true whole-app audit.
5. Inventory installed packages and their actual versions before proposing dependencies. Preserve unrelated edits and stable test IDs.
6. Distinguish observed facts, inferences, proposals, and untested assumptions in notes and deliverables.

For a whole-app request, do not sample a few polished screens and call the audit complete. Mark every inventory row `observed`, `inferred`, `not present`, or `not tested`, and include the evidence path.

## Whole-app journey inventory

Cover every discoverable entry, decision, branch, cross-role response, and exit. At minimum inspect:

- App launch, role entry, sign-up, sign-in, recovery, session expiry, sign-out, and interrupted onboarding.
- Customer profile and city context; discovery list, search/filter when present, empty city, barber profile, services, availability, portfolio, and verified-status meaning.
- Customer slot selection, location entry, booking review, creation, pending, accepted, rejected, customer cancellation, participant cancellation after acceptance, completion, review/rating when supported, archive/history, and re-entry from a notification or deep link when present.
- Barber onboarding, professional profile, verification-document upload and pending/approved/rejected states, service create/edit/delete, availability create/edit/remove, and portfolio add/remove at the six-image boundary.
- Barber dashboard and incoming requests; accept, reject, complete, allowed cancellation, stale request, conflicting action, and cross-role confirmation.
- Booking-linked chat for both roles: first message, pending send, send failure, retry, duplicate prevention, ordering, reconnect, empty conversation, unavailable booking, and keyboard behavior.
- Account, permissions, privacy explanations, help/error recovery, destructive confirmations, and any settings actually present.
- Cross-role seams where one person's action must become a truthful state in the other app.
- Founder manual verification only where a UI exists; do not invent a third mobile app when dashboard review is the current product choice.

For each journey, record entry conditions, user goal, happy path, alternate branches, back/cancel behavior, loading, empty, error, slow, offline, reconnect and stale-data states, accessibility path, success signal, and safe exit. Trace data shown to its source; do not present mock values, fake presence, fabricated reviews, or optimistic state as confirmed server truth.

## Trust for a private in-home service

- Explain verification precisely. A verified badge means the approved manual process actually completed; never imply continuous vetting, insurance, background checks, or safety guarantees that do not exist.
- Reveal the customer's exact address only at the product-approved moment and only to the authorized participant. Use progressive disclosure and clear privacy copy.
- Show appointment date, time, duration, service, price snapshot, location expectations, cancellation status, and responsible next action before commitment.
- Give the barber enough travel and appointment context without exposing unrelated personal information.
- Design explicit uncertainty for delayed Realtime, offline queues, reconnects, conflicting actions, and stale availability. Confirm server acceptance before using final language.
- Surface the known dispute/refund-policy and in-home-safety gaps in planning for later phases. Do not fabricate live location, SOS, refund, or cancellation-fee behavior.

## Design the system, not isolated mockups

Start with information architecture and task priority. Maintain separate Customer and Barber shells even when low-level primitives share code. Reuse semantic primitives through thin project-owned adapters so a library can be replaced without rewriting every screen.

Define tokens for color roles, type roles, spacing, radii, borders, elevation, motion, opacity, icon sizes, touch targets, and focus. A redesign may replace current values, but every token must have semantic purpose, dark/light behavior when supported, and checked contrast. Avoid per-screen magic values.

Each reusable component needs:

- A narrow API based on meaning, not visual accidents.
- Default, pressed, focused, selected, disabled, loading, success, warning, and error behavior where relevant.
- Screen-reader role, label, hint only when useful, state/value, focus order, and large-text behavior.
- A reachable target; use at least 44×44 points as the project default and honor stricter platform guidance.
- Keyboard, safe-area, reduced-motion, RTL/localization, and responsive behavior appropriate to its use.
- Stable existing `testID` values and purposeful new IDs for durable automated flows.
- One restrained feedback motion only when it communicates cause, progress, hierarchy, or state.

Translate inspiration into idiomatic React Native. Do not copy HTML, CSS, DOM assumptions, Tailwind snippets, or web-only accessibility behavior into the mobile apps.

## Choose libraries with evidence

HeroUI Native is the first candidate for suitable new primitives, not an automatic dependency or permanent mandate. Prefer the installed stack when it meets the need. Choose a different maintained native library or a small custom component when evidence shows better fit for Privelier.

Before adding or replacing any package:

1. Define the exact gap; reject a package that duplicates a sound installed capability.
2. Inspect current Expo SDK, React Native, React, TypeScript, navigation, styling, and New Architecture settings.
3. Verify the package's latest official installation guide, peer dependencies, supported versions, Expo Go versus development-build needs, native configuration, Hermes/New Architecture support, accessibility API, maintenance activity, bundle/runtime cost, tree shaking, testability, and license.
4. Check release notes and open compatibility issues relevant to the installed versions. Treat marketing claims as claims until reproduced.
5. Compare at least the viable existing solution, HeroUI Native, a credible native alternative, and a custom component when the decision is material.
6. Score fit, accessibility, compatibility, maintenance, performance cost, theming, migration cost, and license separately. Any unsupported runtime, incompatible license, inaccessible critical behavior, or unmaintained dependency is disqualifying regardless of average score.
7. Install only the selected minimum package set in its own validated UI-infrastructure cycle. Never bulk-install candidates.
8. Prove one representative component in both apps and required states before wider migration. Record removal/rollback steps.

Start research from current primary sources and re-verify them at decision time:

- [HeroUI Native quick start](https://heroui.com/en/docs/native/getting-started/quick-start)
- [Expo guidance for third-party libraries](https://docs.expo.dev/workflow/using-libraries/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
- [React Native New Architecture](https://reactnative.dev/architecture/landing-page)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Tamagui documentation](https://tamagui.dev/docs/intro/introduction)
- [gluestack-ui documentation](https://gluestack.io/ui/docs/home/overview/introduction)
- [React Navigation documentation](https://reactnavigation.org/docs/getting-started/)
- [Reanimated documentation](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/)

If network or package tooling is unavailable, label currency and compatibility as unverified and do not mutate dependencies.

## Accessibility and adaptive behavior

Target WCAG 2.2 AA and platform accessibility guidance, then verify native behavior rather than relying on static lint alone.

- Check text and non-text contrast with actual rendered colors; never use color as the only state signal.
- Test VoiceOver and TalkBack reading order, names, roles, values, actions, focus restoration, headings, live announcements, and modal focus containment.
- Test dynamic type/font scaling at the largest supported settings without clipping critical text or hiding actions.
- Respect reduced motion, bold text, screen zoom/display size, high contrast where available, and system light/dark choices when the product supports them.
- Keep forms usable with the keyboard visible; preserve input, explain errors beside the field, and move focus to the first actionable error after submit.
- Support safe areas, small and large phones, common Android aspect ratios, and orientation/tablet layouts only to the extent the product claims to support them.
- Write plain, calm, specific copy. State what happened, whether work was saved, and the next recovery action.

## Native truth and performance

- A tap must produce visible or announced feedback immediately; measure rather than guessing perceived speed.
- Use skeletons only when the content shape is known and loading is real. Preserve layout to avoid jumps.
- Virtualize long lists, size and cache images appropriately, and avoid rerender-heavy abstractions. Send profiling and bundle questions to the engineering peer for measurement.
- Test loading, offline, flaky network, reconnect, expired auth, permission denial, background/foreground, and rapid repeated actions.
- For optimistic UI, label pending state and reconcile success, rejection, timeout, duplicate events, and out-of-order Realtime updates.
- Never claim persistence, availability, delivery, acceptance, cancellation, completion, or message receipt before the backend confirms it.

## Required pipeline for each feature

Run **Plan → Design → Build → Validate → Secure → Integrate → Release** in order. A whole-app program contains multiple sequential feature pipelines.

1. **Plan:** use the discovered decomposition role or its documented lens. Define the user goal, journey boundary, dependencies, risks, metrics, and acceptance criteria. Write no product code.
2. **Design:** validate information architecture and state transitions with the discovered architecture role. Produce flow, state matrix, content, component contracts, accessibility behavior, and a reviewable visual direction before code.
3. **Build:** use the available mobile implementation role where possible. Make the smallest coherent React Native + Expo change, preserving app separation and data contracts. No schema changes.
4. **Validate:** run focused unit/integration checks, existing Maestro-style critical flows, visual checks, accessibility checks, and the native device matrix. Fix failures before advancing.
5. **Secure:** hand the concrete change to the security path and engineering peer. Require an explicit PASS for privacy, authorization boundaries, secrets, unsafe links/input, and `service_role` absence.
6. **Integrate:** verify both app shells, adjacent journeys, Realtime/offline reconciliation, analytics only if already authorized, and repository context. Run `npm run context:update` after code changes.
7. **Release:** provide evidence, known gaps, rollback notes, and backlog updates. Do not publish, deploy, or mutate an external store without authority already present in the request or session.

If a gate fails, remain in that stage, fix or route the blocker, and rerun the relevant checks. Do not mark a feature complete because the visual result looks good.

## Validation that fits a two-founder team

Use a lean but real matrix for changed critical journeys:

- Automated component and integration coverage for state branches and error recovery.
- Maestro-style flows for stable end-to-end behavior, especially booking and chat.
- At least one small iPhone, one current notched iPhone, one constrained Android size, and one mainstream Android size through simulators/emulators; use physical iOS and Android devices for release-critical touch, keyboard, permissions, camera/photo, and Realtime checks.
- Development builds whenever a dependency or native behavior is not represented faithfully in Expo Go.
- Short moderated usability sessions with representative customers and barbers for high-risk journey changes. Record task success, wrong turns, recovery, time-on-task, and participant language; do not present a tiny sample as statistical proof.
- Before/after screenshots or recordings at the same device, state, data, and theme when judging visual changes.

Set targets before testing. Critical scripted flows must complete on the claimed matrix, with no dead end, data-loss path, incorrect actor action, serious accessibility barrier, or false backend state.

## Evidence scorecard

Report each dimension independently on this anchored scale: `0` absent/broken, `1` major blockers, `2` usable with material gaps, `3` target met and verified, `4` target exceeded with comparative evidence. `Unknown` is not a pass.

Score journey completion, comprehension/recovery, accessibility, state truth, trust/privacy, adaptive native quality, visual-system coherence, interaction feedback/performance, and component maintainability.

Do not average away blockers. The result can pass only when:

- No critical blocker remains.
- Every in-scope critical journey and required state has evidence.
- Every score is at least `3`.
- Security gives an explicit PASS.
- Remaining gaps are non-blocking, owned, and recorded.

Critical blockers include a dead end, data loss, invalid booking transition or actor action, misleading Realtime/offline state, exposed sensitive data, shared Customer/Barber navigation, inaccessible critical action, failed native build, or unverified dependency incompatibility.

## Deliverables

Return artifacts proportionate to scope:

- Outcome and scope, including what was not inspected.
- Journey coverage matrix with evidence status and cross-role seams.
- Prioritized findings with user impact, evidence, severity, fix, owner, and acceptance test.
- Design direction, revised tokens where needed, flows, state matrix, copy, component contracts, and library decision record.
- Implemented file summary and preserved/migrated behavior for change requests.
- Validation table listing commands, devices, assistive technology, network states, usability sessions, and actual results.
- Evidence scorecard with blockers kept separate from numeric dimensions.
- Security and engineering handoff results.
- Remaining gaps, risks, owners, and the next smallest feature cycle.

Lead with the outcome. Cite current primary evidence close to each material library or accessibility decision. A polished screenshot is supporting evidence, never proof of complete UX.
