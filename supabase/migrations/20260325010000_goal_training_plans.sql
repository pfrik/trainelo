-- Goal-Based Training Plans
-- Enhances goals + planned_workouts tables and adds training_plan_weeks

-- Add 'taper' to training_phase enum (base, build, peak already exist)
ALTER TYPE training_phase ADD VALUE IF NOT EXISTS 'taper';

-- ============================================================================
-- Enhance goals table
-- ============================================================================

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS sport VARCHAR(50),
  ADD COLUMN IF NOT EXISTS race_distance_km NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS target_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS plan_status VARCHAR(20) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS plan_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_weeks INTEGER,
  ADD COLUMN IF NOT EXISTS peak_weekly_volume_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS training_days_per_week INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS current_weekly_volume_km NUMERIC(10,2);

COMMENT ON COLUMN goals.sport IS 'Sport type: running, cycling, swimming, triathlon';
COMMENT ON COLUMN goals.race_distance_km IS 'Total race distance in kilometers';
COMMENT ON COLUMN goals.target_time_minutes IS 'Target finish time in minutes';
COMMENT ON COLUMN goals.priority IS 'Race priority: A (primary), B (tune-up), C (training race)';
COMMENT ON COLUMN goals.plan_status IS 'Training plan status: draft, active, completed';
COMMENT ON COLUMN goals.plan_generated_at IS 'When the training plan was last generated';
COMMENT ON COLUMN goals.plan_weeks IS 'Total number of weeks in the generated plan';
COMMENT ON COLUMN goals.peak_weekly_volume_km IS 'Computed peak weekly training volume';
COMMENT ON COLUMN goals.training_days_per_week IS 'Number of training days per week (3-7)';
COMMENT ON COLUMN goals.current_weekly_volume_km IS 'Estimated weekly volume at plan generation time';

-- ============================================================================
-- Enhance planned_workouts table
-- ============================================================================

ALTER TABLE planned_workouts
  ADD COLUMN IF NOT EXISTS template_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sport VARCHAR(50),
  ADD COLUMN IF NOT EXISTS week_number INTEGER,
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS target_tss NUMERIC(10,2);

COMMENT ON COLUMN planned_workouts.template_ref IS 'Workout template reference, e.g. run-tempo-45min';
COMMENT ON COLUMN planned_workouts.sport IS 'Sport: run, bike, swim, strength, mobility';
COMMENT ON COLUMN planned_workouts.week_number IS 'Week number within the training plan (1-indexed)';
COMMENT ON COLUMN planned_workouts.day_of_week IS 'Day of week: 0=Monday, 6=Sunday';
COMMENT ON COLUMN planned_workouts.status IS 'Workout status: planned, completed, missed, swapped';
COMMENT ON COLUMN planned_workouts.target_tss IS 'Planned training stress score for this workout';

-- Index for pipeline lookup: fetch today's planned workout
CREATE INDEX IF NOT EXISTS idx_planned_workouts_date_status
  ON planned_workouts(user_id, planned_date, status);

-- ============================================================================
-- New table: training_plan_weeks
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_plan_weeks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  phase training_phase NOT NULL,
  week_start_date DATE NOT NULL,
  planned_volume_km NUMERIC(10,2),
  planned_hours NUMERIC(5,1),
  planned_tss NUMERIC(10,2),
  actual_volume_km NUMERIC(10,2) DEFAULT 0,
  actual_hours NUMERIC(5,1) DEFAULT 0,
  actual_tss NUMERIC(10,2) DEFAULT 0,
  compliance_pct NUMERIC(5,1) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_training_plan_weeks_user_goal
  ON training_plan_weeks(user_id, goal_id);

-- Trigger for updated_at
CREATE TRIGGER update_training_plan_weeks_updated_at
  BEFORE UPDATE ON training_plan_weeks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS for training_plan_weeks
-- ============================================================================

ALTER TABLE training_plan_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own training plan weeks"
  ON training_plan_weeks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training plan weeks"
  ON training_plan_weeks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training plan weeks"
  ON training_plan_weeks FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training plan weeks"
  ON training_plan_weeks FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE training_plan_weeks IS 'Weekly aggregates for training plan overview and compliance tracking';
