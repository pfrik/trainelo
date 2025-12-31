import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PlannedWorkout } from "@/types/plannedWorkout";
import { toast } from "sonner";
import { toDateString, fromDateString } from "@/lib/dateUtils";

export function usePlannedWorkouts() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkouts = useCallback(async () => {
    if (!user) {
      setWorkouts([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("planned_workouts")
      .select("*")
      .order("planned_date", { ascending: true });

    if (error) {
      console.error("Error fetching planned workouts:", error);
      toast.error("Failed to load planned workouts");
    } else {
      const mapped: PlannedWorkout[] = (data || []).map((w) => ({
        id: w.id,
        title: w.title,
        date: fromDateString(w.planned_date),
        duration: w.planned_duration_minutes || 60,
        workoutType: w.workout_type || "run",
        intensityLevel: w.intensity_level || 5,
        distance: w.distance_km || undefined,
        description: w.description || undefined,
        notes: w.notes || undefined,
        trainingPhase: w.training_phase || undefined,
      }));
      setWorkouts(mapped);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const addWorkout = async (workout: Omit<PlannedWorkout, "id">) => {
    if (!user) return;

    const { error } = await supabase.from("planned_workouts").insert({
      user_id: user.id,
      title: workout.title,
      planned_date: toDateString(workout.date),
      planned_duration_minutes: workout.duration,
      workout_type: workout.workoutType,
      intensity_level: workout.intensityLevel,
      distance_km: workout.distance,
      description: workout.description,
      notes: workout.notes,
      training_phase: workout.trainingPhase,
    });

    if (error) {
      console.error("Error adding workout:", error);
      toast.error("Failed to add planned workout");
    } else {
      await fetchWorkouts();
    }
  };

  const updateWorkout = async (id: string, workout: Omit<PlannedWorkout, "id">) => {
    if (!user) return;

    const { error } = await supabase
      .from("planned_workouts")
      .update({
        title: workout.title,
        planned_date: toDateString(workout.date),
        planned_duration_minutes: workout.duration,
        workout_type: workout.workoutType,
        intensity_level: workout.intensityLevel,
        distance_km: workout.distance,
        description: workout.description,
        notes: workout.notes,
        training_phase: workout.trainingPhase,
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating workout:", error);
      toast.error("Failed to update planned workout");
    } else {
      await fetchWorkouts();
    }
  };

  const deleteWorkout = async (id: string) => {
    if (!user) return;

    const { error } = await supabase.from("planned_workouts").delete().eq("id", id);

    if (error) {
      console.error("Error deleting workout:", error);
      toast.error("Failed to delete planned workout");
    } else {
      await fetchWorkouts();
    }
  };

  return { workouts, loading, addWorkout, updateWorkout, deleteWorkout, refetch: fetchWorkouts };
}