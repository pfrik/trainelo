import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * A single day in the weekly schedule.
 * Combines recommendation decision with actual workout completion.
 */
export interface WeekDay {
  day: string;       // "Mon", "Tue", etc.
  dateStr: string;   // YYYY-MM-DD
  dateNum: string;   // day of month ("1", "15", etc.)
  type: string;      // workout type or "Rest"
  detail: string;    // short detail (duration, distance, etc.)
  status: "completed" | "today" | "rest" | "upcoming" | "missed";
}

/**
 * Fetch the current week's schedule by combining:
 * 1. daily_recommendations (what the cron recommended)
 * 2. workouts (what actually happened)
 *
 * Falls back to a minimal "today only" schedule when no data exists.
 */
export function useWeekSchedule() {
  const { user } = useAuth();
  const [days, setDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWeek = useCallback(async () => {
    if (!user) {
      setDays(buildEmptyWeek());
      setLoading(false);
      return;
    }

    const today = new Date();
    const { monday, sunday, dayDates } = getWeekBounds(today);

    // Fetch recommendations and workouts in parallel
    const [recResult, workoutResult] = await Promise.all([
      supabase
        .from("daily_recommendations")
        .select("date, decision, workout_ref")
        .eq("user_id", user.id)
        .gte("date", monday)
        .lte("date", sunday),
      supabase
        .from("workouts")
        .select("started_at, duration_seconds, activity_type, distance_meters")
        .eq("user_id", user.id)
        .gte("started_at", monday + "T00:00:00Z")
        .lte("started_at", sunday + "T23:59:59Z"),
    ]);

    // Index recommendations by date
    const recByDate = new Map<string, { decision: string; workout_ref: string | null }>();
    if (recResult.data) {
      for (const row of recResult.data as Array<{ date: string; decision: string; workout_ref: string | null }>) {
        recByDate.set(row.date, row);
      }
    }

    // Index workouts by date (aggregate if multiple per day)
    const workoutsByDate = new Map<string, { count: number; totalMinutes: number; totalKm: number; type: string }>();
    if (workoutResult.data) {
      for (const row of workoutResult.data as Array<{ started_at: string; duration_seconds: number | null; activity_type: string | null; distance_meters: number | null }>) {
        const dateKey = row.started_at.slice(0, 10);
        const existing = workoutsByDate.get(dateKey) ?? { count: 0, totalMinutes: 0, totalKm: 0, type: "" };
        existing.count++;
        existing.totalMinutes += Math.round((row.duration_seconds ?? 0) / 60);
        existing.totalKm += Math.round((row.distance_meters ?? 0) / 100) / 10;
        existing.type = row.activity_type ?? existing.type;
        workoutsByDate.set(dateKey, existing);
      }
    }

    const todayStr = toDateStr(today);
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const weekDays: WeekDay[] = dayDates.map((dateStr, i) => {
      const rec = recByDate.get(dateStr);
      const workout = workoutsByDate.get(dateStr);
      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;

      // Determine type and detail from recommendation or actual workout
      let type: string;
      let detail: string;

      if (workout && workout.count > 0) {
        type = formatActivityType(workout.type);
        detail = workout.totalKm > 0
          ? `${workout.totalKm} km`
          : `${workout.totalMinutes} min`;
      } else if (rec) {
        type = formatDecision(rec.decision);
        detail = formatWorkoutRef(rec.workout_ref);
      } else {
        type = isToday ? "Today" : isPast ? "No data" : "--";
        detail = "";
      }

      // Determine status
      const isRest = rec?.decision === "rest" || rec?.decision === "active_recovery";
      let status: WeekDay["status"];
      if (isToday) {
        status = "today";
      } else if (workout && workout.count > 0) {
        status = "completed";
      } else if (isRest && isPast) {
        status = "rest";
      } else if (isRest && !isPast) {
        status = "rest";
      } else if (isPast && rec && !workout) {
        status = "missed";
      } else {
        status = "upcoming";
      }

      return {
        day: dayNames[i],
        dateStr,
        dateNum: String(parseInt(dateStr.slice(8), 10)),
        type,
        detail,
        status,
      };
    });

    setDays(weekDays);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  return { days, loading, refetch: fetchWeek };
}

// ============================================================================
// Helpers
// ============================================================================

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekBounds(today: Date) {
  const currentDay = today.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const mon = new Date(today);
  mon.setDate(today.getDate() + mondayOffset);

  const dayDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dayDates.push(toDateStr(d));
  }

  return {
    monday: dayDates[0],
    sunday: dayDates[6],
    dayDates,
  };
}

function buildEmptyWeek(): WeekDay[] {
  const today = new Date();
  const { dayDates } = getWeekBounds(today);
  const todayStr = toDateStr(today);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return dayDates.map((dateStr, i) => ({
    day: dayNames[i],
    dateStr,
    dateNum: String(parseInt(dateStr.slice(8), 10)),
    type: "--",
    detail: "",
    status: dateStr === todayStr ? "today" as const : "upcoming" as const,
  }));
}

function formatDecision(decision: string): string {
  switch (decision) {
    case "train_easy": return "Easy Run";
    case "train_hard": return "Hard Session";
    case "active_recovery": return "Recovery";
    case "rest": return "Rest";
    default: return decision;
  }
}

function formatWorkoutRef(ref: string | null): string {
  if (!ref) return "";
  return ref
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/(\d+)(min|km|m)\b/g, "$1 $2");
}

function formatActivityType(type: string): string {
  if (!type) return "Workout";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
