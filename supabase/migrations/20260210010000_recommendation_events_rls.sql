-- ============================================================================
-- Enable RLS and add policies for recommendation_events
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.recommendation_events ENABLE ROW LEVEL SECURITY;

-- User can read own events
DROP POLICY IF EXISTS recommendation_events_select_own ON public.recommendation_events;
CREATE POLICY recommendation_events_select_own
  ON public.recommendation_events FOR SELECT
  USING (auth.uid() = user_id);

-- User can insert own events
DROP POLICY IF EXISTS recommendation_events_insert_own ON public.recommendation_events;
CREATE POLICY recommendation_events_insert_own
  ON public.recommendation_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Partial index for user choice lookups (only rows with a response)
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_response
  ON public.recommendation_events (user_id, response_at DESC)
  WHERE response_at IS NOT NULL;
