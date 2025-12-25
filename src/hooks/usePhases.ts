import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Phase, PhaseType } from "@/types/phase";
import { toast } from "sonner";
import { addDays, subDays, subWeeks, format } from "date-fns";

export function usePhases() {
  const { user } = useAuth();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhases = useCallback(async () => {
    if (!user) {
      setPhases([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("phases")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: true });

      if (error) throw error;

      setPhases(
        (data || []).map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type as PhaseType,
          startDate: new Date(p.start_date),
          endDate: new Date(p.end_date),
          weeklyHoursTarget: p.weekly_hours_target ?? undefined,
        }))
      );
    } catch (error) {
      console.error("Error fetching phases:", error);
      toast.error("Failed to load training phases");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPhases();
  }, [fetchPhases]);

  const generatePlan = useCallback(
    async (aRaceDate: Date): Promise<boolean> => {
      if (!user) return false;

      try {
        // Delete existing phases first
        const { error: deleteError } = await supabase
          .from("phases")
          .delete()
          .eq("user_id", user.id);

        if (deleteError) throw deleteError;

        // Calculate phases working backwards from A-race
        const taperStart = subWeeks(aRaceDate, 2);
        const taperEnd = subDays(aRaceDate, 1);

        const peakStart = subWeeks(taperStart, 2);
        const peakEnd = subDays(taperStart, 1);

        const buildStart = subWeeks(peakStart, 6);
        const buildEnd = subDays(peakStart, 1);

        // Base: remaining weeks, capped at 12
        const maxBaseStart = subWeeks(buildStart, 12);
        const today = new Date();
        const baseStart = maxBaseStart > today ? maxBaseStart : today;
        const baseEnd = subDays(buildStart, 1);

        // Recovery: 1 week after A-race
        const recoveryStart = aRaceDate;
        const recoveryEnd = addDays(aRaceDate, 7);

        const newPhases = [
          {
            user_id: user.id,
            name: "Base Phase",
            type: "base" as const,
            start_date: format(baseStart, "yyyy-MM-dd"),
            end_date: format(baseEnd, "yyyy-MM-dd"),
            weekly_hours_target: 6,
          },
          {
            user_id: user.id,
            name: "Build Phase",
            type: "build" as const,
            start_date: format(buildStart, "yyyy-MM-dd"),
            end_date: format(buildEnd, "yyyy-MM-dd"),
            weekly_hours_target: 8,
          },
          {
            user_id: user.id,
            name: "Peak Phase",
            type: "peak" as const,
            start_date: format(peakStart, "yyyy-MM-dd"),
            end_date: format(peakEnd, "yyyy-MM-dd"),
            weekly_hours_target: 10,
          },
          {
            user_id: user.id,
            name: "Taper",
            type: "taper" as const,
            start_date: format(taperStart, "yyyy-MM-dd"),
            end_date: format(taperEnd, "yyyy-MM-dd"),
            weekly_hours_target: 5,
          },
          {
            user_id: user.id,
            name: "Recovery",
            type: "recovery" as const,
            start_date: format(recoveryStart, "yyyy-MM-dd"),
            end_date: format(recoveryEnd, "yyyy-MM-dd"),
            weekly_hours_target: 3,
          },
        ].filter((p) => new Date(p.end_date) >= new Date(p.start_date));

        const { error: insertError } = await supabase
          .from("phases")
          .insert(newPhases);

        if (insertError) throw insertError;

        await fetchPhases();
        toast.success("Training plan generated successfully");
        return true;
      } catch (error) {
        console.error("Error generating plan:", error);
        toast.error("Failed to generate training plan");
        return false;
      }
    },
    [user, fetchPhases]
  );

  const clearPhases = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("phases")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      setPhases([]);
    } catch (error) {
      console.error("Error clearing phases:", error);
    }
  }, [user]);

  return { phases, loading, generatePlan, clearPhases, refetch: fetchPhases };
}
