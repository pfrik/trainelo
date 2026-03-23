-- Add detailed activity metrics from Garmin sync
-- These fields are already available in raw_data but need proper columns
-- for type safety and query performance.

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS avg_speed_mps NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS max_speed_mps NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS moving_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS elapsed_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS aerobic_training_effect NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS anaerobic_training_effect NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS vo2max_value NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS avg_stride_length_cm NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS avg_vertical_oscillation_cm NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS avg_ground_contact_time_ms NUMERIC(6,1);
