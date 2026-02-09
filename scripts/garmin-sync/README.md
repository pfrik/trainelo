# Garmin Sync Script

Python script to sync data from Garmin Connect to Trainelo's Supabase database.

## Overview

This script fetches the following data from Garmin Connect:
- **Activities** → `workouts` table
- **Daily Summaries** → `canonical_daily_metrics` table
- **Sleep Data** → `sleep_sessions` table
- **HRV Data** → `hrv_nights` table

Raw JSON payloads are stored in Supabase Storage (`raw-payloads` bucket) before transformation for debugging and reprocessing capabilities.

## Prerequisites

- Python 3.10+
- A Garmin Connect account
- Supabase project with the canonical schema migrations applied

## Setup

### 1. Create a virtual environment

```bash
cd scripts/garmin-sync
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in the `scripts/garmin-sync` directory:

```env
# Garmin Connect credentials
GARMIN_EMAIL=your-garmin-email@example.com
GARMIN_PASSWORD=your-garmin-password

# Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Your Trainelo user ID (UUID from auth.users)
TRAINELO_USER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional: Skip blob storage (for local dev without storage service)
# SKIP_BLOB_STORAGE=true
```

**Important:**
- Use the **Service Role Key** (not the anon key) from Supabase Dashboard → Settings → API
- The `TRAINELO_USER_ID` is your user UUID from the `auth.users` table

## Usage

### Dry Run (Preview)

Test what would be synced without writing any data:

```bash
python sync.py --dry-run
```

### Incremental Sync (Default)

Sync the last 7 days of data:

```bash
python sync.py
```

### Full Sync

Sync the last 365 days (useful for initial setup):

```bash
python sync.py --full
```

### Custom Date Range

Sync a specific number of days:

```bash
python sync.py --days 30
```

### Sync Specific Data Type

Sync only one type of data:

```bash
python sync.py --type activities
python sync.py --type daily_summary
python sync.py --type sleep
python sync.py --type hrv
```

### Combined Options

```bash
# Dry run of full activities sync
python sync.py --full --type activities --dry-run

# Last 14 days of sleep and HRV
python sync.py --days 14 --type sleep
python sync.py --days 14 --type hrv
```

## MFA / Two-Factor Authentication

If your Garmin account has MFA enabled:

1. The first run may prompt you to enter a verification code
2. The `garminconnect` library caches the session token in `~/.garminconnect`
3. Subsequent runs should work without MFA until the token expires

If you encounter authentication issues:
```bash
# Clear cached session
rm -rf ~/.garminconnect

# Re-run the script (will prompt for MFA)
python sync.py --dry-run
```

## Data Transformations

### Activities → Workouts

| Garmin Field | Canonical Field |
|--------------|-----------------|
| `activityId` | `source_ref` |
| `activityType.typeKey` | `activity_type` |
| `activityName` | `title` |
| `startTimeGMT` | `started_at` |
| `duration` | `duration_seconds` |
| `distance` | `distance_meters` |
| `calories` | `calories` |
| `averageHR` | `avg_heart_rate` |
| `maxHR` | `max_heart_rate` |
| `elevationGain` | `elevation_gain_meters` |

### Daily Summary → Canonical Daily Metrics

| Garmin Field | Canonical Field |
|--------------|-----------------|
| `calendarDate` | `date` |
| `totalSteps` | `steps` |
| `totalKilocalories` | `total_calories` |
| `activeKilocalories` | `active_calories` |
| `restingHeartRate` | `resting_heart_rate` |
| `averageStressLevel` | `stress_avg` |
| `bodyBatteryHighestValue` | `body_battery_high` |
| `bodyBatteryLowestValue` | `body_battery_low` |

### Sleep → Sleep Sessions

| Garmin Field | Canonical Field |
|--------------|-----------------|
| `dailySleepDTO.id` | `source_ref` |
| `dailySleepDTO.calendarDate` | `date` |
| `sleepStartTimestampGMT` | `sleep_start` |
| `sleepEndTimestampGMT` | `sleep_end` |
| `sleepTimeSeconds` | `duration_seconds` |
| `deepSleepSeconds` | `deep_seconds` |
| `lightSleepSeconds` | `light_seconds` |
| `remSleepSeconds` | `rem_seconds` |
| `sleepScores.overall` | `sleep_score` |

### HRV → HRV Nights

| Garmin Field | Canonical Field |
|--------------|-----------------|
| `hrvSummary.calendarDate` | `date` |
| `hrvSummary.lastNightAvg` | `hrv_rmssd` |
| `hrvSummary.weeklyAvg` | `weekly_avg` |
| `hrvSummary.baseline` | `hrv_baseline` |
| `hrvSummary.status` | `hrv_status` |

## Idempotent Upserts

All data is upserted using unique constraints:
- `workouts`: `(user_id, source, source_ref)`
- `canonical_daily_metrics`: `(user_id, source, date)`
- `sleep_sessions`: `(user_id, source, source_ref)`
- `hrv_nights`: `(user_id, source, date)`

This means you can safely re-run the sync multiple times without creating duplicates.

## Raw Payload Storage

Raw JSON payloads are stored in Supabase Storage before transformation:

```
raw-payloads/
└── raw/
    └── garmin/
        └── {user_id}/
            └── {yyyy-mm-dd}/
                ├── activities_{activity_id}_{hash}.json
                ├── daily_summary_daily_{date}_{hash}.json
                ├── sleep_{sleep_id}_{hash}.json
                └── hrv_hrv_{date}_{hash}.json
```

The hash ensures that identical payloads result in the same filename (idempotent storage).

## Troubleshooting

### "Authentication failed"
- Verify your Garmin email and password
- Check if MFA is enabled and follow the MFA instructions above
- Try clearing the session cache: `rm -rf ~/.garminconnect`

### "Missing required environment variables"
- Ensure `.env` file exists in `scripts/garmin-sync/`
- Check that all required variables are set

### "Rate limit exceeded"
- The script has built-in rate limiting (1 second between requests)
- If you still hit limits, wait a few minutes and try again
- Consider syncing fewer days or one data type at a time

### "Permission denied" on Supabase
- Verify you're using the Service Role Key (not anon key)
- Check that migrations have been applied to create the tables
- Ensure RLS policies allow service role access

### Storage service unavailable (503)
If running local Supabase without the storage service (e.g., due to Windows port conflicts):

1. Set `SKIP_BLOB_STORAGE=true` in your `.env` file to explicitly skip blob storage
2. Alternatively, the sync will auto-detect 503 errors and continue without storing raw payloads
3. Data will still sync to the canonical database tables
4. A warning will be logged: "Blob storage unavailable or skipped"

This is useful for local development where only the database tables are needed.

## Verification

After running a 14-day sync:

```bash
python sync.py --days 14
```

Use these SQL queries (Supabase SQL Editor or `psql`) to confirm data is populated:

### Sleep sessions: sleep_score and sleep_seconds

```sql
SELECT date, sleep_score, sleep_seconds,
       round(sleep_seconds / 3600.0, 1) AS sleep_hours,
       avg_hrv_ms, avg_heart_rate
  FROM sleep_sessions
 WHERE user_id = '<YOUR_USER_ID>'
   AND date >= current_date - interval '14 days'
 ORDER BY date DESC;
```

### Daily metrics (MVP table): hrv_ms and resting_heart_rate

```sql
SELECT date, hrv_ms, resting_heart_rate, sleep_hours, sleep_quality
  FROM daily_metrics
 WHERE user_id = '<YOUR_USER_ID>'
   AND date >= current_date - interval '14 days'
 ORDER BY date DESC;
```

### HRV nights (detailed)

```sql
SELECT date, hrv_rmssd, weekly_avg, hrv_status
  FROM hrv_nights
 WHERE user_id = '<YOUR_USER_ID>'
   AND date >= current_date - interval '14 days'
 ORDER BY date DESC;
```

### Quick NULL check across all tables

```sql
SELECT 'sleep_sessions' AS tbl,
       count(*) AS rows,
       count(sleep_score) AS has_score,
       count(sleep_seconds) AS has_seconds
  FROM sleep_sessions
 WHERE user_id = '<YOUR_USER_ID>'
   AND date >= current_date - interval '14 days'
UNION ALL
SELECT 'daily_metrics',
       count(*),
       count(hrv_ms),
       count(resting_heart_rate)
  FROM daily_metrics
 WHERE user_id = '<YOUR_USER_ID>'
   AND date >= current_date - interval '14 days';
```

## Development

### Project Structure

```
scripts/garmin-sync/
├── requirements.txt       # Python dependencies
├── config.py              # Configuration and environment loading
├── sync.py                # Main entry point
├── garmin_client.py       # Garmin Connect API wrapper
├── supabase_client.py     # Supabase database client
├── blob_storage.py        # Raw payload storage
├── transformers/
│   ├── __init__.py
│   ├── activities.py      # Activity → Workout transformer
│   ├── daily_summary.py   # Daily summary → Metrics transformer
│   ├── sleep.py           # Sleep → Sleep session transformer
│   └── hrv.py             # HRV → HRV night transformer
└── README.md
```

### Adding New Data Types

1. Add the data type to `DATA_TYPES` in `config.py`
2. Create a new transformer in `transformers/`
3. Add fetch method in `garmin_client.py`
4. Add upsert method in `supabase_client.py`
5. Add sync method in `sync.py`

## License

Part of the Trainelo project.
