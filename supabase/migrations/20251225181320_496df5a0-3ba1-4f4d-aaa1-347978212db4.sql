-- Create phases table for training periodization
CREATE TABLE public.phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('base', 'build', 'peak', 'taper', 'recovery')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  weekly_hours_target numeric,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own phases"
ON public.phases FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own phases"
ON public.phases FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own phases"
ON public.phases FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own phases"
ON public.phases FOR DELETE
USING (user_id = auth.uid());