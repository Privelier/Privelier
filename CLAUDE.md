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
