/**
 * POST /api/goals/generate-plan?id=<goal_id>
 * Vercel Serverless Function: Generates a periodized training plan for a goal.
 *
 * 1. Fetches goal details
 * 2. Estimates current fitness from recent Garmin data
 * 3. Runs periodization engine (pure function)
 * 4. Writes training_plan_weeks + planned_workouts to DB
 * 5. Updates goal plan_status → 'active'
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createLogger, generateRequestId } from "../../src/lib/core/observability/log.js";
import { periodize } from "../../src/lib/core/training/periodize.js";
import { detectRaceCategory } from "../../src/lib/core/training/sportConfig.js";
import type { GoalInput, Sport, RaceCategory } from "../../src/lib/core/training/types.js";
import {
  getGoalById,
  updateGoal,
  getRecentWeeklyVolume,
  clearPlanForGoal,
  insertPlanWeeks,
  insertPlannedWorkouts,
} from "../../src/lib/db/goalQueries.js";

// ============================================================================
// Auth (same pattern as goals/index.ts)
// ============================================================================

function cleanEnv(key: string): string | null {
  const raw = process.env[key];
  if (!raw) return null;
  return raw.replace(/^["']|["']$/g, "").trim() || null;
}

async function resolveUserId(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1];

    const supabaseUrl = cleanEnv("SUPABASE_URL") ?? cleanEnv("VITE_SUPABASE_URL");
    const anonKey =
      cleanEnv("SUPABASE_ANON_KEY") ??
      cleanEnv("VITE_SUPABASE_ANON_KEY") ??
      cleanEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) return null;

    const client = createClient(supabaseUrl, anonKey);
    const { data } = await client.auth.getUser(token);
    return data?.user?.id ?? null;
  }
  return cleanEnv("TRAINELO_USER_ID");
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const log = createLogger("generate-plan", generateRequestId());

  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const goalId = req.query.id as string;
    if (!goalId) {
      res.status(400).json({ error: "Missing goal id query parameter" });
      return;
    }

    // 1. Fetch goal
    const goal = await getGoalById(goalId, userId);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    if (!goal.sport || !goal.race_distance_km || !goal.target_date) {
      res.status(400).json({
        error: "Goal must have sport, race_distance_km, and target_date set",
      });
      return;
    }

    // 2. Estimate current fitness
    const currentWeeklyVolumeKm = await getRecentWeeklyVolume(userId, 4);
    log.info("fitness estimate", {
      user_id: userId,
      current_weekly_volume_km: currentWeeklyVolumeKm,
    });

    // 3. Detect race category
    const catConfig = detectRaceCategory(goal.sport, Number(goal.race_distance_km));
    if (!catConfig) {
      res.status(400).json({
        error: `No training plan template for ${goal.sport} at ${goal.race_distance_km}km`,
      });
      return;
    }

    // 4. Run periodization engine
    const today = new Date().toISOString().slice(0, 10);
    const input: GoalInput = {
      sport: goal.sport as Sport,
      raceCategory: catConfig.category as RaceCategory,
      raceDistanceKm: Number(goal.race_distance_km),
      raceDateIso: goal.target_date,
      currentDateIso: today,
      targetTimeMinutes: goal.target_time_minutes ?? null,
      priority: (goal.priority ?? "A") as "A" | "B" | "C",
      currentWeeklyVolumeKm,
      trainingDaysPerWeek: goal.training_days_per_week ?? 5,
    };

    const plan = periodize(input);

    log.info("periodization complete", {
      total_weeks: plan.totalWeeks,
      peak_volume_km: plan.peakWeeklyVolumeKm,
      phases: plan.phases.map((p) => `${p.phase}(${p.startWeek}-${p.endWeek})`),
    });

    // 5. Clear existing plan (if regenerating)
    await clearPlanForGoal(goalId, userId);

    // 6. Write training_plan_weeks
    const weekRows = plan.weeks.map((w) => ({
      user_id: userId,
      goal_id: goalId,
      week_number: w.weekNumber,
      phase: w.phase,
      week_start_date: w.weekStartDate,
      planned_volume_km: w.weeklyVolumeKm,
      planned_hours: Math.round(
        w.workouts.reduce((sum, d) => sum + d.durationMinutes, 0) / 6,
      ) / 10,
    }));

    await insertPlanWeeks(weekRows);

    // 7. Write planned_workouts
    const workoutRows: Array<{
      user_id: string;
      goal_id: string;
      title: string;
      description: string;
      planned_date: string;
      planned_duration_minutes: number;
      workout_type: string;
      intensity_level: number;
      training_phase: string;
      distance_km: number | null;
      template_ref: string;
      sport: string;
      week_number: number;
      day_of_week: number;
      status: string;
    }> = [];

    for (const week of plan.weeks) {
      for (const slot of week.workouts) {
        // Compute actual date for this workout
        const weekStart = new Date(week.weekStartDate);
        const workoutDate = new Date(weekStart);
        workoutDate.setDate(weekStart.getDate() + slot.dayOfWeek);
        const dateIso = workoutDate.toISOString().slice(0, 10);

        workoutRows.push({
          user_id: userId,
          goal_id: goalId,
          title: buildWorkoutTitle(slot.workoutType, slot.durationMinutes, slot.distanceKm),
          description: slot.description,
          planned_date: dateIso,
          planned_duration_minutes: slot.durationMinutes,
          workout_type: slot.workoutType,
          intensity_level: slot.intensityLevel,
          training_phase: week.phase === "recovery" ? "recovery" : week.phase,
          distance_km: slot.distanceKm,
          template_ref: slot.templateRef,
          sport: goal.sport!.slice(0, 3) === "tri" ? inferTriSport(slot.workoutType) : goal.sport!,
          week_number: week.weekNumber,
          day_of_week: slot.dayOfWeek,
          status: "planned",
        });
      }
    }

    await insertPlannedWorkouts(workoutRows);

    // 8. Update goal
    await updateGoal(goalId, userId, {
      plan_status: "active",
      plan_generated_at: new Date().toISOString(),
      plan_weeks: plan.totalWeeks,
      peak_weekly_volume_km: plan.peakWeeklyVolumeKm,
      current_weekly_volume_km: currentWeeklyVolumeKm,
    } as Record<string, unknown>);

    log.info("plan generation complete", {
      goal_id: goalId,
      user_id: userId,
      total_weeks: plan.totalWeeks,
      total_workouts: workoutRows.length,
    });

    res.status(200).json({
      ok: true,
      goal_id: goalId,
      plan: {
        total_weeks: plan.totalWeeks,
        peak_weekly_volume_km: plan.peakWeeklyVolumeKm,
        total_workouts: workoutRows.length,
        phases: plan.phases,
        current_weekly_volume_km: currentWeeklyVolumeKm,
      },
    });
  } catch (error) {
    log.error("plan generation error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: "Plan generation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildWorkoutTitle(
  type: string,
  minutes: number,
  distanceKm: number | null,
): string {
  const typeLabel: Record<string, string> = {
    easy: "Easy Run",
    recovery: "Recovery Jog",
    tempo: "Tempo Run",
    long: "Long Run",
    interval: "Intervals",
    hill: "Hill Repeats",
    endurance: "Endurance Ride",
    brick: "Brick Workout",
    swim_drill: "Swim Drills",
    strength: "Strength",
    mobility: "Mobility",
  };
  const label = typeLabel[type] ?? type;
  const dist = distanceKm ? ` — ${distanceKm}km` : "";
  return `${label} (${minutes} min${dist})`;
}

function inferTriSport(workoutType: string): string {
  switch (workoutType) {
    case "swim_drill":
      return "swimming";
    case "endurance":
    case "brick":
      return "cycling";
    case "strength":
    case "mobility":
      return workoutType;
    default:
      return "running";
  }
}
