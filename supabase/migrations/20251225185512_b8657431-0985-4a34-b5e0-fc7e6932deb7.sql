-- Create weekly_availability table
CREATE TABLE public.weekly_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  minutes INTEGER NOT NULL DEFAULT 60 CHECK (minutes >= 0 AND minutes <= 240),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.weekly_availability ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own weekly_availability"
ON public.weekly_availability FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own weekly_availability"
ON public.weekly_availability FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own weekly_availability"
ON public.weekly_availability FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own weekly_availability"
ON public.weekly_availability FOR DELETE
USING (user_id = auth.uid());