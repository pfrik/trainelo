-- ============================================================================
-- Migration: Create daily_user_state view
-- Description: Single-row-per-(user_id, date) join view across all canonical
--              tables for dashboards and recommendation input.
-- ============================================================================

-- ============================================================================
-- RLS on canonical tables (required for security_invoker view)
-- Service-role callers (cron, sync) bypass RLS automatically.
-- ============================================================================

-- -- workouts -----------------------------------------------------------------
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workouts" ON public.workouts;
CREATE POLICY "Users can view own workouts"
    ON public.workouts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workouts;
CREATE POLICY "Users can insert own workouts"
    ON public.workouts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workouts" ON public.workouts;
CREATE POLICY "Users can update own workouts"
    ON public.workouts FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workouts;
CREATE POLICY "Users can delete own workouts"
    ON public.workouts FOR DELETE USING (auth.uid() = user_id);

-- -- canonical_daily_metrics --------------------------------------------------
ALTER TABLE public.canonical_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily metrics" ON public.canonical_daily_metrics;
CREATE POLICY "Users can view own daily metrics"
    ON public.canonical_daily_metrics FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily metrics" ON public.canonical_daily_metrics;
CREATE POLICY "Users can insert own daily metrics"
    ON public.canonical_daily_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily metrics" ON public.canonical_daily_metrics;
CREATE POLICY "Users can update own daily metrics"
    ON public.canonical_daily_metrics FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own daily metrics" ON public.canonical_daily_metrics;
CREATE POLICY "Users can delete own daily metrics"
    ON public.canonical_daily_metrics FOR DELETE USING (auth.uid() = user_id);

-- -- sleep_sessions -----------------------------------------------------------
ALTER TABLE public.sleep_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sleep sessions" ON public.sleep_sessions;
CREATE POLICY "Users can view own sleep sessions"
    ON public.sleep_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sleep sessions" ON public.sleep_sessions;
CREATE POLICY "Users can insert own sleep sessions"
    ON public.sleep_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sleep sessions" ON public.sleep_sessions;
CREATE POLICY "Users can update own sleep sessions"
    ON public.sleep_sessions FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sleep sessions" ON public.sleep_sessions;
CREATE POLICY "Users can delete own sleep sessions"
    ON public.sleep_sessions FOR DELETE USING (auth.uid() = user_id);

-- -- hrv_nights ---------------------------------------------------------------
ALTER TABLE public.hrv_nights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own hrv nights" ON public.hrv_nights;
CREATE POLICY "Users can view own hrv nights"
    ON public.hrv_nights FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own hrv nights" ON public.hrv_nights;
CREATE POLICY "Users can insert own hrv nights"
    ON public.hrv_nights FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own hrv nights" ON public.hrv_nights;
CREATE POLICY "Users can update own hrv nights"
    ON public.hrv_nights FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own hrv nights" ON public.hrv_nights;
CREATE POLICY "Users can delete own hrv nights"
    ON public.hrv_nights FOR DELETE USING (auth.uid() = user_id);

-- -- sync_state (SELECT-only; writes come from service-role sync jobs) --------
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sync state" ON public.sync_state;
CREATE POLICY "Users can view own sync state"
    ON public.sync_state FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- View: daily_user_state
-- One row per (user_id, date).  Deterministic, null-safe.
-- Uses security_invoker so RLS on underlying tables applies to callers.
-- ============================================================================
CREATE OR REPLACE VIEW public.daily_user_state
WITH (security_invoker = true)
AS
WITH
-- ----------------------------------------------------------------
-- Date spine: every (user_id, date) that exists in any source
-- UNION deduplicates to guarantee one tuple per pair.
-- ----------------------------------------------------------------
date_spine AS (
    SELECT user_id, date FROM public.canonical_daily_metrics
    UNION
    SELECT user_id, date FROM public.sleep_sessions
    UNION
    SELECT user_id, date FROM public.hrv_nights
    UNION
    SELECT user_id, (started_at AT TIME ZONE 'UTC')::date AS date FROM public.workouts
),

-- ----------------------------------------------------------------
-- Best sleep row per (user_id, date) — most recently updated wins
-- ----------------------------------------------------------------
sleep_pick AS (
    SELECT DISTINCT ON (user_id, date)
        user_id, date, sleep_score, sleep_seconds, avg_hrv_ms
    FROM public.sleep_sessions
    ORDER BY user_id, date, updated_at DESC, id DESC
),

-- ----------------------------------------------------------------
-- Best HRV row per (user_id, date)
-- ----------------------------------------------------------------
hrv_pick AS (
    SELECT DISTINCT ON (user_id, date)
        user_id, date, hrv_rmssd, hrv_baseline
    FROM public.hrv_nights
    ORDER BY user_id, date, updated_at DESC, id DESC
),

-- ----------------------------------------------------------------
-- Best metrics row per (user_id, date)
-- ----------------------------------------------------------------
metrics_pick AS (
    SELECT DISTINCT ON (user_id, date)
        user_id, date, recovery_score
    FROM public.canonical_daily_metrics
    ORDER BY user_id, date, updated_at DESC, id DESC
),

-- ----------------------------------------------------------------
-- Daily workout load collapsed across ALL sources
-- Sources from public.daily_training_load (per-source view) and
-- re-aggregates to one row per (user_id, date).
-- ----------------------------------------------------------------
daily_load AS (
    SELECT
        user_id,
        date,
        SUM(workouts_count)::integer AS workouts_count,
        SUM(total_tss)               AS total_tss
    FROM public.daily_training_load
    GROUP BY user_id, date
),

-- ----------------------------------------------------------------
-- Most recent Garmin sync per user (date-independent)
-- ----------------------------------------------------------------
garmin_sync AS (
    SELECT DISTINCT ON (user_id)
        user_id,
        last_sync_completed_at AS last_garmin_sync_at
    FROM public.sync_state
    WHERE provider = 'garmin'
    ORDER BY user_id, last_sync_completed_at DESC NULLS LAST, id DESC
)

-- ================================================================
-- Main SELECT
-- ================================================================
SELECT
    d.user_id,
    d.date,

    -- Sleep -----------------------------------------------------------
    sl.sleep_score,
    sl.sleep_seconds,
    sl.avg_hrv_ms,

    -- HRV -------------------------------------------------------------
    h.hrv_rmssd,
    h.hrv_baseline,

    -- Recovery --------------------------------------------------------
    m.recovery_score,

    -- Acute load (7-day rolling TSS sum) ------------------------------
    COALESCE(a7.acute_load, 0)::numeric(10,2) AS acute_load_7d,

    -- Chronic load (28-day rolling TSS sum) ---------------------------
    COALESCE(a28.chronic_load, 0)::numeric(10,2) AS chronic_load_28d,

    -- Days since last rest day ----------------------------------------
    -- 0 when current date has no workout (it IS a rest day).
    -- Otherwise count calendar days back to most recent workout-free day
    -- within a 90-day lookback.  91 if no rest found in that window.
    CASE
        WHEN dl_today.workouts_count IS NULL THEN 0
        ELSE COALESCE(
            (d.date - (
                SELECT MAX(g.dt::date)
                FROM generate_series(
                    (d.date - 90)::timestamp,
                    (d.date - 1)::timestamp,
                    '1 day'::interval
                ) g(dt)
                WHERE NOT EXISTS (
                    SELECT 1 FROM daily_load dl2
                    WHERE dl2.user_id = d.user_id
                      AND dl2.date = g.dt::date
                )
            ))::integer,
            91  -- trained every day in the 90-day window
        )
    END AS days_since_rest,

    -- Last hard session date ------------------------------------------
    -- Hard = interval/tempo/race/threshold subtype, TSS >= 150, or RPE >= 8
    (
        SELECT MAX((w.started_at AT TIME ZONE 'UTC')::date)
        FROM public.workouts w
        WHERE w.user_id = d.user_id
          AND (w.started_at AT TIME ZONE 'UTC')::date <= d.date
          AND (
              w.activity_subtype IN ('interval', 'tempo', 'race', 'threshold')
              OR w.training_stress_score >= 150
              OR w.perceived_exertion >= 8
          )
    ) AS last_hard_session_date,

    -- Garmin sync -----------------------------------------------------
    gs.last_garmin_sync_at

FROM date_spine d

LEFT JOIN sleep_pick sl
    ON sl.user_id = d.user_id AND sl.date = d.date

LEFT JOIN hrv_pick h
    ON h.user_id = d.user_id AND h.date = d.date

LEFT JOIN metrics_pick m
    ON m.user_id = d.user_id AND m.date = d.date

LEFT JOIN daily_load dl_today
    ON dl_today.user_id = d.user_id AND dl_today.date = d.date

LEFT JOIN LATERAL (
    SELECT SUM(dl.total_tss) AS acute_load
    FROM daily_load dl
    WHERE dl.user_id = d.user_id
      AND dl.date BETWEEN d.date - 6 AND d.date
) a7 ON true

LEFT JOIN LATERAL (
    SELECT SUM(dl.total_tss) AS chronic_load
    FROM daily_load dl
    WHERE dl.user_id = d.user_id
      AND dl.date BETWEEN d.date - 27 AND d.date
) a28 ON true

LEFT JOIN garmin_sync gs
    ON gs.user_id = d.user_id;

COMMENT ON VIEW public.daily_user_state IS
    'One row per (user_id, date) joining metrics, sleep, HRV, training load, and sync state';

-- ============================================================================
-- Sanity check: verify one-row-per-user-per-date invariant
-- Expected result: 0 rows.
-- ============================================================================
-- SELECT user_id, date, COUNT(*) AS n
-- FROM   public.daily_user_state
-- GROUP  BY user_id, date
-- HAVING COUNT(*) > 1;
