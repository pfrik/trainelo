/**
 * POST /api/recommendation/today
 * Vercel Serverless Function: Returns today's recommendation based on real user data.
 *
 * Pipeline: fetch DB views → map inputs → computeReadinessAndFatigue → generateDailyRecommendation → respond.
 * All business heuristics live in the pure core functions; this route is integration only.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getDailyUserState,
  getTrainingLoad7Days,
  getDailyCheckin,
  type DailyUserStateRow,
  type TrainingLoadRow,
  type DailyUserStateResult,
  type TrainingLoad7DaysResult,
  type DailyCheckinRow,
} from "../../src/lib/db/queries.js";
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
import {
  SchemaVersion,
  type TodayRecommendationResponse,
  type EvidenceSummary,
} from "../../src/lib/core/contracts/recommendation.js";
import { buildDeterministicTodayResponse } from "../../src/lib/core/recommendation/todayResponseBuilder.js";
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

// ============================================================================
// Configuration
// ============================================================================

// For development/testing, use TRAINELO_USER_ID env var
// In production, this should come from auth token
let authClient: SupabaseClient | null = null;
let authClientConfig: { supabaseUrl: string; supabaseKey: string } | null = null;

function cleanEnvValue(v: string | undefined | null): string | null {
  if (v === undefined || v === null) {
    return null;
  }

  const withoutControls = v.replace(/[\u0000-\u001F\u007F]/g, "");
  let cleaned = withoutControls.trim();
  if (!cleaned) {
    return null;
  }

  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned || null;
}

function tryParseUrl(u: string): string | null {
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

function inferSupabaseBaseUrlFromJwt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadSegment = parts[1];
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLength);
    const payloadJson = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as { iss?: unknown };
    const issuer = typeof payload?.iss === "string" ? payload.iss : null;
    if (!issuer) {
      return null;
    }
    if (issuer.endsWith("/auth/v1")) {
      return issuer.slice(0, -"/auth/v1".length);
    }
    return new URL(issuer).origin;
  } catch {
    return null;
  }
}

function getAuthClient(
  supabaseUrl: string,
  supabaseKey: string
): SupabaseClient | null {
  if (
    authClient &&
    authClientConfig?.supabaseUrl === supabaseUrl &&
    authClientConfig?.supabaseKey === supabaseKey
  ) {
    return authClient;
  }

  try {
    authClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    authClientConfig = { supabaseUrl, supabaseKey };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : undefined;
    console.warn("[auth] Supabase client init failed.", {
      supabaseUrl: JSON.stringify(supabaseUrl),
      message: errorMessage,
    });
    return null;
  }

  return authClient;
}

function extractBearerToken(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function resolveUserIdFromAuthHeader(
  authHeader: string
): Promise<string | null> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return null;
  }

  const inferredBaseUrl = inferSupabaseBaseUrlFromJwt(token);
  const inferredParsedUrl = inferredBaseUrl ? tryParseUrl(inferredBaseUrl) : null;
  let supabaseUrl: string | null = inferredParsedUrl;

  if (!supabaseUrl) {
    const supabaseUrlCandidates = [
      cleanEnvValue(process.env.SUPABASE_URL),
      cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
      cleanEnvValue(process.env.VITE_SUPABASE_URL),
    ];

    for (const candidate of supabaseUrlCandidates) {
      if (!candidate) {
        continue;
      }
      const parsed = tryParseUrl(candidate);
      if (parsed) {
        supabaseUrl = parsed;
        break;
      }
    }
  }

  if (!supabaseUrl) {
    console.warn("[auth] No valid supabaseUrl candidate.", {
      envHasSupabaseUrl: !!process.env.SUPABASE_URL,
      inferredFromJwt: !!inferredBaseUrl,
    });
    return null;
  }

  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey =
    cleanEnvValue(process.env.SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
  const hasAnonKey = !!anonKey;
  const hasServiceRoleKey = !!serviceRoleKey;
  const supabaseKey = anonKey || serviceRoleKey;

  if (!supabaseKey) {
    console.warn("[auth] Missing supabase key for token verification.", {
      hasServiceRoleKey,
      hasAnonKey,
    });
    return null;
  }

  const client = getAuthClient(supabaseUrl, supabaseKey);
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    console.warn("[auth] Auth token verification failed.", {
      url: supabaseUrl,
      hasAnonKey,
      hasServiceRoleKey,
      message: error?.message,
    });
    return null;
  }

  return data.user.id;
}

// ============================================================================
// Input Mapping (DB rows → pure core function inputs)
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
// Check-in Impact Computation
// ============================================================================

/** Same constants as computeReadinessAndFatigue — mirrored here for evidence display. */
const CHECKIN_MOOD_DELTAS: Record<string, { readiness: number; fatigue: number }> = {
  drained: { readiness: -15, fatigue: 15 },
  tired:   { readiness: -8,  fatigue: 8 },
  okay:    { readiness: 0,   fatigue: 0 },
  good:    { readiness: 5,   fatigue: -5 },
  great:   { readiness: 5,   fatigue: -5 },
};

interface CheckinImpact {
  readiness_delta: number;
  fatigue_delta: number;
  note: string;
}

function computeCheckinImpact(checkin: DailyCheckinRow): CheckinImpact {
  let readinessDelta = 0;
  let fatigueDelta = 0;

  // Mood
  if (VALID_MOODS.has(checkin.mood)) {
    const adj = CHECKIN_MOOD_DELTAS[checkin.mood];
    if (adj) {
      readinessDelta += adj.readiness;
      fatigueDelta += adj.fatigue;
    }
  }

  // RPE >= 8
  if (checkin.rpe != null && checkin.rpe >= 8) {
    fatigueDelta += 8;
  }

  // Soreness >= 7
  if (checkin.soreness != null && checkin.soreness >= 7) {
    fatigueDelta += 8;
  }

  // Pain flag
  if (checkin.pain_flag) {
    readinessDelta += -15;
    fatigueDelta += 12;
  }

  // Illness flag
  if (checkin.illness_flag) {
    readinessDelta += -20;
    fatigueDelta += 15;
  }

  // Build note
  const parts: string[] = [];
  if (fatigueDelta !== 0) {
    parts.push(`fatigue ${fatigueDelta > 0 ? "+" : ""}${fatigueDelta}`);
  }
  if (readinessDelta !== 0) {
    parts.push(`readiness ${readinessDelta > 0 ? "+" : ""}${readinessDelta}`);
  }
  const note = parts.length > 0
    ? `Check-in impact: ${parts.join(", ")}.`
    : "Check-in impact: none.";

  return { readiness_delta: readinessDelta, fatigue_delta: fatigueDelta, note };
}

// ============================================================================
// Evidence Mapping
// ============================================================================

function computeHrvTrend(
  row: DailyUserStateRow | null,
): "rising" | "stable" | "declining" | null {
  if (!row || row.hrv_rmssd == null || row.hrv_baseline == null || row.hrv_baseline <= 0) {
    return null;
  }
  const ratio = row.hrv_rmssd / row.hrv_baseline;
  if (ratio > 1.10) return "rising";
  if (ratio < 0.90) return "declining";
  return "stable";
}

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

function buildEvidence(
  row: DailyUserStateRow | null,
  loadRows: TrainingLoadRow[],
  rfOutput: ReadinessAndFatigueOutput,
  checkin: DailyCheckinRow | null,
  calibration: CalibrationResult | null,
): EvidenceSummary {
  const impact = checkin ? computeCheckinImpact(checkin) : null;

  return {
    fatigue_score: rfOutput.fatigue_score,
    fitness_score: row?.recovery_score ?? null,
    hrv_trend: computeHrvTrend(row),
    sleep_quality: row?.sleep_score ?? null,
    days_since_rest: row?.days_since_rest ?? null,
    confidence: computeConfidence(row, loadRows),
    last_garmin_sync_at: row?.last_garmin_sync_at ?? null,
    checkin_mood: (checkin?.mood as EvidenceSummary["checkin_mood"]) ?? null,
    checkin_rpe: checkin?.rpe ?? null,
    checkin_soreness: checkin?.soreness ?? null,
    checkin_pain_flag: checkin?.pain_flag ?? null,
    checkin_illness_flag: checkin?.illness_flag ?? null,
    checkin_readiness_delta: impact?.readiness_delta ?? null,
    checkin_fatigue_delta: impact?.fatigue_delta ?? null,
    checkin_impact_note: impact?.note ?? null,
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
  };
}

// ============================================================================
// Calibrator Input Mapping
// ============================================================================

const VALID_REASON_BUCKETS = new Set(["sick", "hurt", "fried", "none"]);

const VALID_UPGRADE_TYPES = new Set(["intensity", "volume"]);

/** Map DailyCheckinRow (v2) → calibrator CheckinInput. */
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
    time_constraint_minutes: row.time_constraint_minutes,
    upgrade_type: upgradeType,
  };
}

/** Derive wearable readiness band from computed readiness/fatigue scores. */
function deriveWearableReadiness(
  readiness: number,
  fatigue: number,
): WearableReadiness {
  if (fatigue >= 75 || readiness < 40) return "red";
  if (fatigue >= 50 || readiness < 65) return "yellow";
  return "green";
}

/** Build WearableSignalsInput from the R&F pipeline output. */
function buildWearableSignals(rfOutput: ReadinessAndFatigueOutput): WearableSignalsInput {
  return {
    readiness: deriveWearableReadiness(rfOutput.readiness_score, rfOutput.fatigue_score),
    readiness_score: rfOutput.readiness_score,
    fatigue_score: rfOutput.fatigue_score,
  };
}

/** Run calibrator safely; returns null on unexpected error. */
function runCalibrator(
  checkinRow: DailyCheckinRow | null,
  rfOutput: ReadinessAndFatigueOutput,
  primaryCandidate: { template_ref: string | null },
): CalibrationResult | null {
  try {
    const calibratorInput: CalibratorInput = {
      morning_checkin: mapCheckinForCalibrator(checkinRow),
      wearable_signals: buildWearableSignals(rfOutput),
      planned_session: {
        planned_duration_minutes: null,
        planned_intensity: null,
      },
    };
    return calibrateSession(calibratorInput);
  } catch (err) {
    console.warn("[today] Calibrator error (non-fatal):", err);
    return null;
  }
}

// ============================================================================
// Cold-start helper
// ============================================================================

function coldStart(
  userId: string,
  date: string,
  generatedAt: string,
): TodayRecommendationResponse {
  return buildDeterministicTodayResponse({
    user_id: userId,
    date,
    generated_at: generatedAt,
  });
}

// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const generatedAt = now.toISOString();

  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader) {
    userId = await resolveUserIdFromAuthHeader(authHeader);
    if (!userId) {
      console.warn("Invalid or expired auth token.");
      res.status(200).json(coldStart("anonymous", date, generatedAt));
      return;
    }
  } else if (cleanEnvValue(process.env.TRAINELO_USER_ID)) {
    userId = cleanEnvValue(process.env.TRAINELO_USER_ID);
  }

  if (!userId) {
    console.log("No user ID available, returning cold-start response");
    res.status(200).json(coldStart("anonymous", date, generatedAt));
    return;
  }

  try {
    // 1. Fetch from DB views in parallel
    console.log(`[today] Fetching data for user ${userId}...`);
    const [stateRes, loadRes, checkinRes] = await Promise.all([
      getDailyUserState(userId, date),
      getTrainingLoad7Days(userId, date),
      getDailyCheckin(userId, date),
    ]);

    if (stateRes.error || loadRes.error) {
      console.warn(
        `[today] Query error — state: ${stateRes.error ?? "ok"}, load: ${loadRes.error ?? "ok"}`
      );
      res.status(200).json(coldStart(userId, date, generatedAt));
      return;
    }
    // Check-in fetch failure is non-fatal — pipeline continues without it
    if (checkinRes.error) {
      console.warn(`[today] Check-in fetch error (non-fatal): ${checkinRes.error}`);
    }

    const row = stateRes.data;
    const loadRows = loadRes.data;

    console.log(
      `[today] daily_user_state: ${row ? "found" : "none"}, ` +
        `training_load rows: ${loadRows.length}`
    );

    // 2. Map DB rows → core input types
    const sleep = row ? mapSleep(row, date) : null;
    const hrv = row ? mapHrv(row, date) : null;
    const metrics = row ? mapMetrics(row, date) : null;
    const trainingLoad7Days = mapTrainingLoad(loadRows);

    // 3. Compute readiness & fatigue
    const dailyCheckin = mapCheckin(checkinRes.data);
    const rfInput: ReadinessAndFatigueInput = {
      sleep,
      hrv,
      metrics,
      trainingLoad7Days,
      dailyCheckin,
    };
    const rfOutput = computeReadinessAndFatigue(rfInput);

    console.log(
      `[today] readiness=${rfOutput.readiness_score}, fatigue=${rfOutput.fatigue_score}, ` +
        `reasons=[${rfOutput.reason_codes.join(",")}]`
    );

    // 4. Build inputs for candidate generation
    const state: DailyState = {
      readiness_score: rfOutput.readiness_score,
      fatigue_score: rfOutput.fatigue_score,
      reason_codes: rfOutput.reason_codes,
    };

    const history: DailyHistory = {
      consecutive_training_days: row?.days_since_rest ?? 0,
    };

    const constraints: DailyConstraints = {
      has_scheduled_workout: false,
      scheduled_template_ref: null,
    };

    // 5. Generate ordered candidates
    const candidates = generateDailyRecommendation(state, history, constraints);

    // 6. Run calibrator (non-fatal on error)
    const calibration = runCalibrator(checkinRes.data, rfOutput, candidates[0]);

    // 6a. Apply calibration: re-order candidates, adjust caution, update rationale
    const calibratedCandidates = applyCandidateCalibration(candidates, calibration);

    // 7. Build evidence summary
    const evidence = buildEvidence(row, loadRows, rfOutput, checkinRes.data, calibration);

    // 8. Assemble response
    const response: TodayRecommendationResponse = {
      schema_version: SchemaVersion,
      recommendation_id: `${userId}:${date}`,
      date,
      user_id: userId,
      candidates: calibratedCandidates,
      evidence,
      llm_used: false,
      generated_at: generatedAt,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("[today] Error building recommendation:", error);
    res.status(200).json(coldStart(userId, date, generatedAt));
  }
}
