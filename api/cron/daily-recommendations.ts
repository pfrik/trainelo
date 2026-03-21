/**
 * GET /api/cron/daily-recommendations
 *
 * Vercel Cron Job: Computes and upserts daily recommendations for all active users.
 * Uses the same pure core pipeline as /api/recommendation/today:
 *   computeReadinessAndFatigue → generateDailyRecommendation
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
import { createLogger, generateRequestId, timer, type Logger } from "../../src/lib/core/observability/log.js";
import {
  computeReadinessAndFatigue,
  type ReadinessAndFatigueInput,
  type ReadinessAndFatigueOutput,
  type DailyCheckinInput,
} from "../../src/lib/core/recommendations/computeReadinessAndFatigue.js";
import {
  generateDailyRecommendation,
  type DailyState,
  type DailyHistory,
  type DailyConstraints,
} from "../../src/lib/core/recommendations/generateDailyRecommendation.js";
import type {
  SleepSessionInput,
  HrvNightInput,
  DailyMetricsInput,
  TrainingLoadInput,
} from "../../src/lib/core/recommendations/computeDailyRecommendation.js";
import type {
  CandidateId,
  RecommendationCandidate,
} from "../../src/lib/core/contracts/recommendation.js";
import {
  getDailyUserState,
  getTrainingLoad7Days,
  getDailyCheckin,
  getHrvHistory,
  getUserDataDays,
  getPriorChronicLoad,
  getTrainingLoadHistory,
  getPersonalThresholds,
  type DailyUserStateRow,
  type TrainingLoadRow,
  type DailyCheckinRow,
} from "../../src/lib/db/queries.js";
import type { DailyTssEntry } from "../../src/lib/core/recommendations/computeEwma.js";
import {
  calibrateSession,
  type CalibratorInput,
  type CalibrationResult,
  type CheckinInput as CalibratorCheckinInput,
  type WearableSignalsInput,
  type WearableReadiness,
  type Mood5,
  type ReasonBucket,
} from "../../src/lib/core/checkin/calibrator.js";
import { applyCandidateCalibration } from "../../src/lib/core/checkin/applyCandidateCalibration.js";
import { detectAnomalies } from "../../src/lib/core/safety/anomaly.js";
import { applyAnomalyRestrictions } from "../../src/lib/core/safety/applyAnomalyRestrictions.js";
import { runPassiveCalibration } from "../../src/lib/core/calibration/index.js";

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

function isAuthorized(request: Request, log: Logger): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = sanitizeEnvValue(process.env.CRON_SECRET);

  if (!cronSecret) {
    log.warn("CRON_SECRET not configured");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// ============================================================================
// User Discovery
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

// ============================================================================
// Input Mapping (DB rows → pure core function inputs)
// Same mappers as /api/recommendation/today for alignment.
// ============================================================================

function mapSleep(
  row: DailyUserStateRow,
  date: string,
): SleepSessionInput | null {
  if (row.sleep_score == null || row.sleep_seconds == null) return null;
  return {
    date,
    duration_seconds: row.sleep_seconds,
    sleep_score: row.sleep_score,
    deep_seconds: 0,
    rem_seconds: 0,
    avg_hrv_ms: row.avg_hrv_ms ?? 0,
  };
}

function mapHrv(
  row: DailyUserStateRow,
  date: string,
): HrvNightInput | null {
  if (row.hrv_rmssd == null || row.hrv_baseline == null) return null;
  return {
    date,
    hrv_rmssd: row.hrv_rmssd,
    hrv_baseline: row.hrv_baseline,
    hrv_status: "",
    weekly_avg: 0,
  };
}

function mapMetrics(
  row: DailyUserStateRow,
  date: string,
): DailyMetricsInput | null {
  if (row.recovery_score == null) return null;
  return {
    date,
    recovery_score: row.recovery_score,
    body_battery_high: 0,
    body_battery_low: 0,
    resting_heart_rate: 0,
    stress_avg: 0,
  };
}

function mapTrainingLoad(rows: TrainingLoadRow[]): TrainingLoadInput[] {
  return rows.map((r) => ({
    date: r.date,
    workouts_count: r.workouts_count,
    total_duration_seconds: r.total_duration_seconds,
    total_tss: r.total_tss,
  }));
}

/** Aggregate per-source training load rows into per-date TSS totals. */
function aggregateDailyTss(rows: TrainingLoadRow[]): DailyTssEntry[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.total_tss);
  }
  return Array.from(byDate, ([date, total_tss]) => ({ date, total_tss }));
}

const VALID_MOODS = new Set(["drained", "tired", "okay", "good", "great"]);

function mapCheckin(row: DailyCheckinRow | null): DailyCheckinInput | null {
  if (!row) return null;
  return {
    mood: VALID_MOODS.has(row.mood)
      ? (row.mood as DailyCheckinInput["mood"])
      : null,
    rpe: row.rpe,
    soreness: row.soreness,
    pain_flag: row.pain_flag,
    illness_flag: row.illness_flag,
  };
}

// ============================================================================
// Calibrator Input Mapping
// ============================================================================

const VALID_REASON_BUCKETS = new Set(["sick", "hurt", "fried", "none"]);
const VALID_UPGRADE_TYPES = new Set(["intensity", "volume"]);

function mapCheckinForCalibrator(row: DailyCheckinRow | null): CalibratorCheckinInput | null {
  if (!row) return null;
  if (!VALID_MOODS.has(row.mood)) return null;

  const rawUpgrade = row.payload && typeof row.payload === "object"
    ? (row.payload as Record<string, unknown>).upgrade_type
    : null;
  const upgradeType = typeof rawUpgrade === "string" && VALID_UPGRADE_TYPES.has(rawUpgrade)
    ? (rawUpgrade as "intensity" | "volume")
    : null;

  return {
    mood: row.mood as Mood5,
    rpe: row.rpe,
    soreness: row.soreness,
    pain_flag: row.pain_flag,
    illness_flag: row.illness_flag,
    reason_bucket: row.reason_bucket && VALID_REASON_BUCKETS.has(row.reason_bucket)
      ? (row.reason_bucket as ReasonBucket)
      : null,
    pain_severity: row.pain_severity,
    pain_locations: row.pain_locations,
    sleep_quality: row.sleep_quality,
    perceived_energy: row.perceived_energy,
    motivation: row.motivation,
    life_stress: row.life_stress,
    reason_tags: row.reason_tags,
    time_constraint_minutes: row.time_constraint_minutes,
    upgrade_type: upgradeType,
  };
}

function deriveWearableReadiness(
  readiness: number,
  fatigue: number,
): WearableReadiness {
  if (fatigue >= 75 || readiness < 40) return "red";
  if (fatigue >= 50 || readiness < 65) return "yellow";
  return "green";
}

function buildWearableSignals(rfOutput: ReadinessAndFatigueOutput): WearableSignalsInput {
  return {
    readiness: deriveWearableReadiness(rfOutput.readiness_score, rfOutput.fatigue_score),
    readiness_score: rfOutput.readiness_score,
    fatigue_score: rfOutput.fatigue_score,
  };
}

function runCalibratorSafe(
  checkinRow: DailyCheckinRow | null,
  rfOutput: ReadinessAndFatigueOutput,
  log: Logger,
): CalibrationResult | null {
  try {
    const calibratorInput: CalibratorInput = {
      morning_checkin: mapCheckinForCalibrator(checkinRow),
      wearable_signals: buildWearableSignals(rfOutput),
      planned_session: { planned_duration_minutes: null, planned_intensity: null },
    };
    return calibrateSession(calibratorInput);
  } catch (err) {
    log.warn("calibrator error (non-fatal)", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

// ============================================================================
// Decision Mapping
// ============================================================================

/**
 * Map primary candidate_id to the `decision` string stored in daily_recommendations.
 *
 * Mapping rationale:
 *   scheduled        → "train_easy"       Default template is easy-run-30min; no intensity
 *                                          data available to justify "train_hard".
 *   lite_alternative → "active_recovery"   Lighter session for moderate fatigue.
 *   rest_day         → "rest"              Full rest day.
 *   skip             → "rest"              User-preference skip; closest to rest.
 */
function candidateIdToDecision(id: CandidateId): string {
  switch (id) {
    case "scheduled":
      return "train_easy";
    case "lite_alternative":
      return "active_recovery";
    case "rest_day":
      return "rest";
    case "skip":
      return "rest";
  }
}

// ============================================================================
// Confidence
// ============================================================================

function computeConfidence(
  row: DailyUserStateRow | null,
  loadRows: TrainingLoadRow[],
): number {
  let sources = 0;
  if (row?.sleep_score != null) sources++;
  if (row?.hrv_rmssd != null) sources++;
  if (row?.recovery_score != null) sources++;
  if (loadRows.length > 0) sources++;
  return Math.min(0.3 + sources * 0.15, 0.9);
}

// ============================================================================
// Upsert Logic
// ============================================================================

interface UpsertPayload {
  decision: string;
  workout_ref: string | null;
  confidence: number;
  rationale: string;
  evidence: Record<string, unknown>;
}

interface UpsertResult {
  success: boolean;
  error?: string;
}

async function upsertRecommendation(
  client: SupabaseClient,
  userId: string,
  date: string,
  payload: UpsertPayload,
  log: Logger,
): Promise<UpsertResult> {
  const { error } = await client.from("daily_recommendations").upsert(
    {
      user_id: userId,
      date,
      source: SOURCE,
      decision: payload.decision,
      workout_ref: payload.workout_ref,
      confidence: payload.confidence,
      rationale: payload.rationale,
      evidence: payload.evidence,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,date",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    log.error("upsert failed", { user_id: userId, error: error.message });
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// Per-User Pipeline
// ============================================================================

class QueryError extends Error {
  constructor(
    public readonly userId: string,
    public readonly stateError: string | null,
    public readonly loadError: string | null,
  ) {
    const parts: string[] = [];
    if (stateError) parts.push(`state=${stateError}`);
    if (loadError) parts.push(`load=${loadError}`);
    super(`query_failed: ${parts.join(", ")}`);
    this.name = "QueryError";
  }
}

interface UserOutput {
  decision: string;
  workout_ref: string | null;
  confidence: number;
  rationale: string;
  evidence: Record<string, unknown>;
}

async function computeForUser(
  userId: string,
  targetDate: string,
  log: Logger,
): Promise<UserOutput> {
  // 1. Fetch from DB views
  const [stateRes, loadRes, checkinRes, hrvHistRes, dataDaysRes, priorLoadRes, loadHistRes, thresholdsRes] = await Promise.all([
    getDailyUserState(userId, targetDate),
    getTrainingLoad7Days(userId, targetDate),
    getDailyCheckin(userId, targetDate),
    getHrvHistory(userId, targetDate, 7).catch(() => ({ data: [], error: "fetch_failed" as string | null })),
    getUserDataDays(userId).catch(() => ({ data: 0, error: "fetch_failed" as string | null })),
    getPriorChronicLoad(userId, targetDate).catch(() => ({ data: null, error: "fetch_failed" as string | null })),
    getTrainingLoadHistory(userId, targetDate, 63).catch(() => ({ data: [], error: "fetch_failed" as string | null })),
    getPersonalThresholds(userId).catch(() => ({ data: { hrv_baseline: null, hr_max: null, resting_hr: null }, error: "fetch_failed" as string | null })),
  ]);

  // Query errors are fatal for this user — surface as failure, don't silently upsert
  if (stateRes.error || loadRes.error) {
    throw new QueryError(userId, stateRes.error, loadRes.error);
  }
  // Check-in fetch failure is non-fatal
  if (checkinRes.error) {
    log.warn("check-in fetch error (non-fatal)", { user_id: userId, error: checkinRes.error });
  }

  const row = stateRes.data;
  const loadRows = loadRes.data;

  // 2. Map DB rows → core inputs
  const sleep = row ? mapSleep(row, targetDate) : null;
  const hrv = row ? mapHrv(row, targetDate) : null;
  const metrics = row ? mapMetrics(row, targetDate) : null;
  const trainingLoad7Days = mapTrainingLoad(loadRows);
  const dailyCheckin = mapCheckin(checkinRes.data);

  // 3. Compute readiness & fatigue
  const dailyTssHistory = loadHistRes.error ? null : aggregateDailyTss(loadHistRes.data);
  const rfInput: ReadinessAndFatigueInput = {
    sleep,
    hrv,
    metrics,
    trainingLoad7Days,
    dailyCheckin,
    hrvHistory: hrvHistRes.error ? null : hrvHistRes.data.map((r) => ({ date: r.date, hrv_rmssd: r.hrv_rmssd })),
    totalDataDays: dataDaysRes.error ? null : dataDaysRes.data,
    consecutiveTrainingDays: row?.days_since_rest ?? null,
    chronicLoad28d: row?.chronic_load_28d ?? null,
    priorChronicLoad28d: priorLoadRes.error ? null : priorLoadRes.data,
    latestDataTimestamp: row?.last_garmin_sync_at ?? null,
    currentTimestamp: new Date().toISOString(),
    dailyTssHistory,
    targetDate,
    personalThresholds: thresholdsRes.error ? null : thresholdsRes.data,
  };
  const rfOutput: ReadinessAndFatigueOutput = computeReadinessAndFatigue(rfInput);

  // 3a. Anomaly detection
  const anomalyResult = detectAnomalies(rfOutput);

  // 4. Build candidate-generation inputs
  const mergedReasonCodes = [...rfOutput.reason_codes, ...anomalyResult.reason_codes];
  const effectiveReadiness =
    anomalyResult.caution_level === "high"
      ? Math.min(rfOutput.readiness_score, 55)
      : rfOutput.readiness_score;

  const state: DailyState = {
    readiness_score: effectiveReadiness,
    fatigue_score: rfOutput.fatigue_score,
    reason_codes: mergedReasonCodes,
    ewma_form_score: rfOutput.ewma?.form_score ?? null,
  };

  const history: DailyHistory = {
    consecutive_training_days: row?.days_since_rest ?? 0,
  };

  const constraints: DailyConstraints = {
    has_scheduled_workout: false,
    scheduled_template_ref: null,
  };

  // 5. Generate ordered candidates
  const candidates: RecommendationCandidate[] =
    generateDailyRecommendation(state, history, constraints);

  const confidence = rfOutput.confidence?.overall ?? computeConfidence(row, loadRows);

  // 6. Run calibrator (non-fatal on error)
  const calibration = runCalibratorSafe(checkinRes.data, rfOutput, log);

  // 6a. Apply calibration: re-order candidates, adjust caution, update rationale
  const rawRecovery = checkinRes.data?.payload && typeof checkinRes.data.payload === "object"
    ? (checkinRes.data.payload as Record<string, unknown>).recovery_type
    : null;
  const recoveryType = rawRecovery === "full_rest" || rawRecovery === "active_recovery"
    ? rawRecovery
    : null;
  const calibratedCandidates = applyCandidateCalibration(candidates, calibration, { recovery_type: recoveryType });

  // 6b. Apply anomaly restrictions
  const hasCheckin = checkinRes.data != null;
  const anomalyEnforced = applyAnomalyRestrictions(calibratedCandidates, anomalyResult, hasCheckin);
  const finalCandidates = anomalyEnforced.candidates;
  const primary = finalCandidates[0];

  // 7. Build persisted output
  return {
    decision: candidateIdToDecision(primary.candidate_id),
    workout_ref: primary.template_ref,
    confidence,
    rationale: primary.rationale,
    evidence: {
      readiness_score: rfOutput.readiness_score,
      fatigue_score: rfOutput.fatigue_score,
      reason_codes: rfOutput.reason_codes,
      primary_candidate_id: primary.candidate_id,
      confidence,
      days_since_rest: row?.days_since_rest ?? null,
      sleep_quality: row?.sleep_score ?? null,
      candidates: finalCandidates.map((c) => ({
        candidate_id: c.candidate_id,
        template_ref: c.template_ref,
        caution_level: c.caution_level,
        reason_codes: c.reason_codes,
      })),
      anomaly_caution_level: anomalyResult.caution_level,
      anomaly_restrictions: anomalyResult.restrictions,
      calibration_level: calibration?.level ?? null,
      calibration_intensity_multiplier: calibration?.intensity_multiplier ?? null,
      calibration_duration_multiplier: calibration?.duration_multiplier ?? null,
      calibration_applied_rules: calibration?.applied_rules ?? null,
      calibration_warnings: calibration?.warnings ?? null,
      calibration_headline: calibration?.headline ?? null,
      calibration_rationale: calibration?.rationale ?? null,
      calibration_swap_to: calibration?.swap_to ?? null,
      calibration_safety_flags: calibration?.warnings ?? null,
      calibration_version: calibration ? 1 : null,
      confidence_data_availability: rfOutput.confidence?.data_availability ?? null,
      confidence_signal_consistency: rfOutput.confidence?.signal_consistency ?? null,
      confidence_data_recency: rfOutput.confidence?.data_recency ?? null,
      baseline_mode: rfOutput.baseline_mode ?? null,
      ewma_fitness_score: rfOutput.ewma?.fitness_score ?? null,
      ewma_fatigue_score: rfOutput.ewma?.fatigue_score ?? null,
      ewma_form_score: rfOutput.ewma?.form_score ?? null,
      ewma_fitness_raw: rfOutput.ewma?.fitness_raw ?? null,
      ewma_fatigue_raw: rfOutput.ewma?.fatigue_raw ?? null,
      ewma_cold_start_fatigue: rfOutput.ewma?.cold_start_fatigue ?? null,
      ewma_cold_start_fitness: rfOutput.ewma?.cold_start_fitness ?? null,
      fitness_score: rfOutput.ewma?.fitness_score ?? null,
    },
  };
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

async function processBatch(
  client: SupabaseClient,
  userIds: string[],
  targetDate: string,
  dryRun: boolean,
  log: Logger,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];

  for (const userId of userIds) {
    try {
      const output = await computeForUser(userId, targetDate, log);

      // Upsert (unless dry run)
      let upsertOk = true;
      let error: string | undefined;

      if (!dryRun) {
        const upsertResult = await upsertRecommendation(
          client,
          userId,
          targetDate,
          output,
          log,
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

      // Run passive calibration (non-fatal)
      if (!dryRun) {
        try {
          const calibResult = await runPassiveCalibration(userId, targetDate, log);
          log.info("calibration complete", {
            user_id: userId,
            applied: calibResult.applied,
            skipped: calibResult.skipped,
          });
        } catch (err) {
          log.warn("calibration error (non-fatal)", {
            user_id: userId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      log.info("user processed", {
        user_id: userId,
        decision: output.decision,
        confidence: output.confidence,
        dry_run: dryRun,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (err instanceof QueryError) {
        log.warn("query failed", { user_id: userId, error: errorMsg });
      } else {
        log.error("error processing user", { user_id: userId, error: errorMsg });
      }
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
  const requestId = generateRequestId();
  const log = createLogger("cron", requestId);
  const t = timer();

  const headers = { "cache-control": "no-store" };

  // Check authorization
  if (!isAuthorized(request, log)) {
    log.warn("unauthorized request");
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

  log.info("starting daily recommendations", { target_date: targetDate, dry_run: dryRun });

  try {
    const client = getSupabaseClient();

    // Get users with data for today
    const userIds = await getUserIdsWithData(client, targetDate);
    log.info("users found", { count: userIds.length });

    if (userIds.length === 0) {
      const response: CronResponse = {
        ok: true,
        target_date: targetDate,
        users_processed: 0,
        upserts_ok: 0,
        upserts_failed: 0,
        dry_run: dryRun,
        duration_ms: t.elapsed(),
      };
      return Response.json(response, { headers });
    }

    // Process in batches
    const allResults: ProcessResult[] = [];

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const batchResults = await processBatch(client, batch, targetDate, dryRun, log);
      allResults.push(...batchResults);
    }

    // Compile summary
    const upsertsOk = allResults.filter((r) => r.upsertOk).length;
    const upsertsFailed = allResults.filter((r) => !r.upsertOk).length;
    const errors = allResults
      .filter((r) => r.error)
      .map((r) => `${r.userId}: ${r.error}`);

    const durationMs = t.elapsed();

    const response: CronResponse = {
      ok: upsertsFailed === 0,
      target_date: targetDate,
      users_processed: userIds.length,
      upserts_ok: upsertsOk,
      upserts_failed: upsertsFailed,
      dry_run: dryRun,
      duration_ms: durationMs,
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

    log.info("completed", { upserts_ok: upsertsOk, upserts_failed: upsertsFailed, duration_ms: durationMs });

    return Response.json(response, { headers });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("fatal error", { error: errorMsg, duration_ms: t.elapsed() });
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
