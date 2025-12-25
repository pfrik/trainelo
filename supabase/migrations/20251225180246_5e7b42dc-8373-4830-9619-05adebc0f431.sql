-- 1. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  experience_level text CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  weekly_hours_available numeric,
  injury_notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Create races table
CREATE TABLE public.races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  date date NOT NULL,
  sport text NOT NULL,
  distance_km numeric,
  priority text NOT NULL CHECK (priority IN ('A', 'B', 'C')),
  goal_type text,
  goal_value text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Create focus_periods table
CREATE TABLE public.focus_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  primary_discipline text,
  run_pct integer DEFAULT 25,
  bike_pct integer DEFAULT 25,
  swim_pct integer DEFAULT 25,
  strength_pct integer DEFAULT 25,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Create external_blocks table
CREATE TABLE public.external_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  date date NOT NULL,
  start_time time,
  duration_minutes integer,
  discipline text,
  source text CHECK (source IN ('trainerroad', 'coach', 'manual')),
  is_fixed boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. Create day_status table
CREATE TABLE public.day_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('normal', 'sick', 'injured', 'traveling')),
  notes text,
  UNIQUE (user_id, date)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_status ENABLE ROW LEVEL SECURITY;

-- Profiles policies (id = auth.uid() since profiles.id references auth.users.id)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (id = auth.uid());

-- Races policies
CREATE POLICY "Users can view own races" ON public.races FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own races" ON public.races FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own races" ON public.races FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own races" ON public.races FOR DELETE USING (user_id = auth.uid());

-- Focus periods policies
CREATE POLICY "Users can view own focus_periods" ON public.focus_periods FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own focus_periods" ON public.focus_periods FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own focus_periods" ON public.focus_periods FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own focus_periods" ON public.focus_periods FOR DELETE USING (user_id = auth.uid());

-- External blocks policies
CREATE POLICY "Users can view own external_blocks" ON public.external_blocks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own external_blocks" ON public.external_blocks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own external_blocks" ON public.external_blocks FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own external_blocks" ON public.external_blocks FOR DELETE USING (user_id = auth.uid());

-- Day status policies
CREATE POLICY "Users can view own day_status" ON public.day_status FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own day_status" ON public.day_status FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own day_status" ON public.day_status FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own day_status" ON public.day_status FOR DELETE USING (user_id = auth.uid());

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name');
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();