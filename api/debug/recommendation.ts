/**
 * GET /api/debug/recommendation
 * Authenticated debug endpoint — runs the full recommendation pipeline
 * and returns ALL intermediate state for introspection.
 *
 * NOT coupled to today.ts — intentionally duplicates pipeline orchestration
 * so debug doesn't break if the production route changes (and vice-versa).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getDailyUserState,
  getTrainingLoad7Days,
  getDailyCheckin,
  getHrvHistory,
  getUserDataDays,
  getPriorChronicLoad,
  getTrainingLoadHistory,
  type DailyUserStateRow,
  type TrainingLoadRow,
  type DailyCheckinRow,
} from "../../src/lib/db/queries.js";
import {
  computeReadinessAndFatigue,
  type ReadinessAndFatigueInput,
  type ReadinessAndFatigueOutput,
  type DailyCheckinInput,
} from "../../src/lib/core/recommendations/computeReadinessAndFatigue.js";
import type { DailyTssEntry } from "../../src/lib/core/recommendations/computeEwma.js";
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
import {
  detectAnomalies,
  type AnomalyResult,
} from "../../src/lib/core/safety/anomaly.js";
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
import { timer } from "../../src/lib/core/observability/log.js";
import type { RecommendationCandidate } from "../../src/lib/core/contracts/recommendation.js";

// ============================================================================
// Auth helpers (mirror of today.ts — kept separate to avoid coupling)
// ============================================================================

let authClient: SupabaseClient | null = null;
let authClientConfig: { supabaseUrl: string; supabaseKey: string } | null = null;

function cleanEnvValue(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  let cleaned = v.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return null;
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned || null;
}

function tryParseUrl(u: string): string | null {
  try { return new URL(u).toString(); } catch { return null; }
}

function inferSupabaseBaseUrlFromJwt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const seg = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = seg + "=".repeat((4 - (seg.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { iss?: unknown };
    const iss = typeof payload?.iss === "string" ? payload.iss : null;
    if (!iss) return null;
    return iss.endsWith("/auth/v1") ? iss.slice(0, -"/auth/v1".length) : new URL(iss).origin;
  } catch { return null; }
}

function getAuthClient(supabaseUrl: string, supabaseKey: string): SupabaseClient | null {
  if (authClient && authClientConfig?.supabaseUrl === supabaseUrl && authClientConfig?.supabaseKey === supabaseKey) {
    return authClient;
  }
  try {
    authClient = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });
    authClientConfig = { supabaseUrl, supabaseKey };
  } catch { return null; }
  return authClient;
}

async function resolveUserId(authHeader: string | undefined): Promise<string | null> {
  // Env override for local dev
  const envUser = cleanEnvValue(process.env.TRAINELO_USER_ID);
  if (envUser) return envUser;

  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];

  // Resolve Supabase URL
  const inferredUrl = tryParseUrl(inferSupabaseBaseUrlFromJwt(token) ?? "");
  const supabaseUrl = inferredUrl
    ?? tryParseUrl(cleanEnvValue(process.env.SUPABASE_URL) ?? "")
    ?? tryParseUrl(cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? "")
    ?? tryParseUrl(cleanEnvValue(process.env.VITE_SUPABASE_URL) ?? "");
  if (!supabaseUrl) return null;

  const supabaseKey =
    cleanEnvValue(process.env.SUPABASE_ANON_KEY)
    ?? cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ?? cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY)
    ?? cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseKey) return null;

  const client = getAuthClient(supabaseUrl, supabaseKey);
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// ============================================================================
// Input mapping (duplicated from today.ts — intentionally decoupled)
// ============================================================================

function mapSleep(row: DailyUserStateRow, date: string): SleepSessionInput | null {
  if (row.sleep_score == null || row.sleep_seconds == null) return null;
  return { date, duration_seconds: row.sleep_seconds, sleep_score: row.sleep_score, deep_seconds: 0, rem_seconds: 0, avg_hrv_ms: row.avg_hrv_ms ?? 0 };
}

function mapHrv(row: DailyUserStateRow, date: string): HrvNightInput | null {
  if (row.hrv_rmssd == null || row.hrv_baseline == null) return null;
  return { date, hrv_rmssd: row.hrv_rmssd, hrv_baseline: row.hrv_baseline, hrv_status: "", weekly_avg: 0 };
}

function mapMetrics(row: DailyUserStateRow, date: string): DailyMetricsInput | null {
  if (row.recovery_score == null) return null;
  return { date, recovery_score: row.recovery_score, body_battery_high: 0, body_battery_low: 0, resting_heart_rate: 0, stress_avg: 0 };
}

function mapTrainingLoad(rows: TrainingLoadRow[]): TrainingLoadInput[] {
  return rows.map((r) => ({ date: r.date, workouts_count: r.workouts_count, total_duration_seconds: r.total_duration_seconds, total_tss: r.total_tss }));
}

function aggregateDailyTss(rows: TrainingLoadRow[]): DailyTssEntry[] {
  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.total_tss);
  return Array.from(byDate, ([date, total_tss]) => ({ date, total_tss }));
}

const VALID_MOODS = new Set(["drained", "tired", "okay", "good", "great"]);

function mapCheckin(row: DailyCheckinRow | null): DailyCheckinInput | null {
  if (!row) return null;
  return { mood: VALID_MOODS.has(row.mood) ? (row.mood as DailyCheckinInput["mood"]) : null, rpe: row.rpe, soreness: row.soreness, pain_flag: row.pain_flag, illness_flag: row.illness_flag };
}

// ============================================================================
// Calibrator mapping (duplicated from today.ts)
// ============================================================================

const VALID_REASON_BUCKETS = new Set(["sick", "hurt", "fried", "none"]);
const VALID_UPGRADE_TYPES = new Set(["intensity", "volume"]);

function mapCheckinForCalibrator(row: DailyCheckinRow | null): CalibratorCheckinInput | null {
  if (!row) return null;
  if (!VALID_MOODS.has(row.mood)) return null;
  const rawUpgrade = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>).upgrade_type : null;
  const upgradeType = typeof rawUpgrade === "string" && VALID_UPGRADE_TYPES.has(rawUpgrade) ? (rawUpgrade as "intensity" | "volume") : null;
  return {
    mood: row.mood as Mood5,
    rpe: row.rpe, soreness: row.soreness, pain_flag: row.pain_flag, illness_flag: row.illness_flag,
    reason_bucket: row.reason_bucket && VALID_REASON_BUCKETS.has(row.reason_bucket) ? (row.reason_bucket as ReasonBucket) : null,
    pain_severity: row.pain_severity, pain_locations: row.pain_locations, sleep_quality: row.sleep_quality,
    perceived_energy: row.perceived_energy, motivation: row.motivation, life_stress: row.life_stress,
    reason_tags: row.reason_tags, time_constraint_minutes: row.time_constraint_minutes, upgrade_type: upgradeType,
  };
}

function deriveWearableReadiness(readiness: number, fatigue: number): WearableReadiness {
  if (fatigue >= 75 || readiness < 40) return "red";
  if (fatigue >= 50 || readiness < 65) return "yellow";
  return "green";
}

function buildWearableSignals(rfOutput: ReadinessAndFatigueOutput): WearableSignalsInput {
  return { readiness: deriveWearableReadiness(rfOutput.readiness_score, rfOutput.fatigue_score), readiness_score: rfOutput.readiness_score, fatigue_score: rfOutput.fatigue_score };
}

function runCalibrator(checkinRow: DailyCheckinRow | null, rfOutput: ReadinessAndFatigueOutput): CalibrationResult | null {
  try {
    return calibrateSession({ morning_checkin: mapCheckinForCalibrator(checkinRow), wearable_signals: buildWearableSignals(rfOutput), planned_session: { planned_duration_minutes: null, planned_intensity: null } });
  } catch { return null; }
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const total = timer();

  // Auth
  const userId = await resolveUserId(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const generatedAt = now.toISOString();

  try {
    // ---- DB fetch ----
    const dbTimer = timer();
    const [stateRes, loadRes, checkinRes, hrvHistRes, dataDaysRes, priorLoadRes, loadHistRes] = await Promise.all([
      getDailyUserState(userId, date),
      getTrainingLoad7Days(userId, date),
      getDailyCheckin(userId, date),
      getHrvHistory(userId, date, 7).catch(() => ({ data: [] as { date: string; hrv_rmssd: number }[], error: "fetch_failed" as string | null })),
      getUserDataDays(userId).catch(() => ({ data: 0, error: "fetch_failed" as string | null })),
      getPriorChronicLoad(userId, date).catch(() => ({ data: null as number | null, error: "fetch_failed" as string | null })),
      getTrainingLoadHistory(userId, date, 63).catch(() => ({ data: [] as TrainingLoadRow[], error: "fetch_failed" as string | null })),
    ]);
    const dbMs = dbTimer.elapsed();

    if (stateRes.error || loadRes.error) {
      res.status(500).json({ error: "DB query failed", state_error: stateRes.error, load_error: loadRes.error });
      return;
    }

    const row = stateRes.data;
    const loadRows = loadRes.data;

    // ---- Readiness & Fatigue ----
    const rfTimer = timer();
    const sleep = row ? mapSleep(row, date) : null;
    const hrv = row ? mapHrv(row, date) : null;
    const metrics = row ? mapMetrics(row, date) : null;
    const trainingLoad7Days = mapTrainingLoad(loadRows);
    const dailyCheckin = mapCheckin(checkinRes.data);
    const dailyTssHistory = loadHistRes.error ? null : aggregateDailyTss(loadHistRes.data);

    const rfInput: ReadinessAndFatigueInput = {
      sleep, hrv, metrics, trainingLoad7Days, dailyCheckin,
      hrvHistory: hrvHistRes.error ? null : hrvHistRes.data.map((r) => ({ date: r.date, hrv_rmssd: r.hrv_rmssd })),
      totalDataDays: dataDaysRes.error ? null : dataDaysRes.data,
      consecutiveTrainingDays: row?.days_since_rest ?? null,
      chronicLoad28d: row?.chronic_load_28d ?? null,
      priorChronicLoad28d: priorLoadRes.error ? null : priorLoadRes.data,
      latestDataTimestamp: row?.last_garmin_sync_at ?? null,
      currentTimestamp: generatedAt,
      dailyTssHistory, targetDate: date,
    };
    const rfOutput = computeReadinessAndFatigue(rfInput);
    const rfMs = rfTimer.elapsed();

    // ---- Anomaly detection ----
    const anomalyTimer = timer();
    const anomalyResult = detectAnomalies(rfOutput);
    const anomalyMs = anomalyTimer.elapsed();

    // ---- Candidate generation ----
    const candidateTimer = timer();
    const mergedReasonCodes = [...rfOutput.reason_codes, ...anomalyResult.reason_codes];
    const effectiveReadiness = anomalyResult.caution_level === "high" ? Math.min(rfOutput.readiness_score, 55) : rfOutput.readiness_score;
    const state: DailyState = {
      readiness_score: effectiveReadiness,
      fatigue_score: rfOutput.fatigue_score,
      reason_codes: mergedReasonCodes,
      ewma_form_score: rfOutput.ewma?.form_score ?? null,
    };
    const history: DailyHistory = { consecutive_training_days: row?.days_since_rest ?? 0 };
    const constraints: DailyConstraints = { has_scheduled_workout: false, scheduled_template_ref: null };
    const candidatesRaw = generateDailyRecommendation(state, history, constraints);
    const candidateMs = candidateTimer.elapsed();

    // ---- Calibration ----
    const calTimer = timer();
    const calibration = runCalibrator(checkinRes.data, rfOutput);
    const rawRecovery = checkinRes.data?.payload && typeof checkinRes.data.payload === "object"
      ? (checkinRes.data.payload as Record<string, unknown>).recovery_type : null;
    const recoveryType = rawRecovery === "full_rest" || rawRecovery === "active_recovery" ? rawRecovery : null;
    const candidatesCalibrated = applyCandidateCalibration(candidatesRaw, calibration, { recovery_type: recoveryType });
    const calMs = calTimer.elapsed();

    // ---- Build the production-equivalent response (for comparison) ----
    const { SchemaVersion } = await import("../../src/lib/core/contracts/recommendation.js");

    // Inline a minimal buildEvidence for the response field
    const response = {
      schema_version: SchemaVersion,
      recommendation_id: `${userId}:${date}`,
      date,
      user_id: userId,
      candidates: candidatesCalibrated,
      evidence: {} as Record<string, unknown>, // omitted in debug — full data is in pipeline
      llm_used: false,
      generated_at: generatedAt,
    };

    // ---- Assemble debug output ----
    res.status(200).json({
      generated_at: generatedAt,
      date,
      user_id: userId,

      inputs: {
        daily_user_state: row,
        training_load_7d: loadRows,
        daily_checkin: checkinRes.data,
        hrv_history_count: hrvHistRes.error ? 0 : hrvHistRes.data.length,
        total_data_days: dataDaysRes.error ? null : dataDaysRes.data,
        prior_chronic_load: priorLoadRes.error ? null : priorLoadRes.data,
        daily_tss_history_count: loadHistRes.error ? 0 : loadHistRes.data.length,
      },

      pipeline: {
        rf_output: rfOutput,
        anomaly: anomalyResult,
        state,
        candidates_raw: candidatesRaw,
        calibration,
        candidates_calibrated: candidatesCalibrated,
      },

      response,

      timing_ms: {
        total: total.elapsed(),
        db_fetch: dbMs,
        readiness_fatigue: rfMs,
        anomaly_detection: anomalyMs,
        candidate_generation: candidateMs,
        calibration: calMs,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Pipeline failed", message: msg });
  }
}
