-- ============================================================================
-- Migration: Create daily_training_load view and daily_recommendations table
-- Description: Aggregated workout view + recommendation storage for cron endpoint
-- ============================================================================

-- ============================================================================
-- View: daily_training_load
-- Purpose: Aggregate workouts per user/source/date for training load analysis
-- ============================================================================
CREATE OR REPLACE VIEW public.daily_training_load
WITH (security_invoker = true)
AS
SELECT
    w.user_id,
    w.source,
    (w.started_at AT TIME ZONE 'UTC')::date AS date,
    COUNT(*)::integer                                   AS workouts_count,
    COALESCE(SUM(w.duration_seconds), 0)::bigint        AS total_duration_seconds,
    COALESCE(SUM(w.distance_meters), 0)::numeric(14,2)  AS total_distance_meters,
    COALESCE(SUM(w.training_stress_score), 0)::numeric(10,2) AS total_tss
FROM public.workouts w
GROUP BY w.user_id, w.source, (w.started_at AT TIME ZONE 'UTC')::date;

COMMENT ON VIEW public.daily_training_load IS 'Aggregated daily workout metrics grouped by user, source, and date';

-- ============================================================================
-- Table: daily_recommendations
-- Purpose: Stores daily training recommendations produced by the cron job
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    source TEXT NOT NULL DEFAULT 'trainelo',
    decision TEXT NOT NULL,
    workout_ref TEXT,
    confidence NUMERIC(4,2) NOT NULL DEFAULT 0
        CHECK (confidence >= 0 AND confidence <= 1),
    rationale TEXT,
    evidence JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Upsert target for cron endpoint
    CONSTRAINT daily_recommendations_user_date_unique UNIQUE (user_id, date)
);

COMMENT ON TABLE public.daily_recommendations IS 'Daily training recommendations produced by cron/daily-recommendations';
COMMENT ON COLUMN public.daily_recommendations.source IS 'Algorithm source, e.g. trainelo';
COMMENT ON COLUMN public.daily_recommendations.decision IS 'Recommendation decision: train_hard, train_easy, active_recovery, rest';
COMMENT ON COLUMN public.daily_recommendations.workout_ref IS 'Reference to suggested workout type: scheduled, lite_alternative, or null';
COMMENT ON COLUMN public.daily_recommendations.confidence IS 'Confidence score 0.00–1.00';
COMMENT ON COLUMN public.daily_recommendations.evidence IS 'Structured JSON evidence used to compute the recommendation';

-- ============================================================================
-- Indexes for daily_recommendations
-- ============================================================================

-- Lookup by user + date range (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_daily_recommendations_user_date
ON public.daily_recommendations (user_id, date DESC);

-- Date-only index for cron batch queries
CREATE INDEX IF NOT EXISTS idx_daily_recommendations_date
ON public.daily_recommendations (date DESC);

-- ============================================================================
-- Updated_at trigger for daily_recommendations
-- (reuses existing set_updated_at function from 20260111050000)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_daily_recommendations_updated_at ON public.daily_recommendations;
CREATE TRIGGER trg_daily_recommendations_updated_at
    BEFORE UPDATE ON public.daily_recommendations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS: daily_recommendations
-- ============================================================================
ALTER TABLE public.daily_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own recommendations" ON public.daily_recommendations;
CREATE POLICY "Users can view their own recommendations"
    ON public.daily_recommendations FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own recommendations" ON public.daily_recommendations;
CREATE POLICY "Users can create their own recommendations"
    ON public.daily_recommendations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own recommendations" ON public.daily_recommendations;
CREATE POLICY "Users can update their own recommendations"
    ON public.daily_recommendations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own recommendations" ON public.daily_recommendations;
CREATE POLICY "Users can delete their own recommendations"
    ON public.daily_recommendations FOR DELETE
    USING (auth.uid() = user_id);
