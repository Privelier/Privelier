# Privelier rebuild evidence index

Last updated: 2026-09-01

This committed file contains only redacted summaries and hashes. Bulky logs, screenshots, videos, APKs, and bundle reports belong under artifacts/privelier-rebuild/ and are ignored. Never retain secrets, tokens, personal data, production records, exact locations, messages, or identity documents as evidence.

| Evidence ID | Date | Task | Evidence | Result summary | Retention / hash |
|---|---|---|---|---|---|
| EVID-P00-001 | 2026-09-01 | P00-001 | git status, branch, HEAD, and recent log | Repository is C:\Users\original\Documents\Privelier on main at 435323785499c29bdfa22d6c99dd5101af15a332; main matches origin/main. Pre-existing dirty state: AGENTS.md and app.json modified; assets/marketing/city-goes-quiet-ad-v1.png untracked. | Redacted summary committed here; raw command output not retained. |
| EVID-P00-002 | 2026-09-01 | P00-002 | applicable instruction and orchestration inventory | One root AGENTS.md applies. Installed planning skills are under .agents/skills. Project agent/command definitions are under .claude/agents and .claude/commands; .Codex is absent. | Redacted summary committed here. |
| EVID-P00-003 | 2026-09-01 | P00-003 | tool availability | Node 24.15.0, npm 11.13.0, Expo CLI 57.0.20 through npx, EAS CLI 23.0.0, Graphify available. Supabase and Maestro CLIs are not on PATH. ADB exists by absolute SDK path, but no device is attached. | Redacted summary committed here. |
| EVID-P00-004 | 2026-09-01 | P00-003 | Supabase MCP get_project_url and public table inventory | Connected to project ref ajcsanrepboqcjgpzsaa. Thirteen public tables observed; RLS reported enabled on each. This was read-only and is not a complete policy audit. | No rows or personal data retained. |
| EVID-P00-005 | 2026-09-01 | P00-003 | eas project:info | Current config resolves to @aatt/privelier, project ID 4e46ae1b-e79e-4c7e-b407-7880f2cc047c. | Metadata-only summary. |
| EVID-P00-006 | 2026-09-01 | P00-004 | eas build:view for reference build | Build 3f1e4abb-23f9-47b6-9a75-2f8af1d5555c is FINISHED, Android, development profile, SDK 57, app identifier com.privelier.app, build version 2, exact Git commit 4353237. Artifact expires 2026-09-13. | Artifact URL and signed log URLs are deliberately not committed here. |
| EVID-P00-007 | 2026-09-01 | P00-002 | git check-ignore | .gitignore exact rule /artifacts/privelier-rebuild/ matches the local evidence path. | Committed rule; local directory ignored. |
| EVID-P00-008 | 2026-09-01 | P00-005 | Graphify scoped query | Graph exists and was queried before source browsing; it surfaced role roots, navigators, screens, data modules, tests, and Supabase connectivity. | Regenerable graph remains ignored. |
| EVID-P00-009 | 2026-09-01 | P00 baseline | typecheck, lint, Jest, Expo Doctor, and Expo dependency check | TypeScript and lint passed; 48 suites / 550 tests passed; Expo Doctor passed 21/21; Expo dependencies are current. Jest still emits overlapping/unwrapped `act()` warnings, so the baseline is green but not deterministic or warning-free. | Redacted command summary committed here; raw output not retained. |
| EVID-P00-010 | 2026-09-01 | P00 baseline | npm audit | Audit reports 21 transitive findings: 19 moderate and 2 high. No automatic dependency mutation was performed. | Package names and counts only; remediation belongs to P01. |
| EVID-P00-011 | 2026-09-01 | P00 migration inventory | Supabase MCP hosted migration ledger versus `supabase/migrations` | All 23 committed migrations are represented remotely. Hosted production also contains `20260728141752_create_waitlist_table`, for which no local SQL migration file exists. Nothing local was pending, so no hosted migration was applied. | Read-only migration metadata; drift remains open for schema-architect reconciliation. |

## Evidence status

P00 remains in progress. The baseline checks above are captured, but `npm ci`, clean-reset feasibility, full inventory reconciliation, the missing canonical `PRIVELIER_REBUILD_PLAN.md` ledger, and the remote-only waitlist migration still need closure. P01 may not begin until P00 is frozen; once it begins, its first blocker is the warning-producing Jest baseline.
