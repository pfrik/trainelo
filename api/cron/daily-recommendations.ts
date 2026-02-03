/**
 * GET /api/cron/daily-recommendations
 *
 * Vercel Cron Job: Computes and upserts daily recommendations for all active users.
 *
 * Authentication:
 *   - Authorization: Bearer <CRON_SECRET> (Vercel Cron standard)
 *
 * Query Parameters:
 *   - dryRun: "1" to preview without writing to database
 *   - date: Override target date (YYYY-MM-DD format)
 *
 * Response:
 *   {
 *     ok: boolean,
 *     target_date: string,
 *     users_processed: number,
 *     upserts_ok: number,
 *     upserts_failed: number,
 *     dry_run: boolean,
 *     results?: Array<{ user_id, decision, rationale }>,  // Only in dry run
 *     errors?: string[]
 *   }
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  computeDailyRecommendation,
  type ComputeRecommendationInput,
  type ComputeRecommendationOutput,
  type SleepSessionInput,
  type HrvNightInput,
  type DailyMetricsInput,
  type TrainingLoadInput,
} from "../../src/lib/core/recommendations/computeDailyRecommendation.js";

// ============================================================================
// Configuration
// ============================================================================

const BATCH_SIZE = 5; // Process users in batches to avoid overwhelming DB
const SOURCE = "trainelo"; // Source identifier for recommendations

// ============================================================================
// Environment Helpers
// ============================================================================

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

// ============================================================================
// Authentication
// ============================================================================

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = sanitizeEnvValue(process.env.CRON_SECRET);

  if (!cronSecret) {
    console.warn("[cron] CRON_SECRET not configured");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Get all distinct user_ids that have data for the target date.
 * We check multiple tables to find users with any recent activity.
 */
async function getUserIdsWithData(
  client: SupabaseClient,
  targetDate: string
): Promise<string[]> {
  const userIds = new Set<string>();

  // Check canonical_daily_metrics
  const { data: metricsUsers } = await client
    .from("canonical_daily_metrics")
    .select("user_id")
    .eq("date", targetDate);

  metricsUsers?.forEach((row) => userIds.add(row.user_id));

  // Check sleep_sessions
  const { data: sleepUsers } = await client
    .from("sleep_sessions")
    .select("user_id")
    .eq("date", targetDate);

  sleepUsers?.forEach((row) => userIds.add(row.user_id));

  // Check hrv_nights
  const { data: hrvUsers } = await client
    .from("hrv_nights")
    .select("user_id")
    .eq("date", targetDate);

  hrvUsers?.forEach((row) => userIds.add(row.user_id));

  // Check daily_training_load for today or yesterday
  const yesterday = new Date(targetDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const { data: loadUsers } = await client
    .from("daily_training_load")
    .select("user_id")
    .gte("date", yesterdayStr)
    .lte("date", targetDate);

  loadUsers?.forEach((row) => userIds.add(row.user_id));

  return Array.from(userIds);
}

/**
 * Fetch sleep data for a user on the target date.
 */
async function fetchSleepData(
  client: SupabaseClient,
  userId: string,
  date: string
): Promise<SleepSessionInput | null> {
  const { data, error } = await client
    .from("sleep_sessions")
    .select(
      "date, duration_seconds, sleep_score, deep_seconds, rem_seconds, avg_hrv_ms"
    )
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (error || !data) return null;
  return data as SleepSessionInput;
}

/**
 * Fetch HRV data for a user on the target date.
 */
async function fetchHrvData(
  client: SupabaseClient,
  userId: string,
  date: string
): Promise<HrvNightInput | null> {
  const { data, error } = await client
    .from("hrv_nights")
    .select("date, hrv_rmssd, hrv_baseline, hrv_status, weekly_avg")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (error || !data) return null;
  return data as HrvNightInput;
}

/**
 * Fetch daily metrics for a user on the target date.
 */
async function fetchDailyMetrics(
  client: SupabaseClient,
  userId: string,
  date: string
): Promise<DailyMetricsInput | null> {
  const { data, error } = await client
    .from("canonical_daily_metrics")
    .select(
      "date, recovery_score, body_battery_high, body_battery_low, resting_heart_rate, stress_avg"
    )
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (error || !data) return null;
  return data as DailyMetricsInput;
}

/**
 * Fetch 7-day training load for a user.
 */
async function fetchTrainingLoad7Days(
  client: SupabaseClient,
  userId: string,
  targetDate: string
): Promise<TrainingLoadInput[]> {
  // Calculate date range: target_date - 6 to target_date
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 6);
  const startDateStr = startDate.toISOString().slice(0, 10);

  const { data, error } = await client
    .from("daily_training_load")
    .select("date, workouts_count, total_duration_seconds, total_tss")
    .eq("user_id", userId)
    .gte("date", startDateStr)
    .lte("date", targetDate)
    .order("date", { ascending: false });

  if (error || !data) return [];
  return data as TrainingLoadInput[];
}

/**
 * Fetch all input data for a user.
 */
async function fetchUserInputData(
  client: SupabaseClient,
  userId: string,
  date: string
): Promise<ComputeRecommendationInput> {
  const [sleep, hrv, metrics, trainingLoad7Days] = await Promise.all([
    fetchSleepData(client, userId, date),
    fetchHrvData(client, userId, date),
    fetchDailyMetrics(client, userId, date),
    fetchTrainingLoad7Days(client, userId, date),
  ]);

  return {
    userId,
    date,
    sleep,
    hrv,
    metrics,
    trainingLoad7Days,
  };
}

// ============================================================================
// Upsert Logic
// ============================================================================

interface UpsertResult {
  success: boolean;
  error?: string;
}

/**
 * Upsert a recommendation into daily_recommendations table.
 */
async function upsertRecommendation(
  client: SupabaseClient,
  userId: string,
  date: string,
  output: ComputeRecommendationOutput
): Promise<UpsertResult> {
  const { error } = await client.from("daily_recommendations").upsert(
    {
      user_id: userId,
      date,
      source: SOURCE,
      decision: output.decision,
      workout_ref: output.workout_ref,
      confidence: output.confidence,
      rationale: output.rationale,
      evidence: output.evidence,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,date",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    console.error(`[cron] Upsert failed for user ${userId}:`, error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// Batch Processing
// ============================================================================

interface ProcessResult {
  userId: string;
  decision: string;
  rationale: string;
  confidence: number;
  upsertOk: boolean;
  error?: string;
}

/**
 * Process a batch of users.
 */
async function processBatch(
  client: SupabaseClient,
  userIds: string[],
  targetDate: string,
  dryRun: boolean
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];

  for (const userId of userIds) {
    try {
      // Fetch input data
      const input = await fetchUserInputData(client, userId, targetDate);

      // Compute recommendation
      const output = computeDailyRecommendation(input);

      // Upsert (unless dry run)
      let upsertOk = true;
      let error: string | undefined;

      if (!dryRun) {
        const upsertResult = await upsertRecommendation(
          client,
          userId,
          targetDate,
          output
        );
        upsertOk = upsertResult.success;
        error = upsertResult.error;
      }

      results.push({
        userId,
        decision: output.decision,
        rationale: output.rationale,
        confidence: output.confidence,
        upsertOk,
        error,
      });

      console.log(
        `[cron] ${dryRun ? "[DRY RUN] " : ""}User ${userId}: ${output.decision} (confidence: ${output.confidence.toFixed(2)})`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[cron] Error processing user ${userId}:`, errorMsg);
      results.push({
        userId,
        decision: "error",
        rationale: errorMsg,
        confidence: 0,
        upsertOk: false,
        error: errorMsg,
      });
    }
  }

  return results;
}

// ============================================================================
// Response Types
// ============================================================================

interface CronResponse {
  ok: boolean;
  target_date: string;
  users_processed: number;
  upserts_ok: number;
  upserts_failed: number;
  dry_run: boolean;
  results?: Array<{
    user_id: string;
    decision: string;
    rationale: string;
  }>;
  errors?: string[];
  duration_ms?: number;
}

// ============================================================================
// Handler (Web API format for Vercel Functions)
// ============================================================================

export async function GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  const headers = { "cache-control": "no-store" };

  // Check authorization
  if (!isAuthorized(request)) {
    console.warn("[cron] Unauthorized request");
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  // Parse query parameters
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const dateOverride = url.searchParams.get("date");

  // Determine target date (today in UTC)
  const now = new Date();
  const targetDate =
    dateOverride?.match(/^\d{4}-\d{2}-\d{2}$/)
      ? dateOverride
      : now.toISOString().slice(0, 10);

  console.log(
    `[cron] Starting daily recommendations for ${targetDate}${dryRun ? " (DRY RUN)" : ""}`
  );

  try {
    const client = getSupabaseClient();

    // Get users with data for today
    const userIds = await getUserIdsWithData(client, targetDate);
    console.log(`[cron] Found ${userIds.length} users with data`);

    if (userIds.length === 0) {
      const response: CronResponse = {
        ok: true,
        target_date: targetDate,
        users_processed: 0,
        upserts_ok: 0,
        upserts_failed: 0,
        dry_run: dryRun,
        duration_ms: Date.now() - startTime,
      };
      return Response.json(response, { headers });
    }

    // Process in batches
    const allResults: ProcessResult[] = [];

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const batchResults = await processBatch(client, batch, targetDate, dryRun);
      allResults.push(...batchResults);
    }

    // Compile summary
    const upsertsOk = allResults.filter((r) => r.upsertOk).length;
    const upsertsFailed = allResults.filter((r) => !r.upsertOk).length;
    const errors = allResults
      .filter((r) => r.error)
      .map((r) => `${r.userId}: ${r.error}`);

    const response: CronResponse = {
      ok: upsertsFailed === 0,
      target_date: targetDate,
      users_processed: userIds.length,
      upserts_ok: upsertsOk,
      upserts_failed: upsertsFailed,
      dry_run: dryRun,
      duration_ms: Date.now() - startTime,
    };

    // Include results in dry run mode
    if (dryRun) {
      response.results = allResults.map((r) => ({
        user_id: r.userId,
        decision: r.decision,
        rationale: r.rationale,
      }));
    }

    // Include errors if any
    if (errors.length > 0) {
      response.errors = errors;
    }

    console.log(
      `[cron] Completed: ${upsertsOk} ok, ${upsertsFailed} failed, ${Date.now() - startTime}ms`
    );

    return Response.json(response, { headers });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[cron] Fatal error:", errorMsg);
    return Response.json(
      {
        ok: false,
        error: errorMsg,
        target_date: targetDate,
        dry_run: dryRun,
      },
      { status: 500, headers }
    );
  }
}
