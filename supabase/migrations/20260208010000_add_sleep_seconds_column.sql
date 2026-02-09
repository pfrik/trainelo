-- ============================================================================
-- Migration: Add sleep_seconds column to sleep_sessions
-- Description: Stores actual sleep time (excluding awake periods).
--   duration_seconds (generated) = total time in bed.
--   sleep_seconds = time actually asleep.
-- ============================================================================

ALTER TABLE public.sleep_sessions
    ADD COLUMN IF NOT EXISTS sleep_seconds INTEGER;

COMMENT ON COLUMN public.sleep_sessions.sleep_seconds
    IS 'Actual sleep time in seconds (excluding awake periods). Differs from duration_seconds which is total time in bed.';
