import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** A single workout entry (not aggregated). */
export interface CalendarWorkout {
  id?: string;    // workout ID from database (absent for recommendation-only entries)
  type: string;   // display name: "Run", "Bike Indoor", "Swim Pool"
  detail: string; // "13.1 km" or "45 min"
}

/** A single calendar day with all its workouts. */
export interface CalendarDay {
  day: string;        // "Mon", "Tue", etc.
  dateStr: string;    // YYYY-MM-DD
  dateNum: string;    // "3", "15", etc.
  status: "completed" | "today" | "rest" | "upcoming" | "missed";
  workouts: CalendarWorkout[];
}

/**
 * Fetch schedule data for either a week or a full month.
 * Returns individual workouts per day (not aggregated).
 */
export function useCalendarSchedule(mode: "week" | "month", refDate: Date) {
  const { user } = useAuth();
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  const refKey = `${mode}-${refDate.getFullYear()}-${refDate.getMonth()}-${refDate.getDate()}`;

  const fetchSchedule = useCallback(async () => {
    setLoading(true);

    if (!user) {
      setDays([]);
      setLoading(false);
      return;
    }

    let startStr: string;
    let endStr: string;
    let dayDates: string[];

    if (mode === "week") {
      const bounds = getWeekBounds(refDate);
      startStr = bounds.monday;
      endStr = bounds.sunday;
      dayDates = bounds.dayDates;
    } else {
      const year = refDate.getFullYear();
      const month = refDate.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      const startBounds = getWeekBounds(monthStart);
      startStr = startBounds.monday;

      const endDow = monthEnd.getDay();
      const sundayAfter = new Date(monthEnd);
      if (endDow !== 0) sundayAfter.setDate(monthEnd.getDate() + (7 - endDow));
      endStr = toDateStr(sundayAfter);

      dayDates = [];
      const cur = new Date(startStr + "T12:00:00");
      while (toDateStr(cur) <= endStr) {
        dayDates.push(toDateStr(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    const [recResult, workoutResult] = await Promise.all([
      supabase
        .from("daily_recommendations")
        .select("date, decision, workout_ref")
        .eq("user_id", user.id)
        .gte("date", startStr)
        .lte("date", endStr),
      supabase
        .from("workouts")
        .select(
          "id, started_at, duration_seconds, activity_type, distance_meters, title"
        )
        .eq("user_id", user.id)
        .gte("started_at", startStr + "T00:00:00Z")
        .lte("started_at", endStr + "T23:59:59Z")
        .order("started_at", { ascending: true }),
    ]);

    // Index recommendations by date
    const recByDate = new Map<
      string,
      { decision: string; workout_ref: string | null }
    >();
    if (recResult.data) {
      for (const row of recResult.data as Array<{
        date: string;
        decision: string;
        workout_ref: string | null;
      }>) {
        recByDate.set(row.date, row);
      }
    }

    // Group individual workouts by date (no aggregation)
    const workoutsByDate = new Map<string, CalendarWorkout[]>();
    if (workoutResult.data) {
      for (const row of workoutResult.data as Array<{
        id: string;
        started_at: string;
        duration_seconds: number | null;
        activity_type: string | null;
        distance_meters: number | null;
        title: string | null;
      }>) {
        const dateKey = row.started_at.slice(0, 10);
        if (!workoutsByDate.has(dateKey)) workoutsByDate.set(dateKey, []);

        // Display name: prefer good activity_type, fall back to title
        const actType = row.activity_type ?? "other";
        const hasGoodType = actType !== "other" && actType !== "";
        const type = hasGoodType
          ? formatActivityType(actType)
          : row.title || formatActivityType(actType);

        // Detail: distance (formatted) or duration
        const distKm = (row.distance_meters ?? 0) / 1000;
        const durMin = Math.round((row.duration_seconds ?? 0) / 60);
        const detail =
          distKm >= 0.05 ? `${distKm.toFixed(1)} km` : `${durMin} min`;

        workoutsByDate.get(dateKey)!.push({ id: row.id, type, detail });
      }
    }

    const todayStr = toDateStr(new Date());
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const result: CalendarDay[] = dayDates.map((dateStr) => {
      const d = new Date(dateStr + "T12:00:00");
      const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0 … Sun=6

      const rec = recByDate.get(dateStr);
      const dayWorkouts = workoutsByDate.get(dateStr) || [];
      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;

      // Build workouts array
      let workouts: CalendarWorkout[];
      if (dayWorkouts.length > 0) {
        workouts = dayWorkouts;
      } else if (rec) {
        workouts = [
          {
            type: formatDecision(rec.decision),
            detail: formatWorkoutRef(rec.workout_ref),
          },
        ];
      } else {
        workouts = [];
      }

      // Determine day status
      const isRest =
        rec?.decision === "rest" || rec?.decision === "active_recovery";
      let status: CalendarDay["status"];
      if (isToday) status = "today";
      else if (dayWorkouts.length > 0) status = "completed";
      else if (isRest) status = "rest";
      else if (isPast && rec && dayWorkouts.length === 0) status = "missed";
      else status = "upcoming";

      return {
        day: dayNames[dayOfWeek],
        dateStr,
        dateNum: String(d.getDate()),
        status,
        workouts,
      };
    });

    setDays(result);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refKey]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return { days, loading };
}

// ── helpers ──

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekBounds(ref: Date) {
  const currentDay = ref.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const mon = new Date(ref);
  mon.setDate(ref.getDate() + mondayOffset);

  const dayDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dayDates.push(toDateStr(d));
  }

  return { monday: dayDates[0], sunday: dayDates[6], dayDates };
}

function formatDecision(decision: string): string {
  switch (decision) {
    case "train_easy":
      return "Easy Run";
    case "train_hard":
      return "Hard Session";
    case "active_recovery":
      return "Recovery";
    case "rest":
      return "Rest";
    default:
      return decision;
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
