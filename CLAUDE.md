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
- The `react-native-best-practices` skill (Callstack) is referenced throughout this file but is NOT actually installed (verified 2026-07-09: absent from `.claude/skills/`, `~/.claude/skills/`, and the harness skill list — it was never invokable). Until it is installed (tracked in the backlog), apply its intent manually: RN/Expo performance, Hermes, bundle size, native module patterns.
- The `maestro-mobile-testing` skill (tovimx) is likewise referenced but NOT installed (same 2026-07-09 verification). The `.maestro/` flows written so far followed Maestro conventions manually and remain the house style — especially for optimistic UI updates and auth-gated screens, where flaky tests are most likely.

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
pending   → cancelled   (customer cancels their own still-pending booking — founder-approved 2026-07-09)
accepted  → cancelled
```

No other states exist. Every screen, query, and agent must respect exactly this branching. Actor rules are DB-enforced (migration 0011): only the barber may accept/reject/complete; only the customer may cancel a pending booking; either participant may cancel an accepted booking.

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
4. Use the `fullstack-developer` agent to build backend/API logic. No schema changes are allowed at this stage. For any feature involving Realtime (booking status updates, chat), also bring in the `supabase-realtime-optimizer` agent — a real agent as of 2026-07-09 (`.claude/agents/supabase-realtime-optimizer.md`), built around the realtime checklist from docs/design/step-13-14-realtime-requests-retroactive-review.md plus the F1/F2 lessons; supply it the live-verified publication/replica-identity/RLS facts its checklist marks [LIVE].
5. Use the `mobile-developer` agent to build the screens, applying React Native/Expo best practices manually (the `react-native-best-practices` skill is not installed — see Tech stack).
6. Use the `ui-ux-designer` agent (or the `ui-ux-pro-max` skill) to polish the UI against the brand identity section above.
7. Use the `test-engineer` agent for unit/integration tests, and author Maestro E2E flows following the conventions established in `.maestro/README.md` (the `maestro-mobile-testing` skill is not installed — see Tech stack) — the booking accept/reject flow and the chat flow are the highest priority for E2E coverage, since they involve realtime/optimistic UI updates where flakiness is most likely.
8. Use the `security-auditor` agent and run `/security-audit` plus `/supabase-security-audit`. This is the final gate — nothing is considered done without an explicit PASS. This check must also confirm no `service_role` key is present anywhere in client code.
9. If anything breaks at any stage, use the `debugger` agent. For Realtime-specific issues (a status or message not arriving live), check the Supabase MCP server's `get_logs` (service: realtime) and the live publication/replica-identity state first; for general data questions during debugging, query the live DB via the Supabase MCP server (`execute_sql`) instead of switching to the Supabase dashboard. (The previously-referenced `/supabase-realtime-monitor` and `/supabase-data-explorer` commands never existed in `.claude/commands/` — phantom references, corrected 2026-07-09.)
10. Once built and tested, use `database-optimizer` to check query performance and `context-manager` to confirm correct integration with everything already built, before starting the next feature.

**Important distinction:** everything in `.claude/agents/` is a subagent, invoked by describing the task in plain language — these are not slash commands. Only files actually present in `.claude/commands/` (for example `supabase-schema-sync`, `security-audit`, `generate-tests`) work as real `/slash-commands`. Skills that are actually installed (e.g. `ui-ux-pro-max`, `supabase-postgres-best-practices` in `.claude/skills/`) activate automatically when relevant or can be invoked directly — before referencing any agent/command/skill by name, confirm it exists in the corresponding directory (the 2026-07-09 inventory found five phantom references in this file alone).

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
- [ ] Stage 6 — test-engineer <!-- PROGRESS (2026-07-05, commit 29d84b4): DONE: jest-expo + testing-library infra added, unit/integration tests passing (authService error mapping + full idempotent insert-sequencing incl. 23505-as-success-of-other-writer on both users and barber_profile, errors.ts table-driven, useAuthShell phase transitions + remount-stability). tsc+eslint clean. Two Maestro flows authored (login->provisioning->role-landing, signup->await-confirmation->resend) but UNEXECUTED — no Maestro CLI installed yet. UPDATE (2026-07-06): Android dev-client tooling gap is now RESOLVED — adb/platform-tools installed and on PATH, phone authorized over USB, EAS Android development build succeeded and the APK is installed on the physical device via `adb install`, Metro running via `expo start --dev-client` with `adb reverse tcp:8081 tcp:8081`. The step-6 DB gate and the email-confirmation deep-link fix (commit 2997057) are both DONE and confirmed live on the device — see Build Order status, no longer tracked here. iOS dev client is still the founder's own `eas build --profile development --platform ios` (interactive Apple login, run from their own terminal, not this shell) — status unconfirmed, check `eas build:list` before re-triggering. Maestro CLI itself is STILL not installed on this machine — that is the one remaining tooling gap for running the two authored flows (on Android, at least; iOS needs its own device flow separately). REMAINS: (1) install Maestro CLI and point `maestro test` at the now-authorized Android device, (2) run the two authored flows and fix whatever breaks, (3) author + run the duplicate-email and app-kill-mid-provisioning flows (deferred on purpose until the first two run once). -->
- [ ] Composite/covering index on `users(city)` including join columns, so "approved barbers in city X" doesn't need extra heap lookups at scale (flagged by database-optimizer during Step 5 Stage 8 closeout, 2026-07-06). Not urgent at MVP scale — the other half of this original recommendation (partial index on `barber_profile.verification_status`) was applied 2026-07-06 as migration `0008_add_barber_profile_approved_partial_index.sql` once discovery queries actually went live during Step 9-10's Stage 10 closeout, and its urgency was reassessed upward at that point since it was now on three live customer-facing read paths (barber_directory, services_select_own_or_approved, availability_select_own_or_approved) rather than a queued/theoretical recommendation. Route through `supabase-schema-architect` whenever this one is actioned too.
- [ ] Anon leftover-privilege cleanup (flagged during Step 5 Stage 7, 2026-07-06): anon still holds `TRUNCATE`/`REFERENCES`/`TRIGGER` on all public tables — predates this app's own migrations (Supabase's default project bootstrap grants `ALL` to anon before migration 0001 ever ran); migration 0006 only revoked SELECT/INSERT/UPDATE/DELETE. Not reachable via PostgREST (doesn't expose those ops) so not an active exploit path, but worth closing for hygiene via a future `supabase-schema-architect`-owned migration. Optionally also consider moving `is_admin()`/`has_role()` to a non-PostgREST-exposed schema to silence the two low-risk WARN advisor findings (RPC-reachable by any authenticated caller, self-only fact-check, no cross-user data — not blocking).

### UI rebuild against the Lovable prototype (founder-directed 2026-07-08, screen by screen)
Reference: https://github.com/Privelier/privelier-at-home.git (React web/Vite — visual/structural reference ONLY, never copy its code; Supabase schema/RLS/booking state machine stay untouched — this track rebuilds the UI layer only; each screen is shown to the founders before starting the next).
- [ ] Discover/Home screen <!-- PROGRESS (2026-07-08): rebuilt as src/customer/screens/DiscoverScreen.tsx (replaces CustomerHomeScreen) plus src/customer/components/BarberCard.tsx and a customer bottom-tab shell (src/customer/CustomerTabs.tsx: Discover/Explore/Bookings/Inbox/Account — Explore/Bookings/Inbox are placeholders, Account is a minimal profile+sign-out screen). Data stays real: batched listServicesForBarberIds() added to discoveryData.ts feeds "from €X" lines + dynamic service-name chips. Deps added (both JS-only, NO dev-client rebuild needed): @react-navigation/bottom-tabs, @expo/vector-icons; PlayfairDisplay_500Medium added to typography. tsc+eslint+jest all clean (43 customer tests pass). Maestro contract updated: customer-home-logout → customer-account-logout on the Account tab (both flows + .maestro/README.md updated); customer-home-screen/-loading/-error/-empty/-barber-{id} testIDs preserved. REMAINS: founder visual review on the physical device (phone was disconnected at rebuild time; Metro was left running). Founder decisions to confirm: EUR (€) currency display, static "Trending this week" editorial content (hardcoded Unsplash imagery), verified badge rendered for every directory row (approved ⇒ verified by construction). -->
- [ ] Barber profile detail screen <!-- PROGRESS (2026-07-08): rebuilt src/customer/screens/BarberProfileScreen.tsx to the prototype's customer.barber.$id layout — full-bleed 320px hero (profile image under status bar, flat scrim + light text, floating back button, StatusBar style=light only when an image exists), bio + service-name chips, Services/Portfolio/Reviews tab strip (sentence case per confirmed decision). Same data layer (getBarberProfile + listServicesForBarber). Data-honesty deviations: per-row Book button shows an Alert "Booking opens soon" until step 11-12; Portfolio tab = empty state until step 17; Reviews tab = rating + empty state until step 18; no description/distance/years lines (no such columns). formatMoney changed to exact cents (€42.50, never rounds) — affects Discover cards too. Maestro testIDs preserved (services is the default tab so existing assertions hold; -rating testID present in both rated and unrated branches); new IDs barber-profile-tab-{key} + barber-profile-book-{id} documented in .maestro/README.md. tsc+lint+jest clean. REMAINS: founder visual review on device (Metro left running; phone disconnected both times — Discover screen review is ALSO still pending, same session). Founder-confirmed decisions this session: € pricing, static Trending content, verified badge on all directory rows, sentence-case "Editor's pick". -->
- [ ] Bookings tab <!-- PROGRESS (2026-07-08): built src/customer/screens/BookingsScreen.tsx (replaces placeholder) per prototype customer.bookings — Upcoming/Past tab strip, booking cards. Real read path: new src/customer/bookingsData.ts fetchOwnBookingsView() (RLS bookings_select_participants scopes to own rows — verified live in pg_policies) + best-effort barber_directory/services enrichment with calm fallbacks. BookingRow/BookingStatus added to src/types.ts; formatBookingWhen added. Upcoming = pending/accepted AND slot >= now, else Past (isUpcomingBooking, unit-tested). Cards not tappable (booking detail = step 11-12). Empty states are the expected first render (no booking data exists until step 11-12). tsc+lint+jest clean (52). REMAINS: founder visual review. -->
- [ ] Inbox tab <!-- PROGRESS (2026-07-08): built src/customer/screens/InboxScreen.tsx (replaces placeholder) per prototype customer.inbox — header + subtitle, hairline-divided thread rows (avatar, barber name, preview, short date). Real read path: new src/customer/inboxData.ts fetchOwnInboxView() over chat_rooms + batched last-message scan (cap 200) + bookings/barber_directory/services enrichment; pure buildInboxThreads() (newest-message-per-room, activity sort, null-degrading lookups) unit-tested. ChatRoomRow/MessageRow added to src/types.ts; formatShortDate added (local-midnight anchoring for bare dates). Honesty deviations: no fake presence dot; preview = real last message, falls back to "About: {service}"; row tap → "Chat opens soon" Alert until step 15-16. Empty state expected (no rooms exist until chat ships). tsc+lint+jest clean (56). REMAINS: founder visual review. -->
- [ ] Account tab <!-- PROGRESS (2026-07-08): rebuilt src/customer/screens/AccountScreen.tsx to full prototype customer.account layout — profile row (avatar/initial, name, email, brass "Member" label), five hairline-divided settings rows (Favorites, Notifications, Privacy & security, Preferences, Help center) each navigating to a real AccountSection stack screen (new AccountSectionScreen.tsx, generic via section-key param, honest placeholder bodies; help section shows privelier@outlook.com as contact), destructive sign-out row (customer-account-logout testID preserved — login E2E flow depends on it). Founder-excluded, DO NOT ADD: Wallet & payments, Gift cards & credits rows. Deferred by design: stats strip (cuts/barbers/avg — all-zero noise until bookings/reviews data exists); customer verified badge removed (verification is barber-only). tsc+lint clean, full suite 194 tests pass. REMAINS: founder visual review (all three tabs of this batch: Bookings, Inbox, Account). -->
- [ ] Remaining customer screens, roughly in prototype order: booking flow (fold into step 11-12), booking confirmation, chat (fold into step 15-16), explore/map; Account stats strip (cuts/barbers/avg rating) once bookings/reviews data exists
- [ ] Barber-side screens <!-- PROGRESS (2026-07-08): investigation done (prototype HAS a full 5-tab barber design: Studio/Requests/Portfolio/Chats/Verify; its requests state machine (confirmed/in_progress) does NOT match our authoritative one — ours wins; its verification flow writes verification_status from the client — forbidden here, admin-only). Iteration 1 DONE: BarberTabs.tsx 5-tab shell + StudioScreen.tsx (replaces BarberDashboardScreen) — greeting header, REAL verification-status line (new barber/profileData.ts fetchOwnBarberProfile, read-only), Services/Availability summary cards with real counts + from-price, founder decision: Services/Availability stay separate stack screens (NOT inline like prototype). testIDs barber-dashboard-logout/-services/-availability preserved (Maestro flows verified still valid); shared format helpers moved to src/shared/format.ts (customer/format.ts is a re-export shim). tsc+lint clean, 194 tests pass. Iteration 2 DONE (2026-07-08): RequestsScreen.tsx + requestsData.ts (real RLS-scoped bookings read, soonest-first, own-services lookup; BOOKING_STATUS_LABELS moved to shared/format.ts) — NO accept/reject actions (step 13-14) and cards lead with SERVICE name because users RLS blocks reading the customer's name (gap logged under Step 13-14). Iteration 3 DONE (2026-07-08): PortfolioScreen.tsx + portfolioData.ts (real RLS-verified read of PORTFOLIO — select open to authenticated, write own+barber-role; PortfolioRow added to src/types.ts; MAX_PORTFOLIO_IMAGES=6 mirrors the DB cap) — 2-col grid + "N of 6" counter live; add tile → "Uploads open soon" Alert; NO per-image delete yet (both upload+delete = step 17, expo-image-picker native module = new dev-client build). Iterations 4+5 DONE (2026-07-08): ChatsScreen.tsx + chatsData.ts (real chat_rooms/messages read; buildInboxThreads + InboxThread moved to src/shared/threads.ts, customer inboxData/types re-export; rows lead with service name + neutral avatar — same users-RLS counterpart gap; tap → "Chat opens soon") and VerifyScreen.tsx + fetchOwnVerificationRequest in profileData.ts (VerificationRequestRow added to src/types.ts; REAL status card from barber_profile.verification_status + REAL doc-row uploaded-state from own verification_requests row — both display-only, prototype's client-side status write deliberately NOT ported; upload buttons → "Uploads open soon", step 17). tsc+lint clean, 194 tests pass. ALL FIVE BARBER TABS BUILT. REMAINS: founder review of Chats+Verify, then the final barber iteration: Services/Availability restyle (keep CRUD, validation, and every Maestro testID). -->
- [ ] Auth + role-select screens restyled to the prototype look

### Step 7–8 — barber services & availability — gate PASSED on-device (2026-07-09, combined Steps 7-12 session, real device + real test accounts)
NOTE for any future direct-SQL admin write to barber_profile: migration 0005's trigger silently reverts verified/verification_status/rating back to old values unless `auth.role() = 'service_role'`; a raw Management-API SQL session doesn't carry that by default, so run `select set_config('request.jwt.claim.role', 'service_role', false);` first in the same query call, or use the Supabase dashboard's Table Editor instead (it sets this automatically).
- [ ] Barber-services E2E flows (`.maestro/barber-services-add-edit-delete.yaml`, `.maestro/barber-availability-add-edit-delete.yaml`) authored but unexecuted — Maestro CLI itself is still not installed (Android device/dev-client tooling is otherwise ready)

### Step 9–10 — customer discovery — gate PASSED on-device (2026-07-09, same combined session: approved barber visible in the customer's Discover list on-screen)
- [ ] Customer-discovery E2E flow (`.maestro/customer-discovery-view-barber-profile.yaml`) authored but unexecuted — same Maestro CLI gap as Step 7-8

### Step 11–12 — booking flow — CLOSED (2026-07-09)
Full pipeline run complete: design gate (docs/design/step-11-12-booking-flow-design-approval.md) → schema (migrations 0009, 0010) → data layer (`src/shared/slots.ts`, `src/customer/availabilityData.ts`, `src/customer/bookingCreateData.ts`) → screens (`BookingDateTimeScreen`/`BookingLocationScreen`/`BookingConfirmScreen`, wired from `BarberProfileScreen`'s Book button) → visual polish → tests (236/236 passing, unit+integration+authored E2E) → security gate PASS. Gate confirmed: a booking is created with status 'pending', price is server-stamped, and it now correctly requires the booked service to belong to the booked barber (migration 0010, closed a real price/attribution manipulation vector a raw-API caller could otherwise exploit — caught by the security audit, not by design review). Bookings tab (customer) and Requests tab (barber) both confirmed to refresh on focus (fixed a latent bug: both were mount-only `useEffect`, which would have hidden new bookings from an already-visited tab until app restart). ON-DEVICE CONFIRMED 2026-07-09: the full flow (date/time → location → confirm → pending row in `bookings` with server-stamped price → request visible on the barber's Requests tab) was run end to end on a real device with the two real test accounts, founder-verified — the gate is passed in reality, not just in mocked tests.

Tracked follow-ups (not blocking, do not let them silently disappear):
- [ ] Double-booking guard only catches identical `(barber_id, date, time)`, not overlapping durations — e.g. a 60-min booking at 10:00 and a 30-min booking at 10:15 for the same barber both insert successfully today (flagged by security-auditor 2026-07-09, non-blocking since the app UI's `deriveAvailableSlots` never offers an overlapping slot in normal use, but the DB is not actually authoritative for this case despite its own migration comment claiming so). Fix: a `btree_gist` exclusion constraint on the booking's actual time range, not just a point-equality index. Should land before Phase 2 real-money bookings make an accidental overlap costly.
- [ ] `AVAILABILITY` has no "closed"/blackout row type — a barber cannot express "normally open this weekday, but closed this one date," only additive `specific_date` overrides (design doc Decision 1, 2026-07-09). Fast-follow candidate, route through `supabase-schema-architect`.
- [ ] Customer-booking E2E flow (`.maestro/customer-booking-create.yaml`) authored but unexecuted — same Maestro CLI gap as Steps 6–10.

### Step 13–14 — barber requests & realtime status — core logic BUILT, gate not yet fully passed
Status honesty note (2026-07-09): the build stage of this step landed in commit `83989d2` BEFORE its pipeline stages ran — the founders directed a retroactive closeout instead of a revert. What is DONE and verified: migrations 0011 (actor-aware transition trigger, incl. the founder-approved pending→cancelled) and 0012 (get_booking_counterparts RPC — this RESOLVED the counterpart-identity gap the right way, without widening users SELECT) are live and audited; all four barber transitions + customer cancel + realtime hook/reducer + both screens are built; barber-side accept and complete were exercised on a real device 2026-07-09 (the on-device test booking went pending→accepted→completed); retroactive design review APPROVED (docs/design/step-13-14-realtime-requests-retroactive-review.md); unit tests added (applyBookingChange reducer, all five transition mutations, fetchOwnRequestsView — suite now 266); accept/reject Maestro flow authored (`.maestro/barber-requests-accept-reject.yaml`); /security-audit + /supabase-security-audit PASS (2026-07-09) over 0011/0012 + the new mutation paths, service_role clean in tree and full history.
- [ ] Gate: accepting updates the booking status instantly on the customer's side via Realtime — needs a deliberate two-device (or device + second session) check with both test accounts; the single-device Maestro flow cannot cover this half and says so in its header. Review findings F1 (reconnect-gap refetch via `onRecovered`) and F2 (reference-preserving sorted merge) were FIXED 2026-07-09 (unit-tested, incl. the full recovery matrix — suite 285), so this same session should also sanity-check the reconnect path: toggle airplane mode mid-focus, change the booking from the other side, re-enable network, and confirm the list catches up without a tab switch.
- [ ] Security-audit follow-up (LOW, pre-existing from 0003 but re-surfaced 2026-07-09): the column-immutability freeze in `enforce_booking_status_transition` does not cover `id`/`created_at` — a participant could rewrite a booking's primary key or forge its creation timestamp via a raw UPDATE. Route through `supabase-schema-architect`.
- [ ] Run `.maestro/barber-requests-accept-reject.yaml` once Maestro CLI is installed (same gap as Steps 6–12; it needs exactly two seeded pending bookings — see the flow's header).

### Cross-cutting hygiene (discovered 2026-07-09 during the Step 13-14 closeout and the same-day agent inventory)
- [ ] `fullstack-developer` agent's body describes the wrong stack (Next.js 15/React 19, tRPC/Hono, Drizzle, Vercel — none used here). It has worked because task prompts carry the real Expo+Supabase context, but its priors pull web-stack; rewrite its Focus Areas/Approach for this project's actual stack. (Founder-deferred 2026-07-09 — noted, not yet fixed.)
- [ ] `debugger` agent pins `model: claude-sonnet-4-5`, a previous-generation model id — update or remove the pin. (Founder-deferred 2026-07-09 — noted, not yet fixed.)
- [ ] Actually install the two skills CLAUDE.md long claimed were installed but never were (corrected 2026-07-09): `react-native-best-practices` (Callstack) and `maestro-mobile-testing` (tovimx). Until then their intent is applied manually (see Tech stack section).
- [ ] Supabase's migration ledger is missing entries for 0001, 0005, 0009, 0010 (they were applied via raw SQL, not `apply_migration`) — the live objects are all present and correct (verified 2026-07-09), but reconcile the ledger so tooling that trusts it doesn't mislead. `supabase-schema-architect`-owned.
- [ ] Security-advisor items, none blocking: `barber_directory` is a SECURITY DEFINER view (advisor ERROR — intentional-by-design cross-user read surface, same rationale as the narrow RPCs, but document the acceptance or convert to `security_invoker` via `supabase-schema-architect`); leaked-password protection is disabled in Supabase Auth (WARN — one dashboard toggle, founder action); the two new RPC WARNs (`get_barber_busy_slots`, `get_booking_counterparts`) are the deliberate, documented pattern — accepted.

### Step 15–16 — chat — core BUILT (2026-07-10), gate not yet passed
Built and reviewed: migration 0013 (AFTER INSERT trigger on bookings creates the chat_rooms row at booking time per the founder's 2026-07-09 decision — chat opens while still pending; idempotent ON CONFLICT, backfill for pre-existing bookings, composite messages(chat_id, created_at) index replacing the single-column one; applied via the migration API so the ledger is consistent). Conversation screens for BOTH apps (message list, input, send; honest "Sending…"/"Not sent — tap to retry" pending bubbles via the shared `useSendQueue` hook — no fabricated rows, no read receipts/typing/presence) wired from the Inbox/Chats thread rows (both lists now load on focus); barber header upgrades to the customer's name via the 0012 RPC. Realtime copies the step 13-14 architecture verbatim: `messageRealtime.ts` reducer + `useMessagesRealtime.ts` per-room channel incl. the F1 onRecovered recovery and F2 reference bailouts. The `supabase-realtime-optimizer` agent's FIRST real run (2026-07-10) returned APPROVED WITH FINDINGS; its M1 (synchronous double-submission guard on send/retry — React state commits too late and duplicate messages are permanent) was fixed same-day and pinned by useSendQueue tests. Suite 325/325; post-migration security advisors unchanged (no new findings). Maestro flow `.maestro/customer-chat-send-message.yaml` authored (post-echo assertions), unexecuted — same CLI gap.
- [ ] Gate: messages send and receive correctly in both directions — two-device (or device + second session) check with both test accounts; single-device Maestro covers only the send half. During this same run, do the review's L1 one-time check: log one realtime payload's `created_at` next to the fetched row's — if PostgREST and Realtime serialize timestamptz differently, every own-send echo misses the F2 no-op bailout (and briefly renders a wrong clock); fix by normalizing `created_at` in `useMessagesRealtime`'s payload normalization if and only if they differ.
- [ ] Review follow-up L2 (LOW): `fetchConversation` fetches the whole room history on every focus AND every F1 recovery — fine at MVP (one room per booking, index-ordered scan) but payload grows monotonically in a long-lived room. Follow-up: `.order(desc).limit(~200)` + reverse (fits the inverted list). Do not let this silently disappear.

Unread indicator (founder-directed 2026-07-10) — BUILT same day: migration 0014 `chat_read_state` (own-row RLS, live-probed: counterpart cannot read it, spoofed writes rejected — security-audit PASS), design note docs/design/step-15-16-unread-indicator-design.md, app-level unread provider per app (unfiltered RLS-scoped messages channel), Inbox/Chats tab badges (count), bold+dot unread thread rows, mark-as-read on opening the specific conversation. supabase-realtime-optimizer review #2: APPROVED WITH FINDINGS — M1 (hook tests) and M2 (baseline now loads on SUBSCRIBED, never before the join) fixed same day, plus L1 (no marker write for own sends). Suite 341/341. Remaining follow-ups from that review, LOW, tracked here:
- [ ] Unread review L2: a recovery baseline racing a still-in-flight read-marker upsert can transiently re-flag a just-left room until the next successful baseline (self-healing). Fix idea: track in-flight marker writes and suppress re-flagging until they settle.
- [ ] Unread review L3: device clock behind server + a room's newest message outside the 200-message scan cap can re-flag an already-read room after restart (documented in the design note §4). Optional fix: conversation screens feed their fully-loaded newest message back to the provider.
- [ ] `service_role` has no DML grants on `chat_read_state` (side effect of the strict revoke in 0014) — harmless today (no server-side path touches it), note for future admin tooling; `supabase-schema-architect`-owned if ever needed.

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
