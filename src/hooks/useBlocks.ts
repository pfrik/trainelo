import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ExternalBlock, BlockDiscipline, BlockSource, WorkoutType } from "@/types/block";
import { toast } from "sonner";

// Get dates for this week's seed blocks
const getThisWeekDates = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  return {
    tuesday: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 1),
    thursday: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3),
    saturday: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 5),
  };
};

const getSeedBlocks = (): Omit<ExternalBlock, "id">[] => {
  const thisWeek = getThisWeekDates();
  return [
    {
      title: "TR: Pettit",
      date: thisWeek.tuesday,
      startTime: "06:00",
      duration: 60,
      discipline: "Bike",
      source: "TrainerRoad",
      isFixed: true,
      completed: false,
      workoutType: "Easy",
    },
    {
      title: "TR: Geiger",
      date: thisWeek.thursday,
      startTime: "06:00",
      duration: 75,
      discipline: "Bike",
      source: "TrainerRoad",
      isFixed: true,
      completed: false,
      workoutType: "Intervals",
    },
    {
      title: "TR: Tallac",
      date: thisWeek.saturday,
      startTime: "07:00",
      duration: 90,
      discipline: "Bike",
      source: "TrainerRoad",
      isFixed: true,
      completed: false,
      workoutType: "Long",
    },
  ];
};

// Map database source values to frontend types
const mapSource = (source: string | null): BlockSource => {
  if (!source) return "Manual";
  const lower = source.toLowerCase();
  if (lower === "trainerroad") return "TrainerRoad";
  if (lower === "coach") return "Coach";
  return "Manual";
};

// Map frontend source to database value
const toDbSource = (source: BlockSource): string => {
  if (source === "TrainerRoad") return "trainerroad";
  if (source === "Coach") return "coach";
  return "manual";
};

export function useBlocks() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<ExternalBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  const fetchBlocks = useCallback(async () => {
    if (!user) {
      setBlocks([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("external_blocks")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching blocks:", error);
      toast.error("Failed to load training blocks");
    } else {
      const mapped: ExternalBlock[] = (data || []).map((b) => ({
        id: b.id,
        title: b.title,
        date: new Date(b.date),
        startTime: b.start_time?.slice(0, 5) || "06:00",
        duration: b.duration_minutes || 60,
        discipline: (b.discipline || "Bike") as BlockDiscipline,
        source: mapSource(b.source),
        isFixed: b.is_fixed ?? true,
        completed: b.completed ?? false,
        workoutType: (b.workout_type as WorkoutType) || undefined,
        description: b.description || undefined,
      }));
      setBlocks(mapped);
      
      if (mapped.length === 0 && !seeded) {
        setSeeded(true);
        await seedInitialBlocks();
      }
    }
    setLoading(false);
  }, [user, seeded]);

  const seedInitialBlocks = async () => {
    if (!user) return;
    
    const seedBlocks = getSeedBlocks();
    for (const block of seedBlocks) {
      await supabase.from("external_blocks").insert({
        user_id: user.id,
        title: block.title,
        date: block.date.toISOString().split("T")[0],
        start_time: block.startTime,
        duration_minutes: block.duration,
        discipline: block.discipline,
        source: toDbSource(block.source),
        is_fixed: block.isFixed,
        completed: block.completed,
        workout_type: block.workoutType,
      });
    }
    
    await fetchBlocks();
  };

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const addBlock = async (block: Omit<ExternalBlock, "id">) => {
    if (!user) return;

    const { error } = await supabase.from("external_blocks").insert({
      user_id: user.id,
      title: block.title,
      date: block.date.toISOString().split("T")[0],
      start_time: block.startTime,
      duration_minutes: block.duration,
      discipline: block.discipline,
      source: toDbSource(block.source),
      is_fixed: block.isFixed,
      completed: block.completed,
      workout_type: block.workoutType,
    });

    if (error) {
      console.error("Error adding block:", error);
      toast.error("Failed to add training block");
    } else {
      await fetchBlocks();
    }
  };

  const updateBlock = async (id: string, block: Omit<ExternalBlock, "id">) => {
    if (!user) return;

    const { error } = await supabase
      .from("external_blocks")
      .update({
        title: block.title,
        date: block.date.toISOString().split("T")[0],
        start_time: block.startTime,
        duration_minutes: block.duration,
        discipline: block.discipline,
        source: toDbSource(block.source),
        is_fixed: block.isFixed,
        completed: block.completed,
        workout_type: block.workoutType,
        description: block.description || null,
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating block:", error);
      toast.error("Failed to update training block");
    } else {
      await fetchBlocks();
    }
  };

  const deleteBlock = async (id: string) => {
    if (!user) return;

    const { error } = await supabase.from("external_blocks").delete().eq("id", id);

    if (error) {
      console.error("Error deleting block:", error);
      toast.error("Failed to delete training block");
    } else {
      await fetchBlocks();
    }
  };

  const toggleComplete = async (id: string) => {
    if (!user) return;
    
    const block = blocks.find(b => b.id === id);
    if (!block) return;

    const { error } = await supabase
      .from("external_blocks")
      .update({ completed: !block.completed })
      .eq("id", id);

    if (error) {
      console.error("Error toggling completion:", error);
      toast.error("Failed to update workout status");
    } else {
      // Optimistic update for snappy UI
      setBlocks(prev => prev.map(b => 
        b.id === id ? { ...b, completed: !b.completed } : b
      ));
    }
  };

  const updateDescription = async (id: string, description: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("external_blocks")
      .update({ description })
      .eq("id", id);

    if (error) {
      console.error("Error updating description:", error);
      toast.error("Failed to save notes");
    } else {
      setBlocks(prev => prev.map(b =>
        b.id === id ? { ...b, description } : b
      ));
    }
  };

  return { blocks, loading, addBlock, updateBlock, deleteBlock, toggleComplete, updateDescription, refetch: fetchBlocks };
}
