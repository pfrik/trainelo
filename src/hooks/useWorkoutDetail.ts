import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkoutDetail {
  id: string;
  title: string | null;
  activity_type: string;
  activity_subtype: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  min_heart_rate: number | null;
  avg_cadence: number | null;
  max_cadence: number | null;
  avg_power_watts: number | null;
  max_power_watts: number | null;
  normalized_power_watts: number | null;
  elevation_gain_meters: number | null;
  elevation_loss_meters: number | null;
  calories: number | null;
  training_stress_score: number | null;
  intensity_factor: number | null;
  perceived_exertion: number | null;
  feeling_score: number | null;
  temperature_celsius: number | null;
  humidity_percent: number | null;
  notes: string | null;
  source: string;
}

export function useWorkoutDetail(workoutId: string | null) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workoutId || !user) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("workouts")
      .select(
        `id, title, activity_type, activity_subtype, started_at, ended_at,
         duration_seconds, distance_meters,
         avg_heart_rate, max_heart_rate, min_heart_rate,
         avg_cadence, max_cadence,
         avg_power_watts, max_power_watts, normalized_power_watts,
         elevation_gain_meters, elevation_loss_meters,
         calories, training_stress_score, intensity_factor,
         perceived_exertion, feeling_score,
         temperature_celsius, humidity_percent,
         notes, source`
      )
      .eq("id", workoutId)
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setDetail(null);
        } else {
          setDetail(data as WorkoutDetail);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workoutId, user]);

  return { detail, loading };
}
