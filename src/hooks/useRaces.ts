import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Race, Priority, SportType, GoalType, DistanceUnit } from "@/types/race";
import { toast } from "sonner";

// Seed data for new users
const seedRaces: Omit<Race, "id">[] = [
  {
    name: "Vondelparkloop - 10km",
    date: new Date("2026-01-18"),
    sport: "Run",
    distance: 10,
    distanceUnit: "km",
    priority: "B",
    goalType: "Finish",
    goalValue: "Test fitness",
  },
  {
    name: "Amstel Gold Race",
    date: new Date("2026-04-18"),
    sport: "Bike",
    distance: 250,
    distanceUnit: "km",
    priority: "B",
    goalType: "Finish",
    goalValue: "Finish strong",
  },
  {
    name: "Sprint Triathlon",
    date: new Date("2026-05-17"),
    sport: "Triathlon",
    distance: 25,
    distanceUnit: "km",
    priority: "A",
    goalType: "Finish",
    goalValue: "Finish strong",
  },
  {
    name: "Zestig van Texel",
    date: new Date("2026-03-29"),
    sport: "Run",
    distance: 60,
    distanceUnit: "km",
    priority: "A",
    goalType: "Finish",
    goalValue: "Finish strong",
  },
];

export function useRaces() {
  const { user } = useAuth();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  const fetchRaces = useCallback(async () => {
    if (!user) {
      setRaces([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("races")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching races:", error);
      toast.error("Failed to load races");
    } else {
      const mappedRaces: Race[] = (data || []).map((r) => ({
        id: r.id,
        name: r.name,
        date: new Date(r.date),
        sport: r.sport as SportType,
        distance: r.distance_km || 0,
        distanceUnit: "km" as DistanceUnit,
        priority: r.priority as Priority,
        goalType: (r.goal_type || "Finish") as GoalType,
        goalValue: r.goal_value || "",
      }));
      setRaces(mappedRaces);
      
      // Seed data for new users
      if (mappedRaces.length === 0 && !seeded) {
        setSeeded(true);
        await seedInitialRaces();
      }
    }
    setLoading(false);
  }, [user, seeded]);

  const seedInitialRaces = async () => {
    if (!user) return;
    
    for (const race of seedRaces) {
      await supabase.from("races").insert({
        user_id: user.id,
        name: race.name,
        date: race.date.toISOString().split("T")[0],
        sport: race.sport,
        distance_km: race.distance,
        priority: race.priority,
        goal_type: race.goalType,
        goal_value: race.goalValue,
      });
    }
    
    await fetchRaces();
  };

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  const addRace = async (race: Omit<Race, "id">) => {
    if (!user) return;

    const { error } = await supabase.from("races").insert({
      user_id: user.id,
      name: race.name,
      date: race.date.toISOString().split("T")[0],
      sport: race.sport,
      distance_km: race.distance,
      priority: race.priority,
      goal_type: race.goalType,
      goal_value: race.goalValue,
    });

    if (error) {
      console.error("Error adding race:", error);
      toast.error("Failed to add race");
    } else {
      await fetchRaces();
    }
  };

  const updateRace = async (id: string, race: Omit<Race, "id">) => {
    if (!user) return;

    const { error } = await supabase
      .from("races")
      .update({
        name: race.name,
        date: race.date.toISOString().split("T")[0],
        sport: race.sport,
        distance_km: race.distance,
        priority: race.priority,
        goal_type: race.goalType,
        goal_value: race.goalValue,
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating race:", error);
      toast.error("Failed to update race");
    } else {
      await fetchRaces();
    }
  };

  const deleteRace = async (id: string) => {
    if (!user) return;

    const { error } = await supabase.from("races").delete().eq("id", id);

    if (error) {
      console.error("Error deleting race:", error);
      toast.error("Failed to delete race");
    } else {
      await fetchRaces();
    }
  };

  return { races, loading, addRace, updateRace, deleteRace, refetch: fetchRaces };
}
