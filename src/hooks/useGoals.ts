import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  sport: string | null;
  race_distance_km: number | null;
  target_time_minutes: number | null;
  priority: string | null;
  plan_status: string | null;
  plan_weeks: number | null;
  peak_weekly_volume_km: number | null;
  training_days_per_week: number | null;
  current_weekly_volume_km: number | null;
  created_at: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  target_date: string;
  sport: string;
  race_distance_km: number;
  target_time_minutes?: number;
  priority?: string;
  training_days_per_week?: number;
}

interface PlanGenerationResult {
  ok: boolean;
  goal_id: string;
  plan: {
    total_weeks: number;
    peak_weekly_volume_km: number;
    total_workouts: number;
    phases: Array<{
      phase: string;
      startWeek: number;
      endWeek: number;
      description: string;
    }>;
    current_weekly_volume_km: number;
  };
}

export function useGoals() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      h.Authorization = `Bearer ${session.access_token}`;
    }
    return h;
  }, [session?.access_token]);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", { headers: headers() });
      const json = await res.json();
      if (json.ok) {
        setGoals(json.goals);
      } else {
        setError(json.error ?? "Failed to fetch goals");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const createGoal = useCallback(
    async (input: CreateGoalInput): Promise<Goal | null> => {
      try {
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(input),
        });
        const json = await res.json();
        if (json.ok) {
          await fetchGoals();
          return json.goal;
        }
        setError(json.error ?? "Failed to create goal");
        return null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        return null;
      }
    },
    [headers, fetchGoals],
  );

  const generatePlan = useCallback(
    async (goalId: string): Promise<PlanGenerationResult | null> => {
      try {
        const res = await fetch(`/api/goals/generate-plan?id=${goalId}`, {
          method: "POST",
          headers: headers(),
        });
        const json = await res.json();
        if (json.ok) {
          await fetchGoals();
          return json;
        }
        setError(json.error ?? "Failed to generate plan");
        return null;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
        return null;
      }
    },
    [headers, fetchGoals],
  );

  const deleteGoal = useCallback(
    async (goalId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/goals?id=${goalId}`, {
          method: "DELETE",
          headers: headers(),
        });
        const json = await res.json();
        if (json.ok) {
          await fetchGoals();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [headers, fetchGoals],
  );

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return {
    goals,
    loading,
    error,
    refetch: fetchGoals,
    createGoal,
    generatePlan,
    deleteGoal,
  };
}
