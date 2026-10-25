# CLAUDE.md

This repository no longer keeps a separate Claude-specific project context.

Use `AGENTS.md` as the authoritative project instructions, product rules, build order, orchestration pipeline, and backlog routing source. The legacy `.claude/` agent, command, script, and duplicate skill files were removed on 2026-09-10 in favor of the retained Codex-first setup:

- `.codex/privelier-engineering-skiller`
- `.codex/privelier-ui-ux-skiller`
- `.agents/skills`

Historical docs and code comments may still mention `CLAUDE.md`; those references now resolve to this compatibility pointer.

## Current founder decision: open service area

Founder decision by Taha on 2026-09-21: Privelier is open to users in all
locations. This supersedes the 2026-09-20 Nuremberg-only location gate. The app
must not require location permission for signup, login, OAuth, app entry, or
foreground use. Signup and OAuth completion collect a required city and an
optional country manually; users can edit both later. Discovery currently uses
an exact city match after trimming and case-insensitive comparison. Do not map
city aliases in this version.

## Current founder decision: free location stack, live arrival, push

Founder decision by Ali on 2026-10-25:

- Maps move off Mapbox to MapLibre + OpenFreeMap tiles; address search uses
  Photon; road routing uses the FOSSGIS OSRM/Valhalla servers. All are free
  and keyless, approved third-party services. No paid map API.
- Build barber "On my way" live arrival tracking (`booking_trips`, migration
  0049), booking address coordinates, and in-home safety (hold-for-SOS,
  share trip). Location permission is still never required for signup,
  login or app entry: it is asked only when a barber starts a trip, and only
  "while using".
- Push notifications are now allowed, via the free Expo push service
  triggered from Postgres (`pg_net`), asked in context, never at app entry.
- Python is used for tooling and automation (`tools/geo`), not as a server.
  Live logic stays in the apps plus Supabase.
- Founder request by Ali on 2026-10-25 (UI/UX + speed pass): React Compiler
  and Metro inline requires are on; shared motion kit in `src/shared/motion`
  (PressableScale, AnimatedNumber, SuccessBurst, CelebrationOverlay,
  RevealItem). `barber_stats` (migration 0050) is computed nightly by
  `tools/automation/compute_barber_stats.py` on GitHub Actions and powers the
  reply-time badge, popular times and the barber "Your rhythm" card —
  aggregates only. `npm run ui:audit` guards design-system consistency.

## Legal consent versioning

The legal consent migration intentionally seeds `placeholder-1` for the
privacy notice and both role-specific terms. Keep this stable placeholder until
the real legal texts are published and approved. When they are published,
bump the current version values; the version change will require every user to
accept the updated legal text again. Do not replace the placeholder merely
because it looks unfinished.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
