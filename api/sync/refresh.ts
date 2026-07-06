/**
 * POST /api/sync/refresh
 *
 * Sync-on-open: pulls today's wellness from intervals.icu when the app is
 * opened before the 4:00 UTC cron has fresh data (e.g. the watch synced
 * after the cron ran). Called by the dashboard on load.
 *
 * Behavior:
 *   - Skips when today's sleep AND HRV are already present ("fresh")
 *   - Skips when a sync ran in the last 10 minutes ("recently_synced")
 *   - Otherwise runs a 2-day intervals.icu sync and reports what arrived
 *
 * Authentication: Bearer <supabase JWT>; the user must be the configured
 * TRAINELO_USER_ID (single-tenant guard — sync writes via service role).
 *
 * Body (optional): { date?: "YYYY-MM-DD" }  — client's local date;
 * defaults to today UTC.
 *
 * Response:
 *   {
 *     ok: boolean,
 *     synced: boolean,
 *     skipped_reason: "fresh" | "recently_synced" | null,
 *     freshness: {
 *       date: string,
 *       has_sleep: boolean,
 *       has_hrv: boolean,
 *       last_sync_completed_at: string | null
 *     }
 *   }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createLogger, generateRequestId, timer } from "../../src/lib/core/observability/log.js";
import { cleanEnvValue, resolveUserId } from "../../src/lib/api/resolveUser.js";
import { runIntervalsSync } from "../../src/lib/sync/intervalsSync.js";
import { shiftDate } from "../../src/lib/core/intervals/transformWellness.js";

const MIN_SYNC_INTERVAL_MS = 10 * 60 * 1000;

function getServiceClient(): SupabaseClient {
  const url = cleanEnvValue(process.env.SUPABASE_URL);
  const key = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface Freshness {
  date: string;
  has_sleep: boolean;
  has_hrv: boolean;
  last_sync_completed_at: string | null;
}

async function getFreshness(
  client: SupabaseClient,
  userId: string,
  date: string,
): Promise<Freshness> {
  const [sleepRes, hrvRes, syncRes] = await Promise.all([
    client.from("sleep_sessions").select("id").eq("user_id", userId).eq("date", date).limit(1),
    client
      .from("hrv_nights")
      .select("hrv_rmssd")
      .eq("user_id", userId)
      .eq("date", date)
      .not("hrv_rmssd", "is", null)
      .limit(1),
    client
      .from("sync_state")
      .select("last_sync_timestamp, last_sync_completed_at")
      .eq("user_id", userId)
      .eq("provider", "intervals_icu")
      .eq("data_type", "wellness")
      .limit(1),
  ]);

  return {
    date,
    has_sleep: (sleepRes.data?.length ?? 0) > 0,
    has_hrv: (hrvRes.data?.length ?? 0) > 0,
    last_sync_completed_at: syncRes.data?.[0]?.last_sync_completed_at ?? null,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const log = createLogger("sync/refresh", generateRequestId());
  const t = timer();

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization;
  const userId = authHeader ? await resolveUserId(authHeader) : null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Single-tenant guard: the sync writes with the service role, so only
  // the configured account may trigger it.
  const configuredUserId = cleanEnvValue(process.env.TRAINELO_USER_ID);
  if (!configuredUserId || userId !== configuredUserId) {
    res.status(403).json({ error: "Sync not configured for this user" });
    return;
  }

  const athleteId = cleanEnvValue(process.env.INTERVALS_ICU_ATHLETE_ID);
  const apiKey = cleanEnvValue(process.env.INTERVALS_ICU_API_KEY);
  if (!athleteId || !apiKey) {
    res.status(500).json({ error: "intervals.icu credentials not configured" });
    return;
  }

  const bodyDate = typeof req.body?.date === "string" ? req.body.date : null;
  const date = bodyDate && /^\d{4}-\d{2}-\d{2}$/.test(bodyDate)
    ? bodyDate
    : new Date().toISOString().slice(0, 10);

  try {
    const client = getServiceClient();
    const before = await getFreshness(client, userId, date);

    if (before.has_sleep && before.has_hrv) {
      res.status(200).json({
        ok: true,
        synced: false,
        skipped_reason: "fresh",
        freshness: before,
      });
      return;
    }

    const lastAttempt = before.last_sync_completed_at
      ? Date.parse(before.last_sync_completed_at)
      : null;
    if (lastAttempt != null && Date.now() - lastAttempt < MIN_SYNC_INTERVAL_MS) {
      res.status(200).json({
        ok: true,
        synced: false,
        skipped_reason: "recently_synced",
        freshness: before,
      });
      return;
    }

    log.info("running sync-on-open", { date, has_sleep: before.has_sleep, has_hrv: before.has_hrv });
    const stats = await runIntervalsSync({
      supabase: client,
      athleteId,
      apiKey,
      userId,
      oldest: shiftDate(date, -1),
      newest: date,
      log: (message, context) => log.info(message, context),
    });

    const after = await getFreshness(client, userId, date);
    log.info("sync-on-open completed", {
      wellness_upserted: stats.wellness.upserted,
      errors: stats.errors.length,
      duration_ms: t.elapsed(),
    });

    res.status(200).json({
      ok: stats.errors.length === 0,
      synced: true,
      skipped_reason: null,
      freshness: after,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("sync-on-open failed", { error: message, duration_ms: t.elapsed() });
    res.status(500).json({ error: "Sync failed" });
  }
}
