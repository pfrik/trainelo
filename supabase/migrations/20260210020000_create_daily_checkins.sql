-- ============================================================================
-- Table: daily_checkins
-- Purpose: Morning check-in subjective data from the app UI.
-- One row per user per date (upsert on user_id + date).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mood TEXT NOT NULL CHECK (mood IN ('drained', 'tired', 'okay', 'good', 'great')),
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
    soreness INTEGER CHECK (soreness >= 0 AND soreness <= 10),
    pain_flag BOOLEAN NOT NULL DEFAULT false,
    illness_flag BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'app',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT daily_checkins_user_date UNIQUE (user_id, date)
);

COMMENT ON TABLE public.daily_checkins IS 'Morning check-in data from the app UI';
COMMENT ON COLUMN public.daily_checkins.mood IS 'Subjective mood: drained, tired, okay, good, great';
COMMENT ON COLUMN public.daily_checkins.rpe IS 'Rate of perceived exertion (1-10)';
COMMENT ON COLUMN public.daily_checkins.soreness IS 'Muscle soreness level (0-10)';

-- RLS
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_checkins_select_own ON public.daily_checkins;
CREATE POLICY daily_checkins_select_own
  ON public.daily_checkins FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_checkins_insert_own ON public.daily_checkins;
CREATE POLICY daily_checkins_insert_own
  ON public.daily_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_checkins_update_own ON public.daily_checkins;
CREATE POLICY daily_checkins_update_own
  ON public.daily_checkins FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date
  ON public.daily_checkins (user_id, date DESC);

-- Auto-update updated_at trigger
DROP TRIGGER IF EXISTS trg_daily_checkins_updated_at ON public.daily_checkins;
CREATE TRIGGER trg_daily_checkins_updated_at
    BEFORE UPDATE ON public.daily_checkins
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
