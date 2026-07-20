# Chat read receipts + typing indicator — design-approval note

Pipeline stage 2 (architect-review, applied manually per `.claude/agents/architect-review.md` —
the known non-spawnable-agent gap), run 2026-07-14. Feature: founder-directed 2026-07-14 —
read receipts visible to the other participant (reusing `chat_read_state`) and a debounced,
auto-clearing typing indicator (Supabase Realtime broadcast). Stage-1 WBS produced same day by
task-decomposition-expert (6 objectives, 15 tasks, decision nodes D1–D6 resolved here).
Verification constraint: automated test suite only — no physical device available this session.

**Decision-reversal on record:** migration 0014's header documented `chat_read_state` as
"deliberately NOT read receipts." The founder reversed that on 2026-07-14 by requesting this
feature. This note is the paper trail; 0017's header must reference it.

## Architectural impact: Medium
No new tables. One RLS-policy widening + one publication addition + new `realtime.messages`
policies (first use of broadcast in this codebase). App side: two new shared hooks copying the
step 13-14/15-16 reference architecture, one pure derivation module, two screen integrations.

## Live-verified facts (2026-07-14, via Supabase MCP)
- `chat_read_state`: RLS enabled; SELECT own-row only; INSERT/UPDATE own-row+membership; no
  DELETE policy/grant; replica identity `default` (PK `(chat_id, user_id)` — the realtime
  filter column `chat_id` is IN the PK); NOT in `supabase_realtime` publication.
- Publication contains exactly `bookings`, `messages`.
- `realtime.messages` exists, RLS enabled, ZERO policies today (private channels currently
  deny everyone — policies must be created for broadcast authorization to work at all).
- `@supabase/supabase-js` ^2.110.0 (private broadcast channels supported).
- `useUnreadThreads.load()` reads `chat_read_state` with NO user filter (relies on today's
  own-row RLS) — see condition C1.

## Decisions (authoritative for the build stages)

**D1 — Widen `chat_read_state` SELECT to room participants (not an RPC).** The 0012 RPC
precedent does not fit here: postgres_changes delivery is RLS-on-WAL — a subscriber only
receives rows their SELECT policy passes — so an RPC can never make the counterpart's receipt
arrive live. New policy: participant-of-room predicate (same `chat_rooms` membership shape as
`messages_select_participants`), replacing `chat_read_state_select_own`. Exposure delta is one
timestamp (`last_read_at`) to exactly one counterpart per room. Write policies unchanged.

**D2 — Add `chat_read_state` to the `supabase_realtime` publication.** Receipts must flip live
while the sender is looking at the conversation; poll-on-focus would only update on re-focus.
Replica identity `default` is sufficient: consumed events are INSERT/UPDATE (full new row;
filter column `chat_id` is in the PK), and DELETE can never occur (no policy, no grant) — the
F5 filtered-DELETE trap does not apply.

**D3 — Receipt comparison is NUMERIC (epoch ms via `Date.parse`), not ISO-string compare.**
The comparison (counterpart `last_read_at` vs own message `created_at`) crosses the
PostgREST/Realtime serialization boundary — exactly the tracked L1 fragility. String compare is
only valid for same-source strings; `Date.parse` normalizes both ISO variants. Millisecond
truncation is safe because `resolveReadMarker` writes the marker as EXACTLY the newest known
message's server-generated `created_at` — the device clock is never consulted (that was the
realtime-optimizer M1 correction of 2026-07-14; an earlier draft of this line said
`max(device now, …)`, which never matched the shipped code) — so a read marker is `>=` the
message timestamp by construction, with equality the normal case. Malformed/unparseable input degrades to "not read" (honest default). This decision
neutralizes L1 for receipts; the separate L1 one-time echo check for messages stays tracked.

**D4 — Typing uses a PRIVATE broadcast channel (`config.private = true`), authorized by new
RLS policies on `realtime.messages`.** Topic `typing:{chat_id}`; SELECT (receive) and INSERT
(send) policies both require `extension = 'broadcast'` AND room membership via
`chat_rooms` (`cr.id::text = split_part(realtime.topic(), ':', 2)` — text comparison, no uuid
cast that could throw on a malformed topic). The public-channel alternative (security by
unguessable room UUID) was rejected: it would need an accepted-risk writeup for both spoofed
sends and eavesdropped joins, when the RLS route costs one migration section. `self: false`
(no echo of own typing). Ephemeral only — no DB rows, nothing persisted.

**D5 — Receipt UI is a single quiet "Read" line under the NEWEST own message only.** No
per-message ticks, no "Delivered" (nothing real carries delivery — honesty rule), no new
columns. Secondary-text color, sentence case, no accent. If the newest own message is unread,
nothing renders (absence is the honest state, not a "sent" glyph).

**D6 — Device-gate substitute: deterministic mocked-channel tests + live SQL emulation; the
dual-client live test is NOT built.** The stage-1 recommendation (two real supabase-js clients
against the live project) is rejected for this session: the test accounts' credentials are not
available in this environment, and embedding them in the repo/test env would be worse than the
gap. Substitute: (a) hook/unit tests with mocked channels — the house pattern that already
covers F1/F2 regressions for messages/bookings; (b) live SQL verification via MCP of every
[LIVE] fact including per-user policy-visibility emulation (`set_config` JWT claims) both ways;
(c) an explicit two-device gate line added to the backlog (a SOFT blocker per the founder's
2026-07-14 decision). What genuinely cannot be verified without a device: actual websocket
delivery latency, OS backgrounding behavior, and the end-to-end receipt/typing round trip.

## Conditions (binding on build stages)

- **C1 (regression guard, ships WITH the migration):** `useUnreadThreads.load()` must add
  `.eq('user_id', myId)` to its `chat_read_state` read — under D1's widened policy the
  unfiltered read starts returning counterpart rows and corrupts `computeUnreadRoomIds`
  (two rows per room; map insertion order decides which wins — silent wrong badges). Audit for
  any other unfiltered `chat_read_state` reads. Dev-client JS and migration land together;
  no standalone builds exist, so no stale-client window at MVP.
- **C2:** new hooks copy the reference architecture exactly: focus-gated channel, callbacks
  via refs, `onRecovered` → baseline refetch (F1), stable channel names
  (`read_state:chat_id:{roomId}`, `typing:{roomId}`), cleanup via `removeChannel`.
- **C3:** receipt state is a single value (counterpart `last_read_at` or null); its reducer is
  pure, idempotent, and MONOTONIC (never moves backward — a late/stale event cannot regress
  "Read" to unread), returning the same reference on no-op (F2).
- **C4:** typing send side: leading-edge emit + refractory window (~2.5 s) — never one event
  per keystroke; explicit stop on send/clear/blur; receive side self-heals via local timeout
  (~5 s) even if the stop event is lost. All timers cleaned up on blur/unmount; logic lives in
  a pure, fake-timer-testable module.
- **C5:** NO second write path for `last_read_at` — the unread provider stays the sole writer;
  the receipt feature only reads.
- **C6:** shared logic in `src/shared/` (both apps); screens render receipt/typing state
  exclusively from hook output — nothing fabricated.
- **C7:** three channels per open conversation (messages, read-state, typing) + the app-level
  unread channel. Bounded: one conversation open at a time. Accepted at MVP; flagged to the
  realtime-optimizer for the cost note.

## Verdict: APPROVED — proceed to supabase-schema-architect (migration 0017), then build.
