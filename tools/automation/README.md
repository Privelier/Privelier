# Automation

## Barber stats (nightly)

`compute_barber_stats.py` fills `public.barber_stats` (migration 0050). The
app reads that table for three UX components:

- **"Usually replies in ~15 min"** on barber cards and profiles. It turns
  brass for replies within 30 min, and needs at least 3 samples.
- **"Popular times"** on barber profiles: a day picker over hour bars with a
  "quiet right now" hint.
- **"Your rhythm"** on the barber dashboard: reply time, busiest window,
  repeat clients.

The statistics live in `barber_stats.py` (pure and unit-tested):

- **Reply time:** the median, capped at 48 h.
- **Popular times:** recency-weighted (45-day half-life), with Bayesian
  shrinkage toward the marketplace pattern and circular hour smoothing.
- **Repeat rate:** needs at least 4 customers.

The output contains aggregates only: no customer ids and no single
appointments.

**Runs on:**
- **GitHub Actions** (`.github/workflows/barber-stats.yml`) at 02:17 UTC
  daily, and on demand from the Actions tab. Add the repository secrets
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; until then the job logs a
  notice and exits cleanly.
- **Locally**, with either `SUPABASE_SERVICE_ROLE_KEY` or your
  `SUPABASE_ACCESS_TOKEN` (the Management API backend):

```bash
py tools/automation/compute_barber_stats.py --dry-run   # print, no writes
py tools/automation/compute_barber_stats.py             # compute + upsert
py tools/automation/test_barber_stats.py                # unit tests
```

## UI audit

`python3 tools/ui/ui_audit.py` (also `npm run ui:audit`) checks the app
against the design system and motion-performance rules:
- palette colours, sentence case and theme fonts
- `accessibilityRole` on pressables
- native-driver animations
- `expo-image` instead of the plain `Image`
- list keys and render windows

`--strict` exits non-zero on error-level findings, for CI.
