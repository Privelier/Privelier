# Retroactive design review — Step 13-14: barber requests, status transitions, realtime

**Gate:** architect-review + realtime-specific pass (CLAUDE.md orchestration pipeline stages 1-2, run retroactively — the build stage of this feature landed in commit `83989d2` before any design gate ran; founders directed this retroactive review on 2026-07-09)
**Scope reviewed:** migrations 0011/0012 (live), `src/shared/bookingRealtime.ts`, `src/shared/useBookingsRealtime.ts`, `src/barber/requestsData.ts`, `src/barber/screens/RequestsScreen.tsx`, `src/customer/bookingsData.ts` (cancel path), `src/customer/screens/BookingsScreen.tsx`, `src/barber/errors.ts` / `src/customer/errors.ts` (P0001 mapping)
**Verdict: APPROVED retroactively** — the architecture is correct against the authoritative schema and state machine, with two ranked findings to action (F1, F2) and three noted for the record. Nothing found requires reverting or redesigning what was built.

**Process note (for honesty, not blame):** CLAUDE.md's pipeline names a `supabase-realtime-optimizer` agent for realtime features; no such agent definition exists in `.claude/agents/`. This review applied an explicit realtime checklist instead (publication membership, replica identity, RLS-on-WAL behavior, reconnect semantics, channel lifecycle, event/snapshot reconciliation). Either add the agent definition or update CLAUDE.md to name this checklist — currently the pipeline references a tool that doesn't exist.

---

## 1. What was validated and holds

1. **State machine + actor conformance.** All five transitions in the code (accept, reject, complete, barber cancel, customer cancel) match the authoritative state machine exactly, including the founder-approved (2026-07-09) `pending → cancelled`. No client code re-implements authorization: RLS gates row visibility/updatability and the actor-aware trigger (0011) is the sole authority on who may perform which transition. The trigger compares actors against `OLD.*`, which is sound because the same trigger's column-immutability freeze guarantees participants can never rewrite `barber_id`/`customer_id`.
2. **Counterpart RPC (0012).** Participant predicate correctly lives *inside* the SECURITY DEFINER body (RLS is bypassed there, so an in-body check is mandatory — it's present). Returns only id/name/profile_image for bookings the caller belongs to. Consistent with the 0009 hardening shape (stable, pinned search_path, EXECUTE revoked from public/anon). Correctly avoids widening `users` SELECT, as the backlog demanded.
3. **Channel-before-refetch ordering + idempotent reducer.** Opening the subscription before the baseline fetch, then folding both snapshot rows and stream events through the same upsert-by-id reducer, is the correct no-missed-events pattern for the *focus* transition. Overlap between snapshot and stream is harmless by construction.
4. **Focus-gated lifecycle.** Gating the channel on focus (not mount) is right for bottom-tab screens that stay mounted; the effect's cleanup removes the channel on blur/dep-change, so repeated focus cycles cannot leak channels. `onChange` is held in a ref so callback identity churn doesn't tear the channel down.
5. **RLS × Realtime.** `postgres_changes` events are RLS-filtered server-side (WAL-level check), and both participants can SELECT a booking row, so both legitimately receive its events. The `filter: barber_id=eq.X` / `customer_id=eq.X` is correctly documented as traffic optimization, not a security boundary.
6. **Replica identity compatibility (verified live: `DEFAULT`/pk on both tables).** UPDATE events carry the full new row — the only event type this feature actually depends on. DELETE events would carry only the PK, and the reducer indeed uses only `row.id` for DELETE — compatible, though in practice bookings are never deleted (the state machine only ever updates `status`), so the DELETE arm is defensive dead code. Fine as-is.
7. **Optimistic-update reconciliation.** Predict → in-flight guard → reconcile-with-authoritative-row → rollback-on-failure, with the refetch skipping in-flight ids so a stale snapshot can't flip an optimistic card backward. This is the correct shape, and the P0001 → `transition_rejected` error mapping gives wrong-actor/stale-state rejections calm, specific copy.

## 2. Findings to action (ranked)

**F1 — MEDIUM: missed events across a mid-focus reconnect are never recovered.** supabase-js auto-reconnects a dropped websocket and re-subscribes, but Supabase Realtime does **not replay** events that fired while the socket was down. The screens refetch only on focus — so a user who keeps the tab focused through a connectivity blip (elevator, subway, wifi→cell handoff: the *normal* mobile case) can sit on a stale status indefinitely, silently. Fix (small): extend `useBookingsRealtime` to surface subscription-status transitions and have the caller re-run its baseline `load()` whenever the channel re-enters `SUBSCRIBED` after having been `CHANNEL_ERROR`/`TIMED_OUT`/closed. The existing idempotent-merge design makes this refetch free of double-application risk — the architecture already anticipates it; only the trigger is missing. **This is exactly the class of gap the realtime pass exists to catch; it must land before the Step 13-14 gate is called fully passed.**

**F2 — LOW: every realtime echo forces a render, defeating the reducer's own no-op optimization.** `applyBookingChange` carefully returns the *same array reference* for no-op events (its documented anti-flicker contract), but all three merge call sites immediately wrap it in `sortAsc(...)`/`sortDesc(...)`, which unconditionally allocates a new array — so React re-renders the whole list on every echo anyway. Fix (two lines per call site): `const next = applyBookingChange(prev, event); return next === prev ? prev : sortAsc(next);`.

## 3. Noted for the record (no action required now)

- **F3:** a card's inline `rowError` is keyed by booking id and cleared only when a new action starts on that card — a realtime event that resolves the underlying staleness (e.g. the customer's withdrawal arriving) leaves the old error text under the now-updated card until the next action or refocus. Cosmetic; acceptable.
- **F4:** `userId` is read once on mount via `getSession()`. Safe today because the tab shells are auth-gated and unmount on sign-out; would need revisiting only if a screen ever survives an account switch.
- **F5:** filtered DELETE delivery is unreliable by design (the filter column isn't present in a PK-only old record), which is moot while nothing deletes bookings — but chat (step 15-16) copies this file's shape, so do not rely on filtered DELETE events there either.

## 4. Verdict

Approved retroactively. F1 and F2 are tracked in CLAUDE.md's backlog under Step 13-14; F1 blocks calling the step's gate fully passed, F2 rides along in the same change. Chat (step 15-16) should copy this architecture *including* the F1 fix.
