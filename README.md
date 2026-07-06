# Trainelo

Deterministic daily training recommendation engine powered by wearable data. Ingests HRV, sleep, training load, and recovery signals to produce personalized workout recommendations with full confidence scoring and audit trail.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Vercel serverless functions (TypeScript)
- **Database**: Supabase (PostgreSQL + RLS)
- **Data sync**: intervals.icu (official Garmin/Polar/etc. server-side integration) via Vercel cron
- **Cron**: intervals.icu sync (4:00 UTC), daily recommendation generation (5:00 UTC)

## Core Pipeline

```
intervals.icu Sync → DB Ingestion → Readiness/Fatigue Scoring → Anomaly Detection
→ Candidate Generation → Session Calibration → Anomaly Enforcement
→ Workout Template Resolution → API Response
```

Key modules:
- **Readiness & Fatigue** — multi-signal scoring (sleep, HRV, metrics, training load, EWMA)
- **Passive Calibration** — auto-detects HR max, resting HR, HRV baseline from observed data
- **Anomaly Detection** — HRV dissociation, overtraining risk, low confidence
- **Session Calibrator** — morning check-in (mood, RPE, pain, illness) adjusts intensity/duration
- **Workout Templates** — 7 templates with segment-level detail, calibration multipliers applied

## Local Development

```sh
npm install
npm run dev:full    # Frontend (Vite :8080) + API (Express :3001)
```

## Testing

```sh
npm run test        # Run all tests
npm run test:watch  # Watch mode
```

## Data Sync (intervals.icu)

Wellness (HRV, sleep, resting HR, steps) and activities flow server-side:
Garmin watch → Garmin Connect → intervals.icu → `/api/cron/intervals-sync`
→ Supabase canonical tables. Requires `INTERVALS_ICU_ATHLETE_ID`,
`INTERVALS_ICU_API_KEY`, and `TRAINELO_USER_ID` env vars.

Manual sync / backfill:

```sh
npx tsx scripts/intervals-backfill.ts --days 7            # last week
npx tsx scripts/intervals-backfill.ts --days 30 --dry-run # preview
```

The legacy local Garmin scraper (unofficial API + Windows Task Scheduler) has
been retired and removed; intervals.icu is now the sole data source.

## Deployment

Auto-deploys to Vercel on push to `main`.
