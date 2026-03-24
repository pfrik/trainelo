/**
 * GET /api/cron/plan-compliance
 *
 * Vercel Cron Job: Checks yesterday's planned workouts against completed workouts.
 * Marks missed workouts and updates weekly compliance metrics.
 *
 * Runs daily after the main recommendation cron.
 *
 * Authentication: Bearer <CRON_SECRET>
 */

import { createClient } from "@supabase/supabase-js";
import { createLogger, generateRequestId, timer } from "../../src/lib/core/observability/log.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

function cleanEnv(key: string): string | null {
  const raw = process.env[key];
  if (!raw) return null;
  return raw.replace(/^["']|["']$/g, "").trim() || null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const log = createLogger("plan-compliance", generateRequestId());
  const total = timer();

  // Auth: CRON_SECRET
  const cronSecret = cleanEnv("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const supabaseUrl = cleanEnv("SUPABASE_URL");
  const serviceKey = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Missing Supabase config" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Target: yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().slice(0, 10);

    log.info("checking compliance", { target_date: targetDate });

    // 1. Fetch all planned workouts for yesterday that are still 'planned'
    const { data: planned, error: planError } = await supabase
      .from("planned_workouts")
      .select("id, user_id, goal_id, workout_type, distance_km, week_number")
      .eq("planned_date", targetDate)
      .eq("status", "planned");

    if (planError) {
      log.error("fetch planned error", { error: planError.message });
      res.status(500).json({ error: planError.message });
      return;
    }

    if (!planned || planned.length === 0) {
      log.info("no planned workouts for yesterday");
      res.status(200).json({ ok: true, target_date: targetDate, checked: 0, missed: 0 });
      return;
    }

    // 2. For each planned workout, check if a matching completed workout exists
    let missed = 0;
    let completed = 0;

    for (const pw of planned) {
      // Check if any workout was completed by this user on the target date
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id, duration_seconds, distance_meters")
        .eq("user_id", pw.user_id)
        .gte("started_at", `${targetDate}T00:00:00Z`)
        .lt("started_at", `${targetDate}T23:59:59Z`)
        .limit(1);

      if (workouts && workouts.length > 0) {
        // Mark as completed
        await supabase
          .from("planned_workouts")
          .update({ status: "completed" })
          .eq("id", pw.id);
        completed++;
      } else {
        // Mark as missed
        await supabase
          .from("planned_workouts")
          .update({ status: "missed" })
          .eq("id", pw.id);
        missed++;
      }
    }

    // 3. Update weekly compliance for affected goals
    const goalIds = [...new Set(planned.map((pw) => pw.goal_id).filter(Boolean))];
    for (const goalId of goalIds) {
      const weekNumbers = [
        ...new Set(
          planned
            .filter((pw) => pw.goal_id === goalId)
            .map((pw) => pw.week_number)
            .filter(Boolean),
        ),
      ];

      for (const weekNum of weekNumbers) {
        // Count total and completed for this week
        const { data: weekWorkouts } = await supabase
          .from("planned_workouts")
          .select("status")
          .eq("goal_id", goalId)
          .eq("week_number", weekNum);

        if (weekWorkouts && weekWorkouts.length > 0) {
          const total = weekWorkouts.length;
          const done = weekWorkouts.filter(
            (w) => w.status === "completed",
          ).length;
          const pct = Math.round((done / total) * 100);

          await supabase
            .from("training_plan_weeks")
            .update({ compliance_pct: pct })
            .eq("goal_id", goalId)
            .eq("week_number", weekNum);
        }
      }
    }

    const elapsedMs = total.elapsed();
    log.info("compliance check complete", {
      target_date: targetDate,
      checked: planned.length,
      completed,
      missed,
      goals_updated: goalIds.length,
      elapsed_ms: elapsedMs,
    });

    res.status(200).json({
      ok: true,
      target_date: targetDate,
      checked: planned.length,
      completed,
      missed,
      goals_updated: goalIds.length,
      elapsed_ms: elapsedMs,
    });
  } catch (error) {
    log.error("compliance cron error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Internal error" });
  }
}
