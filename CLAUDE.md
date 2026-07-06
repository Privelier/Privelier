# CLAUDE.md — Project: Private Barber (working title)

This file is the authoritative project context. Read it fully before doing any work. Do not deviate from anything marked "authoritative" without explicit approval from the founders.

## Role and operating principle

You are acting as a senior full-stack engineer and architect for a two-person student founding team building a real product, not a demo. Do not blindly execute instructions — if something is legally risky, unrealistic for a two-person team, or a worse architectural choice than an alternative, say so and propose the better option before building. Work in small, tested increments, in the exact order defined in "Build order" below. Never skip the orchestration pipeline for any feature, no matter how small it looks.

## Product

An on-demand marketplace where customers book independent private barbers who travel to the customer's own location. Positioning: premium, private, trustworthy — not a generic barber-booking app, not a barber-pole aesthetic. Two completely separate mobile apps (Customer app, Barber app) sharing one Supabase backend. They must never share UI or navigation.

## Tech stack

- Frontend: React Native + Expo. One codebase, two separately branded and separately navigated apps (Customer, Barber).
- Backend: Supabase — Postgres, Auth, Storage, Realtime, Row Level Security. No self-managed servers.
- Payments: Stripe Connect — Phase 2 only, not in the initial build.
- Do not introduce any other backend service, database, or third-party API without explicit founder approval.
- The `database/supabase` MCP server is connected — use it for direct, live read/write access to the actual Supabase project instead of asking the founders to paste schema or data manually.
- The `react-native-best-practices` skill (Callstack, official) is installed and should be applied automatically to all React Native/Expo code — performance, Hermes, bundle size, native module patterns.
- The `maestro-mobile-testing` skill (tovimx) is installed for E2E testing — use it for all end-to-end test writing, especially anything involving optimistic UI updates (status changes before the server confirms) and auth-gated screens, where flaky tests are most likely.

## Secrets and environment hygiene (authoritative — read before touching any Supabase key)

Supabase gives you two keys: the `anon` key (public, safe to ship inside the mobile app) and the `service_role` key (bypasses Row Level Security entirely — treat it like a master password). The `service_role` key must never appear in any React Native/Expo code, never be committed to GitHub, and never be used client-side under any circumstance. It only belongs in a server-side context (an Edge Function, if one is ever needed) and in environment variables that are gitignored. Before the first commit, confirm `.env` and any file containing keys is listed in `.gitignore`. If a key is ever accidentally committed, treat it as compromised and rotate it immediately in the Supabase dashboard — do not just delete the file from a later commit.

## Brand identity (authoritative — apply to every screen)

**Dark mode (default):** background `#121214`, card surface `#1B1B1E`, primary text `#F5F1E8`, secondary/muted text `#9A968C`, accent (brass) `#BFA06B` used sparingly — buttons, star ratings, verified badges, active states only, never as a large fill. Success `#51785C`, error `#A8453E`.

**Light mode:** background `#F8F4EC`, card surface `#FFFFFF` with a thin `#E6DFD0` border, primary text `#211D17`, secondary text `#8A8175`, accent text uses the darker `#8A6B3D` for contrast (fills/icons can still use `#BFA06B`). Success `#4F7355`, error `#A8453E`.

**Typography:** an editorial serif for headings, a clean sans-serif for body text. Sentence case, never all-caps or Title Case.

**Layout:** flat design — no gradients, no heavy drop shadows. Thin 0.5px borders/dividers. Generous whitespace. Calm, minimal, never cluttered.

## Roles

- **Customer** — browses barbers, books services, chats, rates after a completed booking.
- **Barber** — professional profile, sets prices and availability, accepts/declines bookings, uploads a portfolio (max 6 images).
- **Admin (the two founders)** — manually verifies barbers, handles disputes, approves/rejects accounts. Not a separate app — direct Supabase dashboard access is sufficient for Phase 1.

## Database schema (authoritative — only `supabase-schema-architect` may modify this)

- **USERS**: id, name, email, phone, role (customer/barber/admin), city, country, profile_image, created_at
- **BARBER_PROFILE**: id, user_id, bio, rating, verified (boolean), verification_status (pending/approved/rejected)
- **SERVICES**: id, barber_id, name, price, duration_minutes
- **AVAILABILITY**: id, barber_id, day_of_week (or specific_date), start_time, end_time
- **BOOKINGS**: id, customer_id, barber_id, service_id, date, time, location, price (snapshot of the service price at the moment of booking — never read live from SERVICES), status (pending/accepted/rejected/completed/cancelled), created_at — Realtime enabled on this table
- **CHAT_ROOMS**: id, booking_id, customer_id, barber_id
- **MESSAGES**: id, chat_id, sender_id, message, created_at — Realtime enabled on this table
- **PORTFOLIO**: id, barber_id, image_url — hard constraint: max 6 rows per barber_id
- **REVIEWS**: id, booking_id, customer_id, barber_id, rating, comment — only allowed if the linked booking's status is "completed"
- **VERIFICATION_REQUESTS**: id, user_id, id_image_url, license_image_url, status (pending/approved/rejected), reviewed_by, reviewed_at — no selfie field, no biometric data of any kind

## Booking state machine (authoritative — branching, not linear)

```
pending   → accepted   → completed → rated → archived
pending   → rejected
accepted  → cancelled
```

No other states exist. Every screen, query, and agent must respect exactly this branching.

## Verification — manual only, no exceptions in Phase 1–2

Do not build any OCR or face-match service. No `face_recognition`, no selfie capture, no biometric processing of any kind — this is a deliberate decision made for legal/liability reasons (GDPR Article 9 special-category data), not an oversight. Flow: barber uploads ID photo + license photo → a founder reviews manually via the Supabase dashboard or a simple admin view → sets `verification_status` → barber appears in customer search only once `approved`. ID/license images live in a **private** Supabase Storage bucket, never public.

## MVP scope

**Build now:** auth for customer and barber roles, city-based barber discovery, barber profile pages, service creation, availability management, the booking flow end to end, realtime status updates, simple text chat attached to a booking, barber dashboard, portfolio upload (max 6), manual verification.

**Do not build yet, under any circumstance, without explicit founder sign-off:** payments/Stripe, subscriptions, AI-based recommendations, advanced analytics, multi-country/multi-currency logic, automated KYC or biometrics, push notifications.

**Deferred but tracked — do not let these silently disappear from scope:** a dispute resolution and refund/cancellation-fee policy (currently undefined — needed before real money moves in Phase 2), and in-home safety features for the barber-travels-to-you model (live location sharing during the appointment window, an SOS button) — flagged early as the single highest-liability part of this product if skipped indefinitely. Revisit both explicitly when planning Phase 2/3, do not assume they're solved.

## Build order

Work through these in order. Do not start a step before the previous one's test has passed.

1. Create the Supabase project and the Expo project; connect them.
2. Build the database tables listed above in Supabase.
3. **Test:** all tables exist and are visible in the Supabase dashboard.
4. Build the "Continue as Customer / Continue as Barber" screen.
5. Build customer signup and barber signup.
6. **Test:** one fake customer and one fake barber sign up successfully and appear in the database.
7. Build the barber's "add a service" screen and the availability screen.
8. **Test:** a service and an availability window are saved correctly.
9. Build the customer home screen (barber list by city).
10. **Test:** the test barber appears for the test customer.
11. Build the booking flow, sourcing available time slots from the barber's availability.
12. **Test:** a booking is created with status "pending".
13. Build the barber's incoming-requests screen with accept/reject.
14. **Test:** accepting updates the booking status instantly on the customer's side via Realtime.
15. Build simple text chat tied to a booking.
16. **Test:** messages send and receive correctly in both directions.
17. Build the manual verification admin flow.
18. Run the full flow end to end with real test users before moving to Phase 2.

## Orchestration pipeline (mandatory for every single feature, no exceptions)

Every feature passes through this exact sequence: **Plan → Design → Build → Validate → Secure → Integrate → Release.** Never combine more than one feature into the same build cycle — booking, chat, and verification are each their own pipeline run.

1. Use the `task-decomposition-expert` agent to break the feature into subtasks. No code is written at this stage.
2. Use the `architect-review` agent to validate the proposed design against the schema and state machine above.
3. If a schema change is genuinely required, only the `supabase-schema-architect` agent makes it, then run the `/supabase-schema-sync` slash command to push it live.
4. Use the `fullstack-developer` agent to build backend/API logic. No schema changes are allowed at this stage. For any feature involving Realtime (booking status updates, chat), also bring in the `supabase-realtime-optimizer` agent.
5. Use the `mobile-developer` agent to build the screens, applying the `react-native-best-practices` skill.
6. Use the `ui-ux-designer` agent (or the `ui-ux-pro-max` skill) to polish the UI against the brand identity section above.
7. Use the `test-engineer` agent for unit/integration tests, and the `maestro-mobile-testing` skill for E2E tests — the booking accept/reject flow and the chat flow are the highest priority for E2E coverage, since they involve realtime/optimistic UI updates where flakiness is most likely.
8. Use the `security-auditor` agent and run `/security-audit` plus `/supabase-security-audit`. This is the final gate — nothing is considered done without an explicit PASS. This check must also confirm no `service_role` key is present anywhere in client code.
9. If anything breaks at any stage, use the `debugger` agent. For Realtime-specific issues (a status or message not arriving live), use the `/supabase-realtime-monitor` command first; for general data questions during debugging, use `/supabase-data-explorer` instead of switching to the Supabase dashboard.
10. Once built and tested, use `database-optimizer` to check query performance and `context-manager` to confirm correct integration with everything already built, before starting the next feature.

**Important distinction:** everything in `.claude/agents/` is a subagent, invoked by describing the task in plain language — these are not slash commands. Only files actually present in `.claude/commands/` (for example `supabase-schema-sync`, `security-audit`, `generate-tests`) work as real `/slash-commands`. Skills (`react-native-best-practices`, `maestro-mobile-testing`) activate automatically when relevant or can be invoked directly.

## Hard rules

- Schema is sacred — only `supabase-schema-architect` touches it, ever.
- Security is the final, non-optional gate before any feature is considered complete, and explicitly includes a check that no `service_role` key has leaked into client code or git history.
- One feature per pipeline run. Never mix booking, chat, and verification work in a single cycle.
- Never skip task decomposition, even for changes that look small.
- No biometric or automated identity processing — manual verification only, until explicitly revisited in a later phase.
- Stay inside the MVP scope above. If asked to build something in the "do not build yet" list, flag it and wait for explicit confirmation rather than building it.
- Dispute resolution, refund policy, and in-home safety features are known open gaps, not solved problems — do not silently build around them as if they don't exist; surface them again when Phase 2 planning starts.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Tasks (living backlog — maintained by Claude, read this every session)

Maintenance protocol (authoritative):
- This section lists every task still needed to build the app, in execution order. It is the single source of truth for "what's left".
- When a task is fully done (its test/gate passed), DELETE its line from this section in the same session — do not leave completed tasks behind.
- If a session is interrupted (session limit, crash, abandoned work), do NOT delete the task — append a short status comment beside it in the form `<!-- PROGRESS: what is done, what remains, where to resume -->`.
- When new work is discovered mid-feature (bugs, review findings, follow-ups), add it here as a task rather than keeping it only in conversation.
- Every feature task below still goes through the full orchestration pipeline (Plan → Design → Build → Validate → Secure → Integrate → Release). This list tracks WHAT is left, not a license to skip HOW.

### Step 5 — auth & signup (in progress)
- [ ] Stage 6 — test-engineer <!-- PROGRESS (2026-07-05, commit 29d84b4): DONE: jest-expo + testing-library infra added, 81 unit/integration tests all passing (authService error mapping + full idempotent insert-sequencing incl. 23505-as-success-of-other-writer on both users and barber_profile, errors.ts table-driven, useAuthShell phase transitions + remount-stability). tsc+eslint clean. Two Maestro flows authored (login->provisioning->role-landing, signup->await-confirmation->resend) but UNEXECUTED — this dev machine has no Maestro CLI and no Android SDK/emulator. REMAINS: (1) install Maestro CLI + get an emulator/device, (2) set a real android.package/ios.bundleIdentifier in app.json (flows currently use placeholder appId com.privelier.app) and rebuild a dev client, (3) run the two authored flows and fix whatever breaks, (4) author + run the duplicate-email and app-kill-mid-provisioning flows (deferred on purpose until the first two run once), (5) the step-6 DB gate itself: one fake customer + one fake barber sign up and appear in public.users (+barber_profile) — needs the running app, confirm test users via dashboard or a local gitignored admin script, never service_role in repo. UPDATE (2026-07-06): item (2) is now DONE — app.json sets ios.bundleIdentifier and android.package to com.privelier.app, matching every Maestro flow's placeholder appId, no file changes needed there anymore. Trigger was the founder's Expo Go app (App Store latest) rejecting the project as requiring a newer Expo Go than exists yet — SDK 57 outpacing Expo Go's published support, not a project bug. Fix in progress: eas.json (dev/preview/internal, preview/production profiles) + an EAS projectId in app.json were already present un committed at session start (prior session's work), eas-cli 20.5.1 confirmed installed and logged in (aatt / privelier@outlook.com) matching eas.json's pinned version. Founder is running `eas build --profile development --platform ios` themselves (interactive Apple login/device registration, can't run from this sandboxed shell) — once that dev client is installed on the iPhone, this ALSO resolves item (1)'s device half (still need Maestro CLI installed + `maestro test` pointed at the same device once the dev client exists). Do not re-derive the bundleIdentifier work if resuming — check app.json first. -->
- [ ] EAS development-client build: founder is running `eas build --profile development --platform ios` from their own terminal (2026-07-06) to get an installable dev client onto their iPhone, since Expo Go's App Store build doesn't support SDK 57 yet. Once installed, use `expo start --dev-client` instead of plain `expo start` for real-device runs. Resume here next session if the build didn't complete: check `eas build:list` for status before re-triggering.
- [ ] Composite/covering index on `users(city)` including join columns, so "approved barbers in city X" doesn't need extra heap lookups at scale (flagged by database-optimizer during Step 5 Stage 8 closeout, 2026-07-06). Not urgent at MVP scale — the other half of this original recommendation (partial index on `barber_profile.verification_status`) was applied 2026-07-06 as migration `0008_add_barber_profile_approved_partial_index.sql` once discovery queries actually went live during Step 9-10's Stage 10 closeout, and its urgency was reassessed upward at that point since it was now on three live customer-facing read paths (barber_directory, services_select_own_or_approved, availability_select_own_or_approved) rather than a queued/theoretical recommendation. Route through `supabase-schema-architect` whenever this one is actioned too.
- [ ] Anon leftover-privilege cleanup (flagged during Step 5 Stage 7, 2026-07-06): anon still holds `TRUNCATE`/`REFERENCES`/`TRIGGER` on all public tables — predates this app's own migrations (Supabase's default project bootstrap grants `ALL` to anon before migration 0001 ever ran); migration 0006 only revoked SELECT/INSERT/UPDATE/DELETE. Not reachable via PostgREST (doesn't expose those ops) so not an active exploit path, but worth closing for hygiene via a future `supabase-schema-architect`-owned migration. Optionally also consider moving `is_admin()`/`has_role()` to a non-PostgREST-exposed schema to silence the two low-risk WARN advisor findings (RPC-reachable by any authenticated caller, self-only fact-check, no cross-user data — not blocking).

### Step 7–8 — barber services & availability (one pipeline run)
- [ ] Gate: a service and an availability window are saved correctly and visible in the DB <!-- PROGRESS (2026-07-06): Full 8-stage pipeline run completed for code: Stage 1 task-decomposition, Stage 2 architect-review (confirmed no schema change needed; flagged the bookings.price snapshot gap now tracked under Step 11-12 above), Stage 3 schema-check (none needed, services/availability tables + RLS predate this run), Stage 4 fullstack-developer built src/barber/{errors,types,servicesData,availabilityData}.ts (RLS-only auth, no service_role, mirrors auth data-layer conventions), Stage 5 mobile-developer built src/barber/screens/{ServicesScreen,AvailabilityScreen}.tsx + wired into BarberNavigator.tsx/BarberDashboardScreen.tsx, Stage 6 ui-ux-designer audit (2 must-fix accessibility items found and fixed: missing accessibilityLabel on TextInputs, missing accessibilityRole="alert" on error notices — both applied), Stage 7 test-engineer added 43 unit/integration tests (124/124 full suite passing) + 2 Maestro E2E flows authored, Stage 8 security-auditor static review PASS + live RLS negative-tests against the real DB all passed (barber_id spoofing rejected both tables, customer-role write rejected, CHECK constraints enforced, cross-user read correctly allowed for non-sensitive discovery data, anon locked out), Stage 10 database-optimizer (no index changes needed — human-bounded per-barber row counts) + context-manager (no integration issues, no type collisions) + graphify update all done. REMAINS: the gate itself — "a service and an availability window are saved correctly and visible in the DB" — requires a signed-up test barber actually driving the running app/UI, which has NOT happened. Blocked on the exact same tooling gap as Step 6 (no Maestro CLI, no Android SDK/emulator on this dev machine). Code is complete and tested (unit + live RLS tests against the real database); the literal end-to-end gate is unexecuted, not passed. Resolve alongside Step 6's tooling gap, then execute both Step 6's and this gate together with the same real test barber. UPDATE (2026-07-06): see Step 5's entry — bundleIdentifier/package now set in app.json, EAS dev-client build in progress on the founder's own machine. Same real-device blocker, same fix in flight, no separate action needed here. -->
- [ ] Barber-services E2E flows (`.maestro/barber-services-add-edit-delete.yaml`, `.maestro/barber-availability-add-edit-delete.yaml`) authored but unexecuted — same blocker as Step 6, run once Maestro CLI + emulator exist

### Step 9–10 — customer discovery (one pipeline run)
- [ ] Gate: the test barber appears for the test customer once approved <!-- PROGRESS (2026-07-06): Full 8-stage pipeline run completed for code: Stage 1 task-decomposition (files mirror src/barber/ structure), Stage 2 architect-review (city matching = normalized case/whitespace-insensitive exact match not substring; flat list + defensive LIMIT 100, no pagination; barber_directory.rating shown as "no ratings yet" until rating>0 since no aggregation exists yet — CRITICAL FINDING: services_select_all/availability_select_all had no approval-status gate, letting any authenticated user browse an unapproved barber's services/schedule), Stage 3 supabase-schema-architect authored + applied migration 0007 (tightened both policies to barber_id=auth.uid() OR approved-exists-check, reusing 0004's pattern) — live-tested by me directly (unapproved barber's services hidden from others, still visible to owner), Stage 4 fullstack-developer built src/customer/{errors,types,discoveryData}.ts (barber_directory-only discovery surface, documented ILIKE-based city-normalization with an honest documented limitation on stored-value whitespace), Stage 5 mobile-developer built CustomerHomeScreen.tsx (replaced placeholder) + new BarberProfileScreen.tsx, wired into CustomerNavigator.tsx, built accessibility-correct from the start this time (no regression found at Stage 6), Stage 6 ui-ux-designer audit found zero must-fix items (one nice-to-have accessibility label on the rating display, applied), Stage 7 test-engineer added 29 unit/integration tests (153/153 full suite passing) + 1 Maestro E2E flow authored, Stage 8 security-auditor static PASS + live RLS tests I ran directly against the real DB (unapproved barber invisible in both barber_directory and services to another customer; approved barber correctly visible in both) + no new advisor findings, Stage 10 database-optimizer flagged barber_profile.verification_status index as newly-urgent now that discovery queries are live (raised from the Step 5 closeout's queued recommendation) — actioned immediately via migration 0008 (partial index, applied and verified live) rather than re-deferred, context-manager confirmed migration 0007 does not break Step 7-8's listOwnServices/listOwnAvailability (owner branch unconditional), no type collisions, graphify update done. REMAINS: the gate itself requires a real signed-up test barber AND test customer driving the running app — has NOT happened (no real user rows exist yet). Blocked on the same Maestro CLI/Android emulator tooling gap as Steps 5-8. Code is complete and DB-verified via direct SQL (both positive and negative cases); the literal UI-driven gate is unexecuted, not passed. Resolve alongside the other pipeline runs' same tooling gap, then execute all gates together with the same real test barber + customer. UPDATE (2026-07-06): see Step 5's entry — bundleIdentifier/package now set in app.json, EAS dev-client build in progress. Same real-device blocker, same fix in flight, no separate action needed here. -->
- [ ] Customer-discovery E2E flow (`.maestro/customer-discovery-view-barber-profile.yaml`) authored but unexecuted — same blocker as Steps 6 and 7-8, run once Maestro CLI + emulator exist

### Step 11–12 — booking flow (one pipeline run)
- [ ] Booking flow end to end: pick service → available time slots derived from the barber's availability windows minus existing bookings → confirm with location; price snapshotted at booking time (never read live from SERVICES)
- [ ] HARD REQUIREMENT (flagged by architect-reviewer during Step 7-8 Stage 2, 2026-07-06): `bookings.price` is currently just a plain `numeric(10,2) check (price >= 0)` column with no trigger or default reading from `services` — the "snapshot, never read live" guarantee in this file's schema section is a convention only, NOT DB-enforced. A malicious or buggy authenticated customer client could otherwise insert an arbitrary price today. This pipeline run MUST implement one of: (a) server-side validation (Edge Function/RPC) that reads `services.price` at insert time and discards any client-supplied price, or (b) a BEFORE INSERT trigger that stamps `price` from `services` regardless of client input. Do not silently assume this is "already handled."
- [ ] Gate: a booking is created with status 'pending'

### Step 13–14 — barber requests & realtime status (one pipeline run, needs supabase-realtime-optimizer)
- [ ] Barber incoming-requests screen with accept/reject respecting the booking state machine (pending→accepted / pending→rejected, accepted→cancelled, accepted→completed)
- [ ] Realtime status updates on the customer side (BOOKINGS table, Realtime enabled)
- [ ] Gate: accepting updates the booking status instantly on the customer's side via Realtime

### Step 15–16 — chat (one pipeline run, needs supabase-realtime-optimizer)
- [ ] Simple text chat tied to a booking (CHAT_ROOMS + MESSAGES, Realtime), customer↔barber both directions
- [ ] Gate: messages send and receive correctly in both directions

### Step 17 — manual verification flow (one pipeline run)
- [ ] Barber uploads ID photo + license photo to a PRIVATE storage bucket → VERIFICATION_REQUESTS row (no selfie, no biometrics — hard rule)
- [ ] Founder review path (Supabase dashboard or minimal admin view) sets verification_status; approved barbers become discoverable
- [ ] Portfolio upload (max 6 images, enforce the 6-row constraint) — barber profile
- [ ] Barber dashboard (bookings overview, profile completeness)

### Step 18 — MVP release gate
- [ ] Full end-to-end run with real test users: signup → verify barber → add service/availability → discover → book → accept (realtime) → chat → complete → review
- [ ] Reviews: customer rates after a completed booking only (REVIEWS constraint), rating aggregation onto barber_profile via a server-owned path (rating column is trigger-protected — needs schema-architect involvement)
- [ ] Final /security-audit + /supabase-security-audit across the whole app before Phase 2 planning

### Phase 2 planning reminders (do not build yet — surface when Phase 2 starts)
- [ ] Stripe Connect payments; dispute resolution + refund/cancellation-fee policy (undefined, blocks real money)
- [ ] In-home safety features: live location sharing during appointment window, SOS button (highest-liability gap)
- [ ] Revisit email-change flow (users.email is trigger-frozen; requires service_role-mediated sync)
