-- Create MVP Training Schema
-- This migration creates the core tables for the training application

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE goal_status AS ENUM ('active', 'completed', 'paused', 'cancelled');
CREATE TYPE workout_status AS ENUM ('planned', 'completed', 'skipped', 'partial');
CREATE TYPE training_phase AS ENUM ('base', 'build', 'peak', 'recovery', 'transition');

-- Create goals table
CREATE TABLE goals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,
    status goal_status DEFAULT 'active',
    goal_type VARCHAR(100), -- e.g., 'distance', 'time', 'frequency', 'performance'
    target_value NUMERIC, -- flexible numeric value for different goal types
    target_unit VARCHAR(50), -- e.g., 'km', 'hours', 'sessions/week'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create planned_workouts table
CREATE TABLE planned_workouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    planned_date DATE NOT NULL,
    planned_duration_minutes INTEGER,
    workout_type VARCHAR(100), -- e.g., 'run', 'bike', 'swim', 'strength'
    intensity_level INTEGER CHECK (intensity_level >= 1 AND intensity_level <= 10),
    training_phase training_phase,
    distance_km NUMERIC(10,3),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workout_completions table
CREATE TABLE workout_completions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    planned_workout_id UUID REFERENCES planned_workouts(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    completed_date DATE NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_duration_minutes INTEGER,
    workout_type VARCHAR(100),
    status workout_status DEFAULT 'completed',
    distance_km NUMERIC(10,3),
    elevation_gain_m NUMERIC(10,2),
    average_heart_rate INTEGER,
    max_heart_rate INTEGER,
    average_pace_min_per_km NUMERIC(5,2),
    average_speed_kmh NUMERIC(5,2),
    calories_burned INTEGER,
    weather_conditions VARCHAR(100),
    temperature_celsius NUMERIC(5,2),
    perceived_effort INTEGER CHECK (perceived_effort >= 1 AND perceived_effort <= 10),
    notes TEXT,
    data_source VARCHAR(100), -- e.g., 'manual', 'garmin', 'strava'
    external_id VARCHAR(255), -- for storing IDs from external sources
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily_metrics table
CREATE TABLE daily_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg NUMERIC(5,2),
    body_fat_percentage NUMERIC(4,2),
    resting_heart_rate INTEGER,
    hrv_ms INTEGER, -- Heart Rate Variability in milliseconds
    sleep_hours NUMERIC(4,2),
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 10),
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
    mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 10),
    hydration_liters NUMERIC(4,2),
    nutrition_quality INTEGER CHECK (nutrition_quality >= 1 AND nutrition_quality <= 10),
    injury_pain_level INTEGER CHECK (injury_pain_level >= 0 AND injury_pain_level <= 10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create training_load table
CREATE TABLE training_load (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    acute_load NUMERIC(10,2), -- 7-day rolling average
    chronic_load NUMERIC(10,2), -- 28-day rolling average
    acute_chronic_ratio NUMERIC(5,3), -- Acute/Chronic workload ratio
    weekly_distance_km NUMERIC(10,2),
    weekly_duration_minutes INTEGER,
    weekly_elevation_m NUMERIC(10,2),
    weekly_workout_count INTEGER,
    fitness_score NUMERIC(5,2), -- Calculated fitness score
    fatigue_score NUMERIC(5,2), -- Calculated fatigue score
    form_score NUMERIC(5,2), -- Fitness - Fatigue
    training_stress_score NUMERIC(10,2), -- TSS or similar metric
    monotony_score NUMERIC(5,3), -- Training monotony (variance measure)
    strain_score NUMERIC(10,2), -- Weekly load * monotony
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create indexes for better query performance
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_planned_workouts_user_date ON planned_workouts(user_id, planned_date);
CREATE INDEX idx_planned_workouts_goal ON planned_workouts(goal_id);
CREATE INDEX idx_workout_completions_user_date ON workout_completions(user_id, completed_date);
CREATE INDEX idx_workout_completions_planned ON workout_completions(planned_workout_id);
CREATE INDEX idx_daily_metrics_user_date ON daily_metrics(user_id, date);
CREATE INDEX idx_training_load_user_date ON training_load(user_id, date);
CREATE INDEX idx_training_load_user_week ON training_load(user_id, year, week_number);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planned_workouts_updated_at BEFORE UPDATE ON planned_workouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_completions_updated_at BEFORE UPDATE ON workout_completions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON daily_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_load_updated_at BEFORE UPDATE ON training_load
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_load ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Goals policies
CREATE POLICY "Users can view their own goals" ON goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals" ON goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" ON goals
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" ON goals
    FOR DELETE USING (auth.uid() = user_id);

-- Planned workouts policies
CREATE POLICY "Users can view their own planned workouts" ON planned_workouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own planned workouts" ON planned_workouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own planned workouts" ON planned_workouts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own planned workouts" ON planned_workouts
    FOR DELETE USING (auth.uid() = user_id);

-- Workout completions policies
CREATE POLICY "Users can view their own workout completions" ON workout_completions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workout completions" ON workout_completions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout completions" ON workout_completions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout completions" ON workout_completions
    FOR DELETE USING (auth.uid() = user_id);

-- Daily metrics policies
CREATE POLICY "Users can view their own daily metrics" ON daily_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily metrics" ON daily_metrics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily metrics" ON daily_metrics
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily metrics" ON daily_metrics
    FOR DELETE USING (auth.uid() = user_id);

-- Training load policies
CREATE POLICY "Users can view their own training load" ON training_load
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training load" ON training_load
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training load" ON training_load
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training load" ON training_load
    FOR DELETE USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE goals IS 'Stores user training goals and objectives';
COMMENT ON TABLE planned_workouts IS 'Stores planned workout sessions';
COMMENT ON TABLE workout_completions IS 'Stores completed workout data';
COMMENT ON TABLE daily_metrics IS 'Stores daily health and wellness metrics';
COMMENT ON TABLE training_load IS 'Stores calculated training load and performance metrics';