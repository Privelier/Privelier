# Hardening checks

The scripted checks behind the engineering skill's full scan (`.codex/privelier-engineering-skiller/SKILL.md`, "Full-scan hardening checklist"). The goal they implement is `docs/privelier-Vibecoding-goal.md`; the latest results are in `docs/quality/2026-10-27-hardening-report.md`.

| Command | What it proves |
|---|---|
| `npm run check` | Typecheck, ESLint at zero warnings (no console, no `any`, no floating promises), Jest, knip (no unused files, exports or dependencies), jscpd under 3 % duplication, no circular imports. CI runs the same gate. |
| `npm run db:test` | pgTAP suites in `supabase/tests` against the linked project, inside transactions that never commit: the authorization matrix (anon, two customers, an approved and a pending barber), abuse limits, reports and account deletion. |
| `python tools/db/supa.py test --with M.sql -- T.sql` | The same suites with unapplied migrations staged inside the same rolled-back transaction. |
| `npm run db:concurrency` | Four concurrent sessions prove an overlapping booking cannot slip in while another is in flight. |
| `npm run db:pending` | Migration files not yet recorded on the project. |
| `python tools/db/supa.py dry-run M1.sql M2.sql` | Applies migrations in order, then rolls back. |
| `python tools/db/supa.py apply M.sql` | Applies and records a migration (only with founder authorization). |
| `npm run db:types` | Regenerates `src/database.types.ts` from the live schema. |
| `npm run secrets:scan` | gitleaks over the full git history (redacted). CI also scans; `tools/hooks/install-gitleaks-hook.sh` scans staged changes before each commit. |
| `npx expo-doctor` and `npx expo install --check` | Expo SDK compatibility. |

The database tools need `SUPABASE_ACCESS_TOKEN` (a personal access token) in the environment and read the project from `EXPO_PUBLIC_SUPABASE_URL` in `.env`. They print no secrets.

Supabase's Security and Performance Advisors are the `supabase db lint` equivalent without a local Docker stack; read them in the dashboard or through the Management API (`/v1/projects/{ref}/advisors/security`).
