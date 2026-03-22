import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { WeekDay } from "./useWeekSchedule";

/**
 * Fetch schedule data for either a week or a full month.
 * Combines daily_recommendations + workouts (same logic as useWeekSchedule
 * but supports arbitrary date ranges for navigation and month view).
 */
export function useCalendarSchedule(mode: "week" | "month", refDate: Date) {
  const { user } = useAuth();
  const [days, setDays] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable key to avoid re-running on Date object identity changes
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

      // Monday of week containing month start
      const startBounds = getWeekBounds(monthStart);
      startStr = startBounds.monday;

      // Sunday of week containing month end
      const endDow = monthEnd.getDay();
      const sundayAfter = new Date(monthEnd);
      if (endDow !== 0) sundayAfter.setDate(monthEnd.getDate() + (7 - endDow));
      endStr = toDateStr(sundayAfter);

      // Generate all dates in range
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
          "started_at, duration_seconds, activity_type, distance_meters"
        )
        .eq("user_id", user.id)
        .gte("started_at", startStr + "T00:00:00Z")
        .lte("started_at", endStr + "T23:59:59Z"),
    ]);

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

    const workoutsByDate = new Map<
      string,
      { count: number; totalMinutes: number; totalKm: number; type: string }
    >();
    if (workoutResult.data) {
      for (const row of workoutResult.data as Array<{
        started_at: string;
        duration_seconds: number | null;
        activity_type: string | null;
        distance_meters: number | null;
      }>) {
        const dateKey = row.started_at.slice(0, 10);
        const existing = workoutsByDate.get(dateKey) ?? {
          count: 0,
          totalMinutes: 0,
          totalKm: 0,
          type: "",
        };
        existing.count++;
        existing.totalMinutes += Math.round(
          (row.duration_seconds ?? 0) / 60
        );
        existing.totalKm +=
          Math.round((row.distance_meters ?? 0) / 100) / 10;
        existing.type = row.activity_type ?? existing.type;
        workoutsByDate.set(dateKey, existing);
      }
    }

    const todayStr = toDateStr(new Date());
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const result: WeekDay[] = dayDates.map((dateStr) => {
      const d = new Date(dateStr + "T12:00:00");
      const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0 … Sun=6

      const rec = recByDate.get(dateStr);
      const workout = workoutsByDate.get(dateStr);
      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;

      let type: string;
      let detail: string;

      if (workout && workout.count > 0) {
        type = formatActivityType(workout.type);
        detail =
          workout.totalKm > 0
            ? `${workout.totalKm} km`
            : `${workout.totalMinutes} min`;
      } else if (rec) {
        type = formatDecision(rec.decision);
        detail = formatWorkoutRef(rec.workout_ref);
      } else {
        type = isToday ? "Today" : isPast ? "No data" : "--";
        detail = "";
      }

      const isRest =
        rec?.decision === "rest" || rec?.decision === "active_recovery";
      let status: WeekDay["status"];
      if (isToday) status = "today";
      else if (workout && workout.count > 0) status = "completed";
      else if (isRest) status = "rest";
      else if (isPast && rec && !workout) status = "missed";
      else status = "upcoming";

      return {
        day: dayNames[dayOfWeek],
        dateStr,
        dateNum: String(d.getDate()),
        type,
        detail,
        status,
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

// ── helpers (same logic as useWeekSchedule) ──

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
