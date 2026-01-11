-- ============================================================================
-- Migration: Create Canonical Training Data Tables
-- Description: Core time-series tables for workouts, daily metrics, sleep, and HRV
-- ============================================================================

-- Note: This migration creates NEW canonical tables with standardized columns.
-- Existing tables (daily_metrics, workout_completions) from previous migrations
-- remain unchanged - they can be deprecated/migrated separately.

-- ============================================================================
-- Table: workouts
-- Purpose: Completed workout sessions from any source (Garmin, manual, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workouts (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Workout-specific columns
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    activity_type TEXT NOT NULL, -- 'running', 'cycling', 'swimming', 'strength', etc.
    activity_subtype TEXT, -- 'interval', 'tempo', 'easy', 'race', etc.

    -- Distance and pace
    distance_meters NUMERIC(12, 2),
    elevation_gain_meters NUMERIC(8, 2),
    elevation_loss_meters NUMERIC(8, 2),

    -- Heart rate
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    min_heart_rate INTEGER,

    -- Power (cycling)
    avg_power_watts INTEGER,
    max_power_watts INTEGER,
    normalized_power_watts INTEGER,

    -- Cadence
    avg_cadence INTEGER,
    max_cadence INTEGER,

    -- Training metrics
    training_stress_score NUMERIC(8, 2),
    intensity_factor NUMERIC(5, 3),
    calories INTEGER,

    -- Subjective data
    perceived_exertion INTEGER CHECK (perceived_exertion >= 1 AND perceived_exertion <= 10),
    feeling_score INTEGER CHECK (feeling_score >= 1 AND feeling_score <= 5),

    -- Weather (if available)
    temperature_celsius NUMERIC(5, 2),
    humidity_percent INTEGER,

    -- Notes and raw data
    title TEXT,
    notes TEXT,
    raw_data JSONB, -- Store full source payload for debugging/reprocessing

    -- Constraints
    CONSTRAINT workouts_valid_duration CHECK (duration_seconds >= 0),
    CONSTRAINT workouts_valid_distance CHECK (distance_meters >= 0)
);

COMMENT ON TABLE public.workouts IS 'Canonical table for completed workout sessions from all sources';
COMMENT ON COLUMN public.workouts.source IS 'Data source: garmin, strava, manual, coach, etc.';
COMMENT ON COLUMN public.workouts.source_ref IS 'External ID from source system for deduplication';
COMMENT ON COLUMN public.workouts.schema_version IS 'Schema version for data migrations';
COMMENT ON COLUMN public.workouts.raw_data IS 'Full source payload preserved for debugging/reprocessing';

-- ============================================================================
-- Table: canonical_daily_metrics
-- Purpose: Daily aggregated metrics (steps, calories, stress, etc.)
-- Note: Named canonical_daily_metrics to avoid conflict with existing daily_metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.canonical_daily_metrics (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Date (the day these metrics apply to)
    date DATE NOT NULL,

    -- Activity metrics
    steps INTEGER,
    floors_climbed INTEGER,
    active_calories INTEGER,
    total_calories INTEGER,
    active_minutes INTEGER,
    sedentary_minutes INTEGER,

    -- Body metrics
    weight_kg NUMERIC(5, 2),
    body_fat_percent NUMERIC(4, 2),
    muscle_mass_kg NUMERIC(5, 2),
    body_water_percent NUMERIC(4, 2),

    -- Vitals
    resting_heart_rate INTEGER,
    max_heart_rate_observed INTEGER,
    blood_oxygen_avg NUMERIC(4, 2),
    respiration_rate NUMERIC(4, 2),

    -- Recovery and stress
    stress_avg INTEGER CHECK (stress_avg >= 0 AND stress_avg <= 100),
    stress_max INTEGER CHECK (stress_max >= 0 AND stress_max <= 100),
    body_battery_high INTEGER CHECK (body_battery_high >= 0 AND body_battery_high <= 100),
    body_battery_low INTEGER CHECK (body_battery_low >= 0 AND body_battery_low <= 100),
    recovery_score INTEGER CHECK (recovery_score >= 0 AND recovery_score <= 100),

    -- Subjective inputs
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    soreness_level INTEGER CHECK (soreness_level >= 0 AND soreness_level <= 10),

    -- Notes
    notes TEXT,

    -- Raw data for debugging
    raw_data JSONB
);

COMMENT ON TABLE public.canonical_daily_metrics IS 'Daily aggregated health and fitness metrics from all sources';
COMMENT ON COLUMN public.canonical_daily_metrics.date IS 'The calendar date these metrics apply to';
COMMENT ON COLUMN public.canonical_daily_metrics.stress_avg IS 'Average stress score (0-100) from wearable';
COMMENT ON COLUMN public.canonical_daily_metrics.body_battery_high IS 'Garmin Body Battery highest value for the day';

-- ============================================================================
-- Table: sleep_sessions
-- Purpose: Sleep tracking data with optional sleep stages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sleep_sessions (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Sleep timing
    sleep_start TIMESTAMPTZ NOT NULL,
    sleep_end TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (sleep_end - sleep_start))::INTEGER
    ) STORED,

    -- The calendar date this sleep is attributed to (typically the wake date)
    date DATE NOT NULL,

    -- Sleep stages (in seconds)
    awake_seconds INTEGER,
    light_seconds INTEGER,
    deep_seconds INTEGER,
    rem_seconds INTEGER,

    -- Sleep quality metrics
    sleep_score INTEGER CHECK (sleep_score >= 0 AND sleep_score <= 100),
    efficiency_percent NUMERIC(5, 2),
    latency_seconds INTEGER, -- Time to fall asleep
    awakenings INTEGER, -- Number of times woken up

    -- Biometrics during sleep
    avg_heart_rate INTEGER,
    min_heart_rate INTEGER,
    avg_respiration_rate NUMERIC(4, 2),
    avg_blood_oxygen NUMERIC(4, 2),
    avg_stress INTEGER,

    -- HRV during sleep (some devices report this separately)
    avg_hrv_ms NUMERIC(6, 2),

    -- Subjective
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    notes TEXT,

    -- Raw data
    raw_data JSONB,

    -- Constraints
    CONSTRAINT sleep_sessions_valid_times CHECK (sleep_end > sleep_start)
);

COMMENT ON TABLE public.sleep_sessions IS 'Sleep sessions with stages and quality metrics';
COMMENT ON COLUMN public.sleep_sessions.date IS 'Calendar date attributed to this sleep (usually wake date)';
COMMENT ON COLUMN public.sleep_sessions.sleep_score IS 'Overall sleep score (0-100) from wearable algorithm';
COMMENT ON COLUMN public.sleep_sessions.efficiency_percent IS 'Time asleep / time in bed * 100';

-- ============================================================================
-- Table: hrv_nights
-- Purpose: Nightly HRV readings (separate from sleep for granularity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hrv_nights (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- The night this HRV reading applies to
    date DATE NOT NULL,

    -- HRV metrics
    hrv_rmssd NUMERIC(6, 2), -- Root Mean Square of Successive Differences (most common)
    hrv_sdrr NUMERIC(6, 2), -- Standard Deviation of RR intervals
    hrv_baseline NUMERIC(6, 2), -- User's rolling baseline
    hrv_status TEXT CHECK (hrv_status IN ('low', 'normal', 'elevated', 'unknown')),

    -- Measurement window
    measurement_start TIMESTAMPTZ,
    measurement_end TIMESTAMPTZ,
    reading_count INTEGER, -- Number of readings averaged

    -- Additional metrics some devices provide
    avg_heart_rate INTEGER,
    respiratory_rate NUMERIC(4, 2),

    -- Weekly/monthly context
    weekly_avg NUMERIC(6, 2),
    seven_day_change_percent NUMERIC(6, 2),

    -- Notes
    notes TEXT,

    -- Raw data
    raw_data JSONB
);

COMMENT ON TABLE public.hrv_nights IS 'Nightly HRV readings for recovery tracking';
COMMENT ON COLUMN public.hrv_nights.hrv_rmssd IS 'RMSSD in milliseconds - primary HRV metric';
COMMENT ON COLUMN public.hrv_nights.hrv_baseline IS 'User personal HRV baseline for comparison';
COMMENT ON COLUMN public.hrv_nights.hrv_status IS 'Interpretation: low/normal/elevated relative to baseline';
