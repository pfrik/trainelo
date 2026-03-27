-- Bio-Adaptive Brain: Compliance Matching & Load Surplus Detection
-- Adds smart compliance columns to planned_workouts and creates daily_compliance_log

-- ============================================================================
-- Enhance planned_workouts with compliance matching columns
-- ============================================================================

ALTER TABLE planned_workouts
  ADD COLUMN IF NOT EXISTS matched_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_score NUMERIC(3,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS match_reason TEXT DEFAULT NULL;

COMMENT ON COLUMN planned_workouts.matched_workout_id IS 'ID of the actual workout matched to this planned workout';
COMMENT ON COLUMN planned_workouts.match_score IS 'Compliance match score 0.00-1.00 (null = not yet evaluated)';
COMMENT ON COLUMN planned_workouts.match_reason IS 'Human-readable compliance match explanation';

-- ============================================================================
-- Daily compliance log — historical tracking of planned vs actual load
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_compliance_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  planned_tss NUMERIC(10,2) DEFAULT 0,
  actual_tss NUMERIC(10,2) DEFAULT 0,
  surplus_tss NUMERIC(10,2) DEFAULT 0,
  cross_sport_tss NUMERIC(10,2) DEFAULT 0,
  transferred_tss NUMERIC(10,2) DEFAULT 0,
  match_count INTEGER DEFAULT 0,
  miss_count INTEGER DEFAULT 0,
  unplanned_count INTEGER DEFAULT 0,
  avg_match_score NUMERIC(3,2) DEFAULT NULL,
  source_breakdown JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_compliance_log_user_date
  ON daily_compliance_log(user_id, date DESC);

COMMENT ON TABLE daily_compliance_log IS 'Daily record of plan compliance: planned vs actual load, surplus detection, cross-sport transfer';

-- ============================================================================
-- RLS for daily_compliance_log
-- ============================================================================

ALTER TABLE daily_compliance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own compliance log"
  ON daily_compliance_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage compliance log"
  ON daily_compliance_log FOR ALL
  USING (true) WITH CHECK (true);
