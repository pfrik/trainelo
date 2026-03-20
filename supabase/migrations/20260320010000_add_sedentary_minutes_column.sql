-- Add sedentary_minutes column to canonical_daily_metrics.
-- The column was defined in the original CREATE TABLE migration but may
-- not exist in production if the table was created before the column was
-- added to the migration file (CREATE TABLE IF NOT EXISTS is a no-op on
-- an existing table).

ALTER TABLE public.canonical_daily_metrics
    ADD COLUMN IF NOT EXISTS sedentary_minutes INTEGER;
