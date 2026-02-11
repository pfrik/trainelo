-- ============================================================================
-- Migration: Fix Supabase Security Advisor errors (8 errors)
-- Idempotent: safe to run multiple times.
--
-- Fixes:
--   1) security_definer_view: public.daily_inputs
--   2) rls_disabled_in_public: calibration_events, integration_connections,
--      user_flags, user_preferences, user_thresholds
--   3) sensitive_columns_exposed: integration_connections (access_token,
--      refresh_token) — solved by RLS with NO client policies
-- ============================================================================

-- ============================================================================
-- 1) VIEW: daily_inputs — set SECURITY INVOKER
--    (View exists in live DB but not in migrations; use IF EXISTS.)
-- ============================================================================

ALTER VIEW IF EXISTS public.daily_inputs SET (security_invoker = true);

-- ============================================================================
-- 2a) TABLE: calibration_events — enable RLS + own-row policies
-- ============================================================================

ALTER TABLE public.calibration_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calibration_events_select_own ON public.calibration_events;
CREATE POLICY calibration_events_select_own
  ON public.calibration_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS calibration_events_insert_own ON public.calibration_events;
CREATE POLICY calibration_events_insert_own
  ON public.calibration_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS calibration_events_update_own ON public.calibration_events;
CREATE POLICY calibration_events_update_own
  ON public.calibration_events FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS calibration_events_delete_own ON public.calibration_events;
CREATE POLICY calibration_events_delete_own
  ON public.calibration_events FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2b) TABLE: integration_connections — enable RLS, NO client policies
--     Service-role only (bypasses RLS). Revoke direct table access from
--     anon/authenticated so tokens are never readable by client SDKs.
--     This also fixes error 3 (sensitive_columns_exposed).
-- ============================================================================

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

-- Revoke all direct privileges from client-facing roles
REVOKE ALL ON public.integration_connections FROM anon, authenticated;

-- No policies created — only service_role (which bypasses RLS) can access.

-- ============================================================================
-- 2c) TABLE: user_flags — enable RLS + own-row policies
-- ============================================================================

ALTER TABLE public.user_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_flags_select_own ON public.user_flags;
CREATE POLICY user_flags_select_own
  ON public.user_flags FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_flags_insert_own ON public.user_flags;
CREATE POLICY user_flags_insert_own
  ON public.user_flags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_flags_update_own ON public.user_flags;
CREATE POLICY user_flags_update_own
  ON public.user_flags FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_flags_delete_own ON public.user_flags;
CREATE POLICY user_flags_delete_own
  ON public.user_flags FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2d) TABLE: user_preferences — enable RLS + own-row policies
-- ============================================================================

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_preferences_delete_own ON public.user_preferences;
CREATE POLICY user_preferences_delete_own
  ON public.user_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2e) TABLE: user_thresholds — enable RLS + own-row policies
-- ============================================================================

ALTER TABLE public.user_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_thresholds_select_own ON public.user_thresholds;
CREATE POLICY user_thresholds_select_own
  ON public.user_thresholds FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_thresholds_insert_own ON public.user_thresholds;
CREATE POLICY user_thresholds_insert_own
  ON public.user_thresholds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_thresholds_update_own ON public.user_thresholds;
CREATE POLICY user_thresholds_update_own
  ON public.user_thresholds FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_thresholds_delete_own ON public.user_thresholds;
CREATE POLICY user_thresholds_delete_own
  ON public.user_thresholds FOR DELETE
  USING (auth.uid() = user_id);
