/**
 * GET /api/cron/intervals-sync
 *
 * Vercel Cron Job: Pulls wellness and activities from intervals.icu into the
 * canonical Supabase tables. Replaces the local Garmin scraper path — data
 * flows Garmin watch → Garmin Connect → intervals.icu (official server-side
 * integration) → this endpoint.
 *
 * Authentication:
 *   - Authorization: Bearer <CRON_SECRET> (Vercel Cron standard)
 *
 * Query Parameters:
 *   - days:   Lookback window in days (default 3, max 120)
 *   - dryRun: "1" to preview without writing to database
 *
 * Environment:
 *   - INTERVALS_ICU_ATHLETE_ID, INTERVALS_ICU_API_KEY
 *   - TRAINELO_USER_ID (the single-user account all data belongs to)
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createLogger, generateRequestId, timer, type Logger } from "../../src/lib/core/observability/log.js";
import { runIntervalsSync } from "../../src/lib/sync/intervalsSync.js";

const DEFAULT_LOOKBACK_DAYS = 3;
const MAX_LOOKBACK_DAYS = 120;

function sanitizeEnvValue(value: string | undefined): string | null {
  if (!value) return null;
  const withoutControl = value.replace(/[\u0000-\u001F\u007F]/g, "");
  const trimmed = withoutControl.trim();
  if (!trimmed) return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || null;
  }
  return trimmed;
}

function getSupabaseClient(): SupabaseClient {
  const url = sanitizeEnvValue(process.env.SUPABASE_URL);
  const key = sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isAuthorized(request: Request, log: Logger): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = sanitizeEnvValue(process.env.CRON_SECRET);

  if (!cronSecret) {
    log.warn("CRON_SECRET not configured");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request): Promise<Response> {
  const requestId = generateRequestId();
  const log = createLogger("intervals-sync", requestId);
  const t = timer();

  const headers = { "cache-control": "no-store" };

  if (!isAuthorized(request, log)) {
    log.warn("unauthorized request");
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const daysParam = Number(url.searchParams.get("days"));
  const days = Number.isInteger(daysParam) && daysParam >= 1 && daysParam <= MAX_LOOKBACK_DAYS
    ? daysParam
    : DEFAULT_LOOKBACK_DAYS;

  const athleteId = sanitizeEnvValue(process.env.INTERVALS_ICU_ATHLETE_ID);
  const apiKey = sanitizeEnvValue(process.env.INTERVALS_ICU_API_KEY);
  const userId = sanitizeEnvValue(process.env.TRAINELO_USER_ID);

  const missing: string[] = [];
  if (!athleteId) missing.push("INTERVALS_ICU_ATHLETE_ID");
  if (!apiKey) missing.push("INTERVALS_ICU_API_KEY");
  if (!userId) missing.push("TRAINELO_USER_ID");
  if (missing.length > 0) {
    log.error("missing environment variables", { missing });
    return Response.json(
      { ok: false, error: `Missing environment variables: ${missing.join(", ")}` },
      { status: 500, headers },
    );
  }

  const newest = new Date().toISOString().slice(0, 10);
  const oldestDate = new Date();
  oldestDate.setUTCDate(oldestDate.getUTCDate() - days);
  const oldest = oldestDate.toISOString().slice(0, 10);

  log.info("starting intervals.icu sync", { oldest, newest, days, dry_run: dryRun });

  try {
    const supabase = getSupabaseClient();
    const stats = await runIntervalsSync({
      supabase,
      athleteId: athleteId!,
      apiKey: apiKey!,
      userId: userId!,
      oldest,
      newest,
      dryRun,
      log: (message, context) => log.info(message, context),
    });

    const durationMs = t.elapsed();
    log.info("completed", {
      wellness_upserted: stats.wellness.upserted,
      activities_upserted: stats.activities.upserted,
      activities_deduped: stats.activities.deduped,
      errors: stats.errors.length,
      duration_ms: durationMs,
    });

    return Response.json(
      {
        ok: stats.errors.length === 0,
        oldest,
        newest,
        dry_run: dryRun,
        wellness: stats.wellness,
        activities: stats.activities,
        errors: stats.errors.length > 0 ? stats.errors : undefined,
        duration_ms: durationMs,
      },
      { headers },
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("fatal error", { error: errorMsg, duration_ms: t.elapsed() });
    return Response.json(
      { ok: false, error: errorMsg, oldest, newest, dry_run: dryRun },
      { status: 500, headers },
    );
  }
}
