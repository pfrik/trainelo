-- ============================================================================
-- Migration: Create Indexes and Triggers
-- Description: Idempotency indexes, query optimization, and updated_at triggers
-- ============================================================================

-- ============================================================================
-- IDEMPOTENCY INDEXES (Unique constraints for upsert operations)
-- ============================================================================

-- Workouts: Prevent duplicate imports from same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_idempotent
ON public.workouts (user_id, source, source_ref)
WHERE source_ref IS NOT NULL;

-- Daily metrics: One record per user/date/source
CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_daily_metrics_idempotent
ON public.canonical_daily_metrics (user_id, date, source);

-- Sleep sessions: Prevent duplicate sleep records from same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_sessions_idempotent
ON public.sleep_sessions (user_id, source, source_ref)
WHERE source_ref IS NOT NULL;

-- HRV nights: One record per user/date/source
CREATE UNIQUE INDEX IF NOT EXISTS idx_hrv_nights_idempotent
ON public.hrv_nights (user_id, date, source);

-- ============================================================================
-- QUERY OPTIMIZATION INDEXES
-- ============================================================================

-- Workouts: Common query patterns
CREATE INDEX IF NOT EXISTS idx_workouts_user_started_at
ON public.workouts (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workouts_user_activity_type
ON public.workouts (user_id, activity_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workouts_user_date_range
ON public.workouts (user_id, started_at)
WHERE started_at IS NOT NULL;

-- Daily metrics: Date range queries
CREATE INDEX IF NOT EXISTS idx_canonical_daily_metrics_user_date
ON public.canonical_daily_metrics (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_daily_metrics_date_range
ON public.canonical_daily_metrics (user_id, date)
WHERE date IS NOT NULL;

-- Sleep sessions: Date range queries
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_date
ON public.sleep_sessions (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_sleep_sessions_user_sleep_start
ON public.sleep_sessions (user_id, sleep_start DESC);

-- HRV nights: Date queries (critical for today's recommendation)
CREATE INDEX IF NOT EXISTS idx_hrv_nights_user_date
ON public.hrv_nights (user_id, date DESC);

-- User thresholds: Active thresholds lookup
CREATE INDEX IF NOT EXISTS idx_user_thresholds_active
ON public.user_thresholds (user_id, threshold_type, effective_from DESC)
WHERE effective_to IS NULL;

-- Calibration events: Audit log queries
CREATE INDEX IF NOT EXISTS idx_calibration_events_user_created
ON public.calibration_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calibration_events_threshold
ON public.calibration_events (threshold_id, created_at DESC)
WHERE threshold_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calibration_events_undoable
ON public.calibration_events (user_id, undo_deadline)
WHERE is_undoable = true AND was_undone = false;

-- Recommendation events: Lookup by date and type
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_date
ON public.recommendation_events (user_id, recommendation_date DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_pending_outcome
ON public.recommendation_events (user_id, created_at DESC)
WHERE outcome_type = 'pending' OR outcome_type IS NULL;

-- Integration connections: Provider lookup
CREATE INDEX IF NOT EXISTS idx_integration_connections_user_status
ON public.integration_connections (user_id, status)
WHERE status = 'connected';

CREATE INDEX IF NOT EXISTS idx_integration_connections_provider
ON public.integration_connections (provider, status);

-- Sync state: Active syncs lookup
CREATE INDEX IF NOT EXISTS idx_sync_state_user_provider
ON public.sync_state (user_id, provider, data_type);

CREATE INDEX IF NOT EXISTS idx_sync_state_needs_sync
ON public.sync_state (provider, sync_status, next_retry_at)
WHERE sync_status IN ('idle', 'failed');

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Reuse existing function if available, otherwise create
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_updated_at IS 'Automatically sets updated_at to current timestamp on row update';

-- ============================================================================
-- APPLY UPDATED_AT TRIGGERS TO ALL CANONICAL TABLES
-- ============================================================================

-- Workouts
DROP TRIGGER IF EXISTS trg_workouts_updated_at ON public.workouts;
CREATE TRIGGER trg_workouts_updated_at
    BEFORE UPDATE ON public.workouts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Canonical daily metrics
DROP TRIGGER IF EXISTS trg_canonical_daily_metrics_updated_at ON public.canonical_daily_metrics;
CREATE TRIGGER trg_canonical_daily_metrics_updated_at
    BEFORE UPDATE ON public.canonical_daily_metrics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sleep sessions
DROP TRIGGER IF EXISTS trg_sleep_sessions_updated_at ON public.sleep_sessions;
CREATE TRIGGER trg_sleep_sessions_updated_at
    BEFORE UPDATE ON public.sleep_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- HRV nights
DROP TRIGGER IF EXISTS trg_hrv_nights_updated_at ON public.hrv_nights;
CREATE TRIGGER trg_hrv_nights_updated_at
    BEFORE UPDATE ON public.hrv_nights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- User flags
DROP TRIGGER IF EXISTS trg_user_flags_updated_at ON public.user_flags;
CREATE TRIGGER trg_user_flags_updated_at
    BEFORE UPDATE ON public.user_flags
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- User preferences
DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- User thresholds
DROP TRIGGER IF EXISTS trg_user_thresholds_updated_at ON public.user_thresholds;
CREATE TRIGGER trg_user_thresholds_updated_at
    BEFORE UPDATE ON public.user_thresholds
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Calibration events
DROP TRIGGER IF EXISTS trg_calibration_events_updated_at ON public.calibration_events;
CREATE TRIGGER trg_calibration_events_updated_at
    BEFORE UPDATE ON public.calibration_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Recommendation events
DROP TRIGGER IF EXISTS trg_recommendation_events_updated_at ON public.recommendation_events;
CREATE TRIGGER trg_recommendation_events_updated_at
    BEFORE UPDATE ON public.recommendation_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Integration connections
DROP TRIGGER IF EXISTS trg_integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER trg_integration_connections_updated_at
    BEFORE UPDATE ON public.integration_connections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sync state
DROP TRIGGER IF EXISTS trg_sync_state_updated_at ON public.sync_state;
CREATE TRIGGER trg_sync_state_updated_at
    BEFORE UPDATE ON public.sync_state
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- HELPFUL COMMENTS ON INDEXES
-- ============================================================================
COMMENT ON INDEX idx_workouts_idempotent IS 'Prevents duplicate workout imports from same source';
COMMENT ON INDEX idx_canonical_daily_metrics_idempotent IS 'Ensures one record per user/date/source';
COMMENT ON INDEX idx_sleep_sessions_idempotent IS 'Prevents duplicate sleep records from same source';
COMMENT ON INDEX idx_hrv_nights_idempotent IS 'Ensures one HRV record per user/date/source';
