-- Explicit Data API grants for every table and view in public.
--
-- From 2026-10-30 Supabase stops auto-granting Data API access to tables
-- created in "public". Existing prod tables keep their grants, so this is a
-- no-op there; it exists so a schema rebuild (new project, preview branch,
-- `supabase db reset`) ends up with working access.
--
-- Policy: authenticated + service_role only. Every table is per-user and
-- RLS-protected, so anon gets nothing. integration_connections stays
-- service_role-only (see 20260211010000_fix_security_advisor_errors.sql).
--
-- Convention going forward: every migration that creates a table must
-- include its own grants.

-- Tables: full CRUD for authenticated (RLS-gated) and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.races,
  public.focus_periods,
  public.external_blocks,
  public.day_status,
  public.phases,
  public.weekly_availability,
  public.goals,
  public.planned_workouts,
  public.workout_completions,
  public.daily_metrics,
  public.training_load,
  public.workouts,
  public.canonical_daily_metrics,
  public.sleep_sessions,
  public.hrv_nights,
  public.user_flags,
  public.user_preferences,
  public.user_thresholds,
  public.calibration_events,
  public.recommendation_events,
  public.sync_state,
  public.daily_recommendations,
  public.daily_checkins,
  public.training_plan_weeks,
  public.ewma_daily,
  public.daily_anomaly_log,
  public.daily_compliance_log
TO authenticated, service_role;

-- Token storage: service_role only, never client-readable
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO service_role;

-- Views: read-only
GRANT SELECT ON
  public.daily_training_load,
  public.daily_user_state
TO authenticated, service_role;

-- canonical_daily_metrics_ui was created outside migrations, so it may not exist
DO $$
BEGIN
  IF to_regclass('public.canonical_daily_metrics_ui') IS NOT NULL THEN
    GRANT SELECT ON public.canonical_daily_metrics_ui TO authenticated, service_role;
  END IF;
END $$;

-- Sequences (serial/identity columns) need USAGE for inserts
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
