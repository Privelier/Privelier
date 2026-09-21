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
