/**
 * /api/goals
 * Vercel Serverless Function: CRUD for training goals.
 *
 * GET  /api/goals           — list user's goals
 * POST /api/goals           — create a new goal
 * PUT  /api/goals?id=<uuid> — update a goal
 * DELETE /api/goals?id=<uuid> — cancel a goal (soft delete)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLogger, generateRequestId } from "../../src/lib/core/observability/log.js";
import {
  getUserGoals,
  getGoalById,
  createGoal,
  updateGoal,
} from "../../src/lib/db/goalQueries.js";

const log = createLogger("goals");

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
// Auth helper (reuses same pattern as other endpoints)
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

  // Fallback for dev
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
