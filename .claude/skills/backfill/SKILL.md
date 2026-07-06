---
name: backfill
description: Run Trainelo's historical data backfills — intervals.icu wellness (HRV/sleep/RHR) and EWMA fitness/fatigue state — with required env vars and a mandatory dry-run-first flow. Use when the user wants to backfill, re-sync, or repair historical wellness or training-load data.
---

# Data Backfill

Two backfill scripts exist. Both read env from `.env.local` (via `-r dotenv/config`). **Always run with `--dry-run` first (or confirm explicitly for scripts without one), show the user the result, and get a go-ahead before the real run.**

## intervals.icu wellness backfill

```powershell
npx tsx -r dotenv/config scripts/intervals-backfill.ts --days 30 --dry-run   # preview
npx tsx -r dotenv/config scripts/intervals-backfill.ts --days 30             # real run
```

- Flags: `--days N` (how far back), `--dry-run` (fetch + report, no writes).
- Required in `.env.local`: `INTERVALS_ICU_ATHLETE_ID`, `INTERVALS_ICU_API_KEY`, `TRAINELO_USER_ID`, plus Supabase server creds (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- Check the env vars exist before running (don't print their values). If missing, point the user at `.env.example` and `docs/lessons-learned-garmin-data-access.md` / `README.md` for how intervals.icu sync is set up.
- intervals.icu API is authenticated with HTTP Basic (`API_KEY` as username `API_KEY`, key as password) — the script handles this; never log the key.

## EWMA daily-state backfill

```powershell
npx tsx -r dotenv/config scripts/backfill-ewma.ts
```

- One-time-style script that populates the `ewma_daily` table from historical training load. Re-running recomputes from history.
- Run this **after** a wellness/load backfill so EWMA sees the new data.
- Needs the same Supabase server creds.

## After a backfill

Sanity-check the result: query recent rows (e.g. via the app's PMC data or a quick Supabase query) and confirm dates are contiguous and today's recommendation pipeline picks up the new history. If the Supabase project is paused (free tier), scripts fail with connection errors — resume the project in the Supabase dashboard first.
