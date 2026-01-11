-- ============================================================================
-- Migration: Create User Configuration Tables
-- Description: User flags, preferences, and personal thresholds
-- ============================================================================

-- ============================================================================
-- Table: user_flags
-- Purpose: Feature flags per user (AB tests, beta features, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_flags (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'system',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Flag data
    flag_key TEXT NOT NULL,
    flag_value BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    enabled_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Optional expiration for time-limited flags
    reason TEXT, -- Why this flag was enabled/disabled

    -- Constraints
    CONSTRAINT user_flags_unique_key UNIQUE (user_id, flag_key)
);

COMMENT ON TABLE public.user_flags IS 'Feature flags per user for AB tests, beta features, etc.';
COMMENT ON COLUMN public.user_flags.flag_key IS 'Flag identifier: beta_new_dashboard, ab_algo_v2, etc.';
COMMENT ON COLUMN public.user_flags.expires_at IS 'Optional auto-expiration for time-limited features';

-- ============================================================================
-- Table: user_preferences
-- Purpose: User settings (units, notifications, display preferences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unit preferences
    distance_unit TEXT NOT NULL DEFAULT 'km' CHECK (distance_unit IN ('km', 'mi')),
    weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
    temperature_unit TEXT NOT NULL DEFAULT 'celsius' CHECK (temperature_unit IN ('celsius', 'fahrenheit')),
    pace_unit TEXT NOT NULL DEFAULT 'min_per_km' CHECK (pace_unit IN ('min_per_km', 'min_per_mi')),

    -- Locale
    timezone TEXT NOT NULL DEFAULT 'UTC',
    locale TEXT NOT NULL DEFAULT 'en',
    week_start_day INTEGER NOT NULL DEFAULT 1 CHECK (week_start_day >= 0 AND week_start_day <= 6), -- 0=Sunday, 1=Monday

    -- Notification preferences
    notify_daily_recommendation BOOLEAN NOT NULL DEFAULT true,
    notify_weekly_summary BOOLEAN NOT NULL DEFAULT true,
    notify_recovery_alerts BOOLEAN NOT NULL DEFAULT true,
    notify_goal_progress BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_start TIME,
    quiet_hours_end TIME,

    -- Display preferences
    dashboard_layout TEXT DEFAULT 'default',
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    show_raw_metrics BOOLEAN NOT NULL DEFAULT false,

    -- Privacy
    share_workouts_publicly BOOLEAN NOT NULL DEFAULT false,
    allow_coach_access BOOLEAN NOT NULL DEFAULT false,

    -- Extended preferences as JSONB for flexibility
    extended_prefs JSONB DEFAULT '{}',

    -- Constraints
    CONSTRAINT user_preferences_one_per_user UNIQUE (user_id)
);

COMMENT ON TABLE public.user_preferences IS 'User settings for units, notifications, and display preferences';
COMMENT ON COLUMN public.user_preferences.week_start_day IS '0=Sunday, 1=Monday, etc.';
COMMENT ON COLUMN public.user_preferences.extended_prefs IS 'JSONB for additional preferences without schema changes';

-- ============================================================================
-- Table: user_thresholds
-- Purpose: Personal thresholds for metrics (HR zones, HRV baseline, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_thresholds (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Threshold identification
    threshold_type TEXT NOT NULL, -- 'hr_zone', 'hrv_baseline', 'resting_hr', 'ftp', etc.

    -- Single value thresholds
    value_numeric NUMERIC(12, 4),
    value_unit TEXT,

    -- Range thresholds (e.g., HR zones)
    value_min NUMERIC(12, 4),
    value_max NUMERIC(12, 4),

    -- Complex thresholds as JSONB
    value_json JSONB, -- For multi-value thresholds like full HR zone set

    -- Validity
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE, -- NULL means currently active

    -- Confidence and calibration
    confidence_level TEXT CHECK (confidence_level IN ('low', 'medium', 'high', 'verified')),
    last_calibrated_at TIMESTAMPTZ,
    calibration_method TEXT, -- 'manual', 'auto_7d_avg', 'fitness_test', etc.

    -- Lock status (for trust layer)
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ,
    locked_reason TEXT,
    lock_expires_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,

    -- Constraints - allow multiple thresholds of same type with different effective dates
    CONSTRAINT user_thresholds_no_overlap UNIQUE (user_id, threshold_type, effective_from)
);

COMMENT ON TABLE public.user_thresholds IS 'Personal thresholds for metrics (HR zones, HRV baseline, FTP, etc.)';
COMMENT ON COLUMN public.user_thresholds.threshold_type IS 'Type: hr_max, hr_zones, hrv_baseline, resting_hr, ftp, lactate_threshold, etc.';
COMMENT ON COLUMN public.user_thresholds.value_json IS 'For complex thresholds like HR zones: {"z1": [0,120], "z2": [120,140], ...}';
COMMENT ON COLUMN public.user_thresholds.is_locked IS 'When true, threshold cannot be auto-updated (user override)';
COMMENT ON COLUMN public.user_thresholds.calibration_method IS 'How this threshold was determined: manual, auto_7d_avg, fitness_test';
