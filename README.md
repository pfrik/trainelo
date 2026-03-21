# Trainelo

Deterministic daily training recommendation engine powered by Garmin wearable data. Ingests HRV, sleep, training load, and recovery signals to produce personalized workout recommendations with full confidence scoring and audit trail.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Vercel serverless functions (TypeScript)
- **Database**: Supabase (PostgreSQL + RLS)
- **Data sync**: Garmin Connect via GitHub Actions (every 6 hours)
- **Cron**: Daily recommendation generation (5:00 UTC), Garmin sync trigger (4:00 UTC)

## Core Pipeline

```
Garmin Sync → DB Ingestion → Readiness/Fatigue Scoring → Anomaly Detection
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

## Garmin Sync

Tokens are managed automatically — each successful sync refreshes the `GARMIN_TOKENS_BASE64` GitHub secret. Manual token refresh if needed:

```sh
cd scripts/garmin-sync
python sync.py --days 1
python export_tokens.py
```

## Deployment

Auto-deploys to Vercel on push to `main`.
