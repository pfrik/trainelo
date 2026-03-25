-- Daily Anomaly Log
-- Persists daily anomaly detection results for temporal tracking and escalation.
-- One row per user per day. Used by anomaly escalation to detect multi-day patterns.

CREATE TABLE IF NOT EXISTS daily_anomaly_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  caution_level VARCHAR(20) NOT NULL DEFAULT 'none',
  restrictions TEXT[] NOT NULL DEFAULT '{}',
  question_key VARCHAR(100),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_anomaly_log_user_date
  ON daily_anomaly_log(user_id, date);

-- updated_at trigger
CREATE TRIGGER update_daily_anomaly_log_updated_at
  BEFORE UPDATE ON daily_anomaly_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE daily_anomaly_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own anomaly log"
  ON daily_anomaly_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own anomaly log"
  ON daily_anomaly_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own anomaly log"
  ON daily_anomaly_log FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own anomaly log"
  ON daily_anomaly_log FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE daily_anomaly_log IS 'Daily anomaly detection results for temporal escalation and resolution tracking';
