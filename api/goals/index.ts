/**
 * /api/goals
 * Vercel Serverless Function: CRUD for training goals + plan generation.
 *
 * GET    /api/goals                             — list user's goals
 * POST   /api/goals                             — create a new goal
 * POST   /api/goals?action=generate-plan&id=<uuid> — generate training plan
 * PUT    /api/goals?id=<uuid>                   — update a goal
 * DELETE /api/goals?id=<uuid>                   — cancel a goal (soft delete)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLogger, generateRequestId } from "../../src/lib/core/observability/log.js";
import { periodize } from "../../src/lib/core/training/periodize.js";
import { detectRaceCategory } from "../../src/lib/core/training/sportConfig.js";
import type { GoalInput, Sport, RaceCategory } from "../../src/lib/core/training/types.js";
import {
  getUserGoals,
  getGoalById,
  createGoal,
  updateGoal,
  getRecentWeeklyVolume,
  clearPlanForGoal,
  insertPlanWeeks,
  insertPlannedWorkouts,
} from "../../src/lib/db/goalQueries.js";

// ============================================================================
// Schemas
// ============================================================================

const CreateGoalSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sport: z.enum(["running", "cycling", "swimming", "triathlon"]),
  race_distance_km: z.number().positive(),
  target_time_minutes: z.number().int().positive().optional(),
  priority: z.enum(["A", "B", "C"]).default("A"),
  training_days_per_week: z.number().int().min(3).max(7).default(5),
});

const UpdateGoalSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sport: z.enum(["running", "cycling", "swimming", "triathlon"]).optional(),
  race_distance_km: z.number().positive().optional(),
  target_time_minutes: z.number().int().positive().nullable().optional(),
  priority: z.enum(["A", "B", "C"]).optional(),
  training_days_per_week: z.number().int().min(3).max(7).optional(),
  status: z.enum(["active", "completed", "paused", "cancelled"]).optional(),
});

// ============================================================================
// Auth helper
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
  const reqLog = createLogger("goals", generateRequestId());

  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Route: POST /api/goals?action=generate-plan&id=<uuid>
    if (req.method === "POST" && req.query.action === "generate-plan") {
      await handleGeneratePlan(req, res, userId, reqLog);
      return;
    }

    switch (req.method) {
      case "GET": {
        const goals = await getUserGoals(userId);
        res.status(200).json({ ok: true, goals });
        return;
      }

      case "POST": {
        const parsed = CreateGoalSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
          return;
        }

        const goal = await createGoal({
          user_id: userId,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          target_date: parsed.data.target_date,
          status: "active",
          goal_type: "performance",
          sport: parsed.data.sport,
          race_distance_km: parsed.data.race_distance_km,
          target_time_minutes: parsed.data.target_time_minutes ?? null,
          priority: parsed.data.priority,
          training_days_per_week: parsed.data.training_days_per_week,
          plan_status: "draft",
        });

        reqLog.info("goal created", { goal_id: goal.id, user_id: userId });
        res.status(201).json({ ok: true, goal });
        return;
      }

      case "PUT": {
        const goalId = req.query.id as string;
        if (!goalId) {
          res.status(400).json({ error: "Missing goal id query parameter" });
          return;
        }

        const parsed = UpdateGoalSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
          return;
        }

        const goal = await updateGoal(goalId, userId, parsed.data as Record<string, unknown>);
        reqLog.info("goal updated", { goal_id: goalId, user_id: userId });
        res.status(200).json({ ok: true, goal });
        return;
      }

      case "DELETE": {
        const goalId = req.query.id as string;
        if (!goalId) {
          res.status(400).json({ error: "Missing goal id query parameter" });
          return;
        }

        await updateGoal(goalId, userId, { status: "cancelled" } as Record<string, unknown>);
        reqLog.info("goal cancelled", { goal_id: goalId, user_id: userId });
        res.status(200).json({ ok: true });
        return;
      }

      default:
        res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    reqLog.error("goals handler error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Internal server error" });
  }
}

// ============================================================================
// Plan Generation Sub-handler
// ============================================================================

async function handleGeneratePlan(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  log: ReturnType<typeof createLogger>,
): Promise<void> {
  const goalId = req.query.id as string;
  if (!goalId) {
    res.status(400).json({ error: "Missing goal id query parameter" });
    return;
  }

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

  const currentWeeklyVolumeKm = await getRecentWeeklyVolume(userId, 4);
  log.info("fitness estimate", { user_id: userId, current_weekly_volume_km: currentWeeklyVolumeKm });

  const catConfig = detectRaceCategory(goal.sport, Number(goal.race_distance_km));
  if (!catConfig) {
    res.status(400).json({
      error: `No training plan template for ${goal.sport} at ${goal.race_distance_km}km`,
    });
    return;
  }

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

  await clearPlanForGoal(goalId, userId);

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
