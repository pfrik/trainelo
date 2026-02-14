-- ============================================================================
-- Migration: Extend daily_checkins for Morning Check-in v2
-- Adds structured reason tracking, granular subjective scales, pain detail,
-- time constraints, versioning, and a flexible payload column.
-- Idempotent: all operations use IF NOT EXISTS or are safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- New columns (ADD COLUMN IF NOT EXISTS requires Postgres 11+)
-- ---------------------------------------------------------------------------

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS reason_bucket TEXT
    CHECK (reason_bucket IN ('sick', 'hurt', 'fried', 'none'));

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS reason_tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS sleep_quality INTEGER
    CHECK (sleep_quality >= 1 AND sleep_quality <= 5);

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS perceived_energy INTEGER
    CHECK (perceived_energy >= 1 AND perceived_energy <= 5);

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS motivation INTEGER
    CHECK (motivation >= 1 AND motivation <= 5);

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS life_stress INTEGER
    CHECK (life_stress >= 1 AND life_stress <= 5);

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS pain_severity INTEGER
    CHECK (pain_severity >= 0 AND pain_severity <= 10);

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS pain_locations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS time_constraint_minutes INTEGER
    CHECK (time_constraint_minutes > 0);

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS checkin_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Conditional constraints (using named constraints for idempotency)
-- ---------------------------------------------------------------------------

-- If mood='drained' then reason_bucket must not be null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_drained_requires_reason_bucket'
      AND conrelid = 'public.daily_checkins'::regclass
  ) THEN
    ALTER TABLE public.daily_checkins
      ADD CONSTRAINT chk_drained_requires_reason_bucket
      CHECK (mood <> 'drained' OR reason_bucket IS NOT NULL);
  END IF;
END $$;

-- If reason_bucket='hurt' then pain_severity > 0 AND pain_locations has >= 1 element
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_hurt_requires_pain_detail'
      AND conrelid = 'public.daily_checkins'::regclass
  ) THEN
    ALTER TABLE public.daily_checkins
      ADD CONSTRAINT chk_hurt_requires_pain_detail
      CHECK (
        reason_bucket <> 'hurt'
        OR (pain_severity > 0 AND jsonb_array_length(pain_locations) >= 1)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Index for date-descending queries
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_daily_checkins_date
  ON public.daily_checkins (date DESC);
