# Capacity readiness: 500 concurrent users

## Verdict

**Fail for 500 concurrent Realtime users.** Live rechecks on 2026-09-20 and 2026-09-21 found the project on Supabase Free with Realtime configured for 200 maximum concurrent clients and 100 events/second. It has no 500-user controlled load result and only six users, three bookings, and five messages, which is not representative. It must not be described as 500-user ready.

## Source evidence

| Area | Evidence | Status | Required action |
|---|---|---|---|
| Realtime channel lifecycle | `useBookingsRealtime` and `useMessagesRealtime` create focused, filtered channels and remove them on cleanup; both refetch after an error/timeout recovery. Live settings: enabled, max 200 concurrent clients, max 100 events/second, Realtime authorization pool size 2, Postgres Changes pool size 2. | Good code-level control, but capacity fails the 500-user requirement | Upgrade/configure capacity, then check Realtime reports and logs during a controlled test. |
| Conversation history | `src/customer/conversationData.ts` fetches every message for a chat room with no limit or cursor. | Confirmed scale defect | Add cursor pagination and bounded initial history. |
| Booking/request history | `src/customer/bookingsData.ts` and `src/barber/requestsData.ts` fetch every booking for their participant with no limit or cursor. | Confirmed scale defect | Add bounded history and pagination for completed/cancelled records. |
| Discovery | `discoveryData.ts` caps the directory at 100, then makes batched service and availability reads. | Bounded but incomplete beyond 100 matching barbers | Add server-backed pagination before a city can exceed 100 approved barbers. |
| Authentication email | Supabase built-in email delivery is documented as two emails per hour per project without custom SMTP. | Confirmed operational blocker for real users | Configure verified custom SMTP and sender identity before launch. |
| Native performance | No release-build measurements on a target device or representative dataset. | Not measured | Profile a release build using 500-user-shaped synthetic data. |

## Read-path findings and required design

The live project currently holds only three `bookings` rows and five `messages` rows, so its query statistics cannot establish scale behavior. Read-only inspection on 2026-09-20 did confirm the deployed schema and the following implementation plan:

- Conversation history: fetch the newest 40 messages by `(created_at, id)` descending, reverse only that bounded page for chronological rendering, and use the oldest returned tuple as the "load earlier" cursor. A realtime insert remains an in-memory append; it must not refetch the whole history.
- Customer bookings: retain an immediately useful, bounded upcoming-bookings section, then page historical terminal bookings by `(date, time, id)` descending. Do not use `offset`, because it becomes progressively more expensive and can duplicate/skip results while rows change.
- Barber requests: retain a bounded action queue for `pending` and `accepted`; page terminal/historical work separately. Status-changing realtime events must reconcile the loaded pages without erasing an item merely because it moved between sections.
- Enrichment: request counterpart/service/barber data only for the page's unique ids. The existing counterpart RPC must receive page ids only, never an account's entire booking history.
- API contract: expose `items`, `nextCursor`, and `hasMore`, with an opaque typed cursor that includes every ordering field. Return one extra row internally to compute `hasMore`; do not report a next cursor when no further row exists.

The current `messages(chat_id, created_at)` composite index supports the existing chronological room read, but a deterministic `(created_at, id)` cursor needs a schema-owner decision and an `EXPLAIN (ANALYZE, BUFFERS)` check against representative data. The deployed database also still has the redundant `messages(chat_id)` index even though migration 0013 intended to drop it. Booking reads have only single-column participant indexes, not the participant-plus-sort indexes required for keyset history. These are schema-architect-owned decisions; no migration is proposed or applied by this review.

## Live advisor snapshot: 2026-09-20

The Supabase Advisor API was read on 2026-09-20 after the capacity review. It changes the readiness verdict from "not yet load tested" to an explicit remediation queue:

| Finding | Impact | Required disposition |
|---|---|---|
| Leaked-password protection is disabled | Compromised passwords are not rejected by Supabase Auth. | Enable it in Authentication > Attack Protection, then re-run the security advisor. |
| Five `SECURITY DEFINER` functions are executable by `authenticated` users (`get_barber_busy_slots`, `get_booking_counterparts`, `get_review_authors`, `has_role`, `is_admin`) | This is an explicit externally-facing security review item. Several are intentional app RPCs; do not blindly revoke execution because that would break booking, requests, reviews, and authorization flows. | Schema/security owner must validate each function's least-privilege grants and ownership, then document the accepted justification or apply a migration. |
| 29 `auth_rls_initplan` warnings | RLS policies re-evaluate `auth.*`/`current_setting()` per row and will add avoidable cost as data volume grows. | Schema architect must replace eligible expressions with `(select auth.<function>())`, preserve every authorization predicate, and run authenticated adversarial tests before production rollout. |
| 8 multiple-permissive-policy warnings | Multiple policies are evaluated for the same relation/action; consolidating them incorrectly could widen access. | Treat as a correctness-sensitive RLS refactor, not a quick performance patch. Preserve semantics with policy tests. |
| 16 unused-index notices | The project has only three bookings and five messages, so zero scans are not evidence that the indexes are unnecessary. | Do not drop indexes before representative traffic and `EXPLAIN (ANALYZE, BUFFERS)` evidence. |

Advisor remediation links: [security-definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS initialization plan](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select), and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 500-user readiness gate

1. Upgrade from Free and configure Realtime for the expected peak. The live 200-client ceiling cannot meet 500 concurrent users. A 500-connection tier is not enough headroom for a 500-concurrent-active-session launch commitment; select/configure a tier and spend limit that provides at least 600 connections, then verify the actual dashboard limits before testing.
2. Run the pagination feature pipeline above before load testing: task decomposition, schema-architect index decision, bounded client data-layer implementation, unit/integration plus Maestro coverage, security review, then integration review. The current unbounded history queries make any test result dependent on accidental account age.
3. Use a non-production Supabase project with synthetic accounts. Ramp from 25 to 100 to 250 to 500 active sessions; do not point a load test at founders' live user data.
4. Resolve or explicitly risk-accept the live Advisor security findings, and run the schema-owned RLS performance remediation before the high-concurrency test.
5. Measure API latency, database/pool saturation, Realtime connected clients, event rate, reconnects, failed writes, storage failures, mobile memory, and crash-free sessions.
6. Set acceptance thresholds before the test, then retain the raw report, logs, app/build revision, device models, synthetic data size, and test configuration.

## References

- Supabase documents 200 concurrent Realtime connections on Free and 500 on Pro, plus per-plan event limits: <https://supabase.com/docs/guides/realtime/limits>.
- Realtime reports expose connected clients, events, execution time, lag, and response errors: <https://supabase.com/docs/guides/realtime/reports>.
- The built-in Supabase email provider is limited to two emails per hour; custom SMTP is required for real usage: <https://supabase.com/docs/guides/auth/rate-limits>.
