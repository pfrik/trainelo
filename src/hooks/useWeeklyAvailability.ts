import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DayAvailability {
  day_of_week: number;
  minutes: number;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_MINUTES = 60;

export function useWeeklyAvailability() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAvailability();
    }
  }, [user]);

  const fetchAvailability = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("weekly_availability")
        .select("day_of_week, minutes")
        .eq("user_id", user.id)
        .order("day_of_week");

      if (error) throw error;

      // If no data, initialize with defaults
      if (!data || data.length === 0) {
        const defaults: DayAvailability[] = Array.from({ length: 7 }, (_, i) => ({
          day_of_week: i,
          minutes: DEFAULT_MINUTES,
        }));
        setAvailability(defaults);
        await seedDefaults(defaults);
      } else {
        // Fill in any missing days with defaults
        const fullWeek: DayAvailability[] = Array.from({ length: 7 }, (_, i) => {
          const existing = data.find((d) => d.day_of_week === i);
          return existing || { day_of_week: i, minutes: DEFAULT_MINUTES };
        });
        setAvailability(fullWeek);
      }
    } catch (error) {
      console.error("Error fetching availability:", error);
      toast.error("Failed to load availability");
    } finally {
      setLoading(false);
    }
  };

  const seedDefaults = async (defaults: DayAvailability[]) => {
    if (!user) return;

    try {
      const inserts = defaults.map((d) => ({
        user_id: user.id,
        day_of_week: d.day_of_week,
        minutes: d.minutes,
      }));

      const { error } = await supabase.from("weekly_availability").insert(inserts);
      if (error) throw error;
    } catch (error) {
      console.error("Error seeding defaults:", error);
    }
  };

  const updateDay = async (dayOfWeek: number, minutes: number) => {
    if (!user) return;

    // Optimistic update
    setAvailability((prev) =>
      prev.map((d) => (d.day_of_week === dayOfWeek ? { ...d, minutes } : d))
    );

    try {
      const { error } = await supabase
        .from("weekly_availability")
        .upsert(
          {
            user_id: user.id,
            day_of_week: dayOfWeek,
            minutes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,day_of_week" }
        );

      if (error) throw error;
    } catch (error) {
      console.error("Error updating availability:", error);
      toast.error("Failed to save availability");
      // Revert on error
      fetchAvailability();
    }
  };

  return {
    availability,
    loading,
    updateDay,
    dayNames: DAY_NAMES,
  };
}
