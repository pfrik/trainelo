-- ============================================================================
-- Migration: Create Trust & Audit Layer Tables
-- Description: Append-only audit log for threshold changes and recommendation tracking
-- ============================================================================

-- ============================================================================
-- Table: calibration_events
-- Purpose: Append-only audit log for threshold changes (supports undo/lock/cooldown)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.calibration_events (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'system',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Event type
    event_type TEXT NOT NULL CHECK (event_type IN (
        'threshold_created',
        'threshold_updated',
        'threshold_deleted',
        'threshold_locked',
        'threshold_unlocked',
        'auto_calibration',
        'manual_override',
        'undo_request',
        'cooldown_started',
        'cooldown_ended'
    )),

    -- Reference to threshold (nullable for some event types)
    threshold_id UUID REFERENCES public.user_thresholds(id) ON DELETE SET NULL,
    threshold_type TEXT NOT NULL,

    -- Previous and new values for tracking changes
    previous_value JSONB,
    new_value JSONB,

    -- Change metadata
    change_reason TEXT,
    change_trigger TEXT, -- 'user_request', 'scheduled_recalibration', 'fitness_test', 'auto_detect'

    -- Confidence tracking
    confidence_before TEXT,
    confidence_after TEXT,
    data_points_used INTEGER, -- Number of data points used in calculation

    -- Undo support
    is_undoable BOOLEAN NOT NULL DEFAULT false,
    undo_deadline TIMESTAMPTZ, -- After this, undo is no longer available
    was_undone BOOLEAN NOT NULL DEFAULT false,
    undone_at TIMESTAMPTZ,
    undo_event_id UUID REFERENCES public.calibration_events(id),

    -- Cooldown tracking
    cooldown_ends_at TIMESTAMPTZ,
    cooldown_reason TEXT,

    -- Actor tracking
    actor_type TEXT CHECK (actor_type IN ('user', 'system', 'coach', 'api')),
    actor_id TEXT, -- Could be user_id, 'cron_job', 'garmin_webhook', etc.

    -- Notes
    notes TEXT,

    -- Extended data
    metadata JSONB DEFAULT '{}'
);

COMMENT ON TABLE public.calibration_events IS 'Append-only audit log for all threshold calibration changes';
COMMENT ON COLUMN public.calibration_events.event_type IS 'Type of calibration event that occurred';
COMMENT ON COLUMN public.calibration_events.is_undoable IS 'Whether this change can still be undone';
COMMENT ON COLUMN public.calibration_events.undo_deadline IS 'After this timestamp, undo option expires';
COMMENT ON COLUMN public.calibration_events.cooldown_ends_at IS 'If set, prevents auto-recalibration until this time';

-- ============================================================================
-- Table: recommendation_events
-- Purpose: Stores recommendations shown, user choices, and outcomes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recommendation_events (
    -- Canonical columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'system',
    source_ref TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Recommendation identification
    recommendation_type TEXT NOT NULL, -- 'daily_workout', 'recovery_day', 'intensity_adjustment', etc.
    recommendation_date DATE NOT NULL, -- The date this recommendation is for

    -- Recommendation details
    recommendation_summary TEXT NOT NULL, -- Human-readable summary
    recommendation_data JSONB NOT NULL, -- Full structured recommendation

    -- Algorithm info for debugging/improvement
    algorithm_version TEXT,
    algorithm_inputs JSONB, -- What data was used to generate this
    confidence_score NUMERIC(4, 3), -- 0.000 to 1.000

    -- Alternatives offered
    alternatives_shown JSONB, -- Array of alternative options shown to user

    -- User response tracking
    shown_at TIMESTAMPTZ,
    response_at TIMESTAMPTZ,
    response_type TEXT CHECK (response_type IN (
        'accepted',
        'modified',
        'rejected',
        'ignored',
        'deferred',
        'not_shown'
    )),
    user_choice JSONB, -- What the user actually selected/modified

    -- Feedback
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,

    -- Outcome tracking
    outcome_recorded_at TIMESTAMPTZ,
    outcome_type TEXT CHECK (outcome_type IN (
        'completed_as_recommended',
        'completed_modified',
        'partially_completed',
        'not_completed',
        'better_than_expected',
        'worse_than_expected',
        'pending'
    )),
    outcome_data JSONB, -- Actual workout/day data for comparison

    -- Linkage to actual workout if applicable
    workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,

    -- Learning signals
    was_good_recommendation BOOLEAN, -- Post-hoc assessment
    learning_signals JSONB, -- Data for algorithm improvement

    -- Extended metadata
    metadata JSONB DEFAULT '{}'
);

COMMENT ON TABLE public.recommendation_events IS 'Tracks recommendations shown to users and their outcomes';
COMMENT ON COLUMN public.recommendation_events.recommendation_type IS 'Type: daily_workout, recovery_day, intensity_adjustment, schedule_change';
COMMENT ON COLUMN public.recommendation_events.algorithm_inputs IS 'Snapshot of inputs used to generate recommendation';
COMMENT ON COLUMN public.recommendation_events.response_type IS 'How user responded: accepted, modified, rejected, ignored, deferred';
COMMENT ON COLUMN public.recommendation_events.outcome_type IS 'What actually happened after the recommendation';
COMMENT ON COLUMN public.recommendation_events.was_good_recommendation IS 'Post-hoc assessment for algorithm learning';
