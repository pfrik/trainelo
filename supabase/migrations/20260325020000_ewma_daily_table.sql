-- EWMA Daily State Persistence
-- Stores daily fitness/fatigue/form EWMA values for PMC chart and historical tracking.
-- One row per user per day. Populated by the daily cron and recommendation endpoint.

CREATE TABLE IF NOT EXISTS ewma_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  fitness_raw NUMERIC(10,4) NOT NULL DEFAULT 0,
  fatigue_raw NUMERIC(10,4) NOT NULL DEFAULT 0,
  form_raw NUMERIC(10,4) NOT NULL DEFAULT 0,
  daily_tss NUMERIC(10,2) DEFAULT 0,
  data_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ewma_daily_user_date
  ON ewma_daily(user_id, date);

-- updated_at trigger
CREATE TRIGGER update_ewma_daily_updated_at
  BEFORE UPDATE ON ewma_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE ewma_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own EWMA data"
  ON ewma_daily FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own EWMA data"
  ON ewma_daily FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own EWMA data"
  ON ewma_daily FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own EWMA data"
  ON ewma_daily FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE ewma_daily IS 'Daily EWMA fitness/fatigue/form state for PMC chart and historical tracking';
