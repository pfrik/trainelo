# Morning Check-in v2 — Single Source of Truth

> Status: **Phase 2 complete** (schema + calibrator core + API wiring).
> Phase 3: Dashboard UI flow.

---

## Overview

The morning check-in collects subjective signals before training. These signals feed
a **deterministic calibrator** that adjusts the planned session's intensity and duration,
produces a traffic-light level, and optionally suggests a session swap.

The calibrator is **pure** (no IO, no DB, no fetch) and lives in `src/lib/core/checkin/`.

---

## Database Schema

Table: `public.daily_checkins` (one row per user per date).

### Existing columns (v1)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID FK → auth.users | NOT NULL, CASCADE |
| `date` | DATE | NOT NULL |
| `mood` | TEXT | `IN ('drained','tired','okay','good','great')` NOT NULL |
| `rpe` | INTEGER | 1–10, nullable |
| `soreness` | INTEGER | 0–10, nullable |
| `pain_flag` | BOOLEAN | DEFAULT false |
| `illness_flag` | BOOLEAN | DEFAULT false |
| `notes` | TEXT | nullable |
| `source` | TEXT | DEFAULT 'app' |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |
| `updated_at` | TIMESTAMPTZ | DEFAULT now(), auto-trigger |

Unique: `(user_id, date)`.

### v2 columns (migration `20260213010000`)

| Column | Type | Constraint |
|---|---|---|
| `reason_bucket` | TEXT | `IN ('sick','hurt','fried','none')` |
| `reason_tags` | JSONB | DEFAULT `'[]'` |
| `sleep_quality` | INTEGER | 1–5 |
| `perceived_energy` | INTEGER | 1–5 |
| `motivation` | INTEGER | 1–5 |
| `life_stress` | INTEGER | 1–5 |
| `pain_severity` | INTEGER | 0–10 |
| `pain_locations` | JSONB | DEFAULT `'[]'` |
| `time_constraint_minutes` | INTEGER | > 0 |
| `checkin_version` | INTEGER | NOT NULL DEFAULT 1 |
| `payload` | JSONB | NOT NULL DEFAULT `'{}'` |

### v2 constraints

1. `chk_drained_requires_reason_bucket`: if `mood = 'drained'` then `reason_bucket IS NOT NULL`.
2. `chk_hurt_requires_pain_detail`: if `reason_bucket = 'hurt'` then `pain_severity > 0` AND `jsonb_array_length(pain_locations) >= 1`.

### v2 index

- `idx_daily_checkins_date` on `(date DESC)`.

---

## Calibrator Module

Path: `src/lib/core/checkin/calibrator.ts`

### Types

```
Mood5            = 'drained' | 'tired' | 'okay' | 'good' | 'great'
WearableReadiness = 'red' | 'yellow' | 'green'
ReasonBucket     = 'sick' | 'hurt' | 'fried' | 'none'
CalibrationLevel = 'red' | 'amber' | 'green' | 'upgrade'

SwapSuggestion   = 'rest' | 'recovery' | 'easy' | 'mobility'
                 | 'cross_train' | 'injury_safe' | 'as_planned' | 'harder_variant'
```

### Inputs

- `CheckinInput` — subjective morning fields (mood, rpe, soreness, flags, reason_bucket, pain detail, scales, time constraint).
- `PlannedSessionInput` — `{ planned_duration_minutes, planned_intensity }`.
- `WearableSignalsInput` — `{ readiness, readiness_score?, fatigue_score? }`.
- `CalibratorInput` — combines all three (each nullable).

### Output: `CalibrationResult`

| Field | Type |
|---|---|
| `level` | CalibrationLevel |
| `intensity_multiplier` | number |
| `duration_multiplier` | number |
| `swap_to` | SwapSuggestion |
| `headline` | string |
| `rationale` | string |
| `applied_rules` | string[] |
| `warnings` | string[] |
| `checkin_readiness_delta` | number |
| `checkin_fatigue_delta` | number |

### Delta constants (SSOT)

| Signal | Readiness | Fatigue |
|---|---|---|
| drained | -15 | +15 |
| tired | -8 | +8 |
| okay | 0 | 0 |
| good | +5 | -5 |
| great | +5 | -5 |
| rpe >= 8 | — | +8 |
| soreness >= 7 | — | +8 |
| pain_flag | -15 | +12 |
| illness_flag | -20 | +15 |

### Hard-stop rules (safety overrides)

Any of the following forces `level = 'red'`, intensity 0.65, duration 0.65:

| Trigger | Swap to |
|---|---|
| `illness_flag = true` | rest |
| `reason_bucket = 'sick'` | rest |
| `reason_bucket = 'hurt'` AND `pain_severity >= 7` | injury_safe |
| `fatigue_score >= 85` (wearable) | mobility |

### Wearable readiness gating (great mood)

| Wearable | Level | Intensity cap |
|---|---|---|
| green | upgrade | 1.10 |
| yellow | green | 1.05 |
| red | green | 1.00 (warning) |
| absent | green | 1.00 |

### Calibration level baselines

| Level | Intensity | Duration |
|---|---|---|
| red (drained/hard-stop) | 0.70 | 0.75 |
| amber (tired/okay) | 0.85–0.95 | 0.90–0.95 |
| green (good) | 1.00 | 1.00 |
| upgrade (great + green) | 1.10 | 1.05 |

### Multiplier clamp ranges

- Intensity: [0.50, 1.15]
- Duration: [0.50, 1.05]

### Time constraint

If `time_constraint_minutes` is provided and planned session has `planned_duration_minutes`:
- `duration_multiplier = min(current, time_constraint / planned_duration)`
- Rule: `TIME_CONSTRAINT_APPLIED`

### Additional reductions

- RPE >= 8 (non-drained): caps intensity at 0.90.
- Soreness >= 7 (non-drained): caps intensity at 0.90.

---

## Exports

```typescript
import { calibrateSession, computeCheckinDeltas } from "@/lib/core/checkin";
```

All types are re-exported from `src/lib/core/checkin/index.ts`.

---

## Phase roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Schema migration + calibrator module + tests | Done |
| 2 | API wiring (`/api/checkin/calibrate`) + updated `/api/user-flags` | Done |
| 3 | Dashboard UI flow (stepped check-in form) | Planned |
| 4 | Integration with recommendation pipeline | Planned |
