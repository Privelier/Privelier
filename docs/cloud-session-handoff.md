# Cloud session handoff

Purpose: let a fresh Claude Code cloud session (claude.ai/code) continue this
project with zero prior local state. This repo clones cleanly, but the cloud
session has **none** of the local machine's credentials, physical device, or
memory. This file captures the project state, the cloud limitations, and a
ready-to-paste first message.

> **`CLAUDE.md`'s living backlog is authoritative and always fresher than this
> file.** This snapshot was last reconciled against `origin/main` on
> **2026-07-31**; treat anything here as a summary, and trust `CLAUDE.md` on any
> disagreement.

> Secrets are deliberately NOT in this file or the repo. `.env` is gitignored
> and was never committed; the Supabase `service_role` key and the Mapbox `sk.`
> download token live only outside git. The cloud session must be provisioned
> with a fresh Supabase Personal Access Token and the public `EXPO_PUBLIC_*`
> values separately (see "First message", below).

---

## Project state (for a zero-context reader)

**Product:** on-demand marketplace, barbers travel to the customer. Two RN/Expo
apps (Customer, Barber), one Supabase backend (project ref
`ajcsanrepboqcjgpzsaa`), RLS-enforced throughout. Migrations run **0001–0023**.
Build order + the mandatory per-feature orchestration pipeline are authoritative
in `CLAUDE.md` — read it fully before any work.

### Built AND verified (real device, real accounts)
- Steps 1–12: Supabase project + schema, auth/signup, barber services +
  availability, city discovery, **booking flow end-to-end** (pending row,
  server-stamped price, service↔barber attribution enforced by migration 0010).
  On-device confirmed 2026-07-09.
- Step 13–14 **partial**: booking accept/reject/complete/cancel transitions
  (migrations 0011/0012) — barber-side accept + complete exercised on device.
- Step 17 barber upload half: verification doc upload + portfolio upload
  (max 6), security gates PASS.

### Built, code/pipeline-complete, but the on-device / human gate is still open
- **Verification submission** — was broken live and is now **FIXED**
  (commit `f48e932` + migration 0020, 2026-07-17). The old "missing `GRANT
  UPDATE`" diagnosis was **wrong and dangerous** — see the known-traps note
  below. The Step 17 on-device gate (upload → dashboard approve → Discover) is
  now genuinely runnable for the first time and still needs to be run.
- **Barber bio-edit** — full pipeline complete (T1–T9); only the founder
  on-device review remains.
- **Barber dashboard (Studio)** readiness meter + bookings glance — green on
  code/pipeline side, security PASS; on-device visual review remains.
- **Reviews (Step 18)** — pipeline Stages 1–8 done (migrations 0022 attribution
  fix + aggregation + author RPC); customer rate-after-completed-booking flow +
  aggregate display built. On-device founder gate + end-of-project Ultra visual
  pass remain.
- **Explore tab** — list + filters, plus Mapbox map integration (offset-privacy
  pins). Map on-device (EAS build a5726cbe, installed on the *local* device
  only) never founder-verified. Barber-location capture (Run A) on-device gate
  also open (offset privacy proven server-side, not walked through on device).
- Full UI rebuild against the Lovable prototype + the Ultra design pass across
  customer + barber apps (6/6 increments) landed on `main`.
- Every `.maestro/*.yaml` flow is **authored but UNEXECUTED** — Maestro CLI has
  never been installed on any machine.

### Genuinely open / needs hardware or a live session
- **Two-device realtime gates** (Step 13–14 booking status live; Step 15–16 chat
  send/receive live; read-receipts + typing live). Soft/environmental blockers
  needing two devices/sessions at once. Must pass before the Step 18 release
  gate.
- **Supabase "private channels only" setting**: do **NOT** blanket-enable it —
  it would break every non-private channel (bookings/messages/chat_read_state
  `postgres_changes` + the app-level unread channel). A `CHANNEL_ERROR` on
  `messages:unread:{uid}` was seen in the Metro log and may stem from that
  toggle already being flipped; if so, revert it. Needs a live session to
  confirm.
- **Chat image sending**: not built (text only).
- **iOS**: entirely untested — no verified iOS dev build; the iOS EAS build is
  the founder's own interactive Apple-login flow.
- A tail of tracked, non-blocking follow-ups (indexes, anon leftover-privilege
  cleanup, migration-ledger reconciliation, several LOW security-hardening
  items) — all itemized in `CLAUDE.md`'s backlog.

### Known traps (do NOT repeat)
- **Verification `42501`**: Postgres's own error HINT suggests
  `GRANT UPDATE ON public.verification_requests TO authenticated`. **Never apply
  it** — it is a privilege escalation (lets a barber self-approve and forge
  `reviewed_by`/`reviewed_at`, corrupting the founders' manual review queue).
  The real fix was app-side (explicit update-then-insert, never upsert) plus
  migration 0020; migration 0023 froze the reviewer columns as defence in depth.
  Full write-up is in `CLAUDE.md`.
- **Mocked Supabase tests cannot see Postgres privilege / NOT NULL / RLS
  failures.** Passing unit tests never prove a DB-facing fix — the on-device or
  live-DB gate does.

---

## Cloud limitations — what will NOT work from a cloud session

Do not mark any of these "done" from the cloud:

- **No physical Android device, no adb, no Metro-on-device.** Every gate phrased
  as "on-device" / "founder verifies on the phone" / "two-device realtime" is
  impossible from cloud.
- **No installing/verifying APKs.** With an `EXPO_TOKEN` you may *trigger* an EAS
  build, but you cannot install or run the result — build success ≠ feature
  verified.
- **Maestro flows still cannot be executed** — no CLI, no device. They stay
  "authored, unexecuted."
- **No direct push to `main` from cloud.** Use a branch + PR workflow there.
- **MCP gaps:** the `supabase` MCP works only after a fresh
  `SUPABASE_ACCESS_TOKEN` is provided; `markitdown` MCP is unavailable (needs
  Docker); the `memory` MCP starts empty; the file-based founder memory
  (`~/.claude/.../memory/`) does not exist in cloud.
- **`graphify` hooks** may no-op (the binary is local-only).

---

## First message to paste into the cloud session

```
You are continuing work on "Privelier" — an on-demand marketplace where independent barbers travel to the customer. Two React Native + Expo apps (Customer, Barber) share one Supabase backend (project ref ajcsanrepboqcjgpzsaa), fully RLS-enforced, migrations 0001–0023. CLAUDE.md in the repo root is the authoritative context and living backlog — READ IT FULLY before touching anything, and trust it over any summary. It defines the schema, the branching booking state machine, the mandatory per-feature orchestration pipeline (Plan→Design→Build→Validate→Secure→Integrate→Release), and the hard rules (schema only via supabase-schema-architect; security is the final non-optional gate; one feature per pipeline run; manual verification only, no biometrics; stay in MVP scope). Founder process rules that are NOT in this repo, honor them: use real descriptive commit messages, report progress per-item, and treat "on-device" gates as real tests that are NOT satisfied by code review or passing unit tests (mocked Supabase tests in particular cannot see Postgres privilege / NOT NULL / RLS failures).

WHAT YOU HAVE: the full repo (code, migrations 0001–0023, docs/design/, tests, .maestro flows, .claude/agents + commands + skills, hooks, git history). CLAUDE.md's backlog is the source of truth for what's left. docs/cloud-session-handoff.md mirrors this message.

ENVIRONMENT YOU MUST SET UP (nothing secret is in the repo by design):
- Add these PUBLIC, client-safe env vars (safe to store in cloud settings): EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (anon, RLS-bound), EXPO_PUBLIC_MAPBOX_TOKEN (Mapbox pk. public token). I will paste the values.
- The supabase MCP needs a FRESH Supabase Personal Access Token (SUPABASE_ACCESS_TOKEN) generated in the cloud — do not expect the previous machine's token. Until it's set, supabase MCP tools won't work.
- Optional: an EXPO_TOKEN (from expo.dev access tokens) enables non-interactive EAS builds. RNMAPBOX_DOWNLOAD_TOKEN (Mapbox secret sk.) already lives as an EAS secret server-side — never put it in .env or git.

WHAT YOU CANNOT DO FROM CLOUD (do NOT mark these "done"):
- No physical Android device, no adb, no Metro-on-device: every on-device / two-device / founder-verifies-on-phone gate is impossible here. You may trigger an EAS build but cannot install or verify the APK.
- Maestro flows remain authored-but-unexecuted (no CLI, no device).
- Push via BRANCH + PR only — do not push directly to main.
- markitdown MCP is unavailable (no Docker). The memory MCP starts empty. graphify hooks may no-op.

CURRENT STATE (summary — trust CLAUDE.md's backlog over this):
- Verified through Step 12 (booking flow end-to-end, on device). Steps 13–18 are largely BUILT with security gates passed, but their realtime/on-device gates are OPEN.
- Verification submission was broken and is now FIXED (migration 0020 + app-side update-then-insert). KNOWN TRAP: never apply the 42501 error HINT `GRANT UPDATE ON verification_requests TO authenticated` — it is a privilege escalation (self-approval + reviewer forgery); migration 0023 froze the reviewer columns as defence in depth. Details in CLAUDE.md.
- Bio-edit pipeline is COMPLETE (T1–T9); only the founder on-device review remains. Reviews (Step 18) built through Stage 8; on-device gate + Ultra visual pass remain.
- Open question needing a live session: do NOT enable Supabase "private channels only" — it would break every non-private channel; a CHANNEL_ERROR on messages:unread:{uid} may already stem from that toggle being flipped.
- Not built: chat image sending. Untested entirely: iOS.

BEFORE YOU START ANY WORK: confirm back to me exactly what you actually have in THIS environment — (1) can you read CLAUDE.md and the repo, (2) is the supabase MCP connected and can it run execute_sql (i.e. is SUPABASE_ACCESS_TOKEN set), (3) are the EXPO_PUBLIC_* env vars present, (4) which MCP servers and agent types are actually available to you. List what's missing so I can provision it. Do not begin implementation until we've confirmed tooling and picked a task from the backlog together.
```
