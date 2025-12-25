import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FocusPeriod, Distribution, Discipline } from "@/types/focus";
import { toast } from "sonner";

// Seed data for new users
const seedFocusPeriods: Omit<FocusPeriod, "id">[] = [
  {
    name: "Ultra Run Focus",
    startDate: new Date("2024-12-01"),
    endDate: new Date("2026-03-29"),
    primaryDiscipline: "Run",
    distribution: { run: 60, bike: 25, swim: 5, strength: 10 },
  },
  {
    name: "Amstel Gold Prep",
    startDate: new Date("2026-03-30"),
    endDate: new Date("2026-04-30"),
    primaryDiscipline: "Bike",
    distribution: { run: 20, bike: 60, swim: 5, strength: 15 },
  },
];

export function useFocusPeriods() {
  const { user } = useAuth();
  const [focusPeriods, setFocusPeriods] = useState<FocusPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  const fetchFocusPeriods = useCallback(async () => {
    if (!user) {
      setFocusPeriods([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("focus_periods")
      .select("*")
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Error fetching focus periods:", error);
      toast.error("Failed to load focus periods");
    } else {
      const mapped: FocusPeriod[] = (data || []).map((p) => ({
        id: p.id,
        name: p.name || "",
        startDate: new Date(p.start_date),
        endDate: new Date(p.end_date),
        primaryDiscipline: (p.primary_discipline || "Balanced") as Discipline,
        distribution: {
          run: p.run_pct || 25,
          bike: p.bike_pct || 25,
          swim: p.swim_pct || 25,
          strength: p.strength_pct || 25,
        },
      }));
      setFocusPeriods(mapped);
      
      if (mapped.length === 0 && !seeded) {
        setSeeded(true);
        await seedInitialPeriods();
      }
    }
    setLoading(false);
  }, [user, seeded]);

  const seedInitialPeriods = async () => {
    if (!user) return;
    
    for (const period of seedFocusPeriods) {
      await supabase.from("focus_periods").insert({
        user_id: user.id,
        name: period.name,
        start_date: period.startDate.toISOString().split("T")[0],
        end_date: period.endDate.toISOString().split("T")[0],
        primary_discipline: period.primaryDiscipline,
        run_pct: period.distribution.run,
        bike_pct: period.distribution.bike,
        swim_pct: period.distribution.swim,
        strength_pct: period.distribution.strength,
      });
    }
    
    await fetchFocusPeriods();
  };

  useEffect(() => {
    fetchFocusPeriods();
  }, [fetchFocusPeriods]);

  const addFocusPeriod = async (period: Omit<FocusPeriod, "id">) => {
    if (!user) return;

    const { error } = await supabase.from("focus_periods").insert({
      user_id: user.id,
      name: period.name,
      start_date: period.startDate.toISOString().split("T")[0],
      end_date: period.endDate.toISOString().split("T")[0],
      primary_discipline: period.primaryDiscipline,
      run_pct: period.distribution.run,
      bike_pct: period.distribution.bike,
      swim_pct: period.distribution.swim,
      strength_pct: period.distribution.strength,
    });

    if (error) {
      console.error("Error adding focus period:", error);
      toast.error("Failed to add focus period");
    } else {
      await fetchFocusPeriods();
    }
  };

  const updateFocusPeriod = async (id: string, period: Omit<FocusPeriod, "id">) => {
    if (!user) return;

    const { error } = await supabase
      .from("focus_periods")
      .update({
        name: period.name,
        start_date: period.startDate.toISOString().split("T")[0],
        end_date: period.endDate.toISOString().split("T")[0],
        primary_discipline: period.primaryDiscipline,
        run_pct: period.distribution.run,
        bike_pct: period.distribution.bike,
        swim_pct: period.distribution.swim,
        strength_pct: period.distribution.strength,
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating focus period:", error);
      toast.error("Failed to update focus period");
    } else {
      await fetchFocusPeriods();
    }
  };

  const deleteFocusPeriod = async (id: string) => {
    if (!user) return;

    const { error } = await supabase.from("focus_periods").delete().eq("id", id);

    if (error) {
      console.error("Error deleting focus period:", error);
      toast.error("Failed to delete focus period");
    } else {
      await fetchFocusPeriods();
    }
  };

  return { focusPeriods, loading, addFocusPeriod, updateFocusPeriod, deleteFocusPeriod, refetch: fetchFocusPeriods };
}
