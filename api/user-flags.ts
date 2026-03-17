/**
 * POST /api/user-flags
 * Vercel Serverless Function: Persists morning check-in data.
 *
 * Validates request → resolves user identity → upserts daily_checkins row →
 * runs calibrator → responds with calibration result.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  upsertDailyCheckin,
  getDailyUserState,
  getTrainingLoad7Days,
  type DailyUserStateRow,
  type TrainingLoadRow,
} from "../src/lib/db/queries.js";
import {
  computeReadinessAndFatigue,
  type ReadinessAndFatigueInput,
  type ReadinessAndFatigueOutput,
} from "../src/lib/core/recommendations/computeReadinessAndFatigue.js";
import type { DailyCheckinInput } from "../src/lib/core/recommendations/computeReadinessAndFatigue.js";
import {
  calibrateSession,
  type CalibratorInput,
  type CalibrationResult,
  type CheckinInput as CalibratorCheckinInput,
  type WearableSignalsInput,
  type WearableReadiness,
  type Mood5,
  type ReasonBucket,
} from "../src/lib/core/checkin/calibrator.js";
import type {
  SleepSessionInput,
  HrvNightInput,
  DailyMetricsInput,
  TrainingLoadInput,
} from "../src/lib/core/recommendations/computeDailyRecommendation.js";

// ============================================================================
// Request Schema
// ============================================================================

const MoodSchema = z.enum(["drained", "tired", "okay", "good", "great"]);

const ReasonBucketSchema = z.enum(["sick", "hurt", "fried", "none"]);

const UserFlagsRequestSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  mood: MoodSchema,
  rpe: z.number().int().min(1).max(10).optional(),
  soreness: z.number().int().min(0).max(10).optional(),
  pain_flag: z.boolean().optional(),
  illness_flag: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  // v2 fields
  reason_bucket: ReasonBucketSchema.optional(),
  reason_tags: z.array(z.string().max(50)).max(10).optional(),
  pain_severity: z.number().int().min(0).max(10).optional(),
  pain_locations: z.array(z.string().max(50)).max(20).optional(),
  sleep_quality: z.number().int().min(1).max(5).optional(),
  perceived_energy: z.number().int().min(1).max(5).optional(),
  motivation: z.number().int().min(1).max(5).optional(),
  life_stress: z.number().int().min(1).max(5).optional(),
  time_constraint_minutes: z.number().int().min(1).optional(),
  checkin_version: z.number().int().min(1).optional(),
  payload: z.record(z.unknown()).optional(),
});

// ============================================================================
// Auth Helpers (same pattern as recommendation endpoints)
// ============================================================================

let authClient: SupabaseClient | null = null;
let authClientConfig: { supabaseUrl: string; supabaseKey: string } | null =
  null;

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
  supabaseKey: string,
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
  authHeader: string,
): Promise<string | null> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return null;
  }

  const inferredBaseUrl = inferSupabaseBaseUrlFromJwt(token);
  const inferredParsedUrl = inferredBaseUrl
    ? tryParseUrl(inferredBaseUrl)
    : null;
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
    console.warn("[auth] No valid supabaseUrl candidate.");
    return null;
  }

  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey =
    cleanEnvValue(process.env.SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
  const supabaseKey = anonKey || serviceRoleKey;

  if (!supabaseKey) {
    console.warn("[auth] Missing supabase key for token verification.");
    return null;
  }

  const client = getAuthClient(supabaseUrl, supabaseKey);
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    console.warn("[auth] Auth token verification failed.", {
      message: error?.message,
    });
    return null;
  }

  return data.user.id;
}

// ============================================================================
// Calibration Helpers
// ============================================================================

const VALID_MOODS = new Set(["drained", "tired", "okay", "good", "great"]);
const VALID_REASON_BUCKETS = new Set(["sick", "hurt", "fried", "none"]);

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

function deriveWearableReadiness(readiness: number, fatigue: number): WearableReadiness {
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

/**
 * Run calibrator after a successful check-in persist.
 * Non-fatal — returns null on any error so persistence is never blocked.
 */
async function runPostPersistCalibration(
  userId: string,
  date: string,
  checkinPayload: {
    mood: string;
    rpe?: number;
    soreness?: number;
    pain_flag?: boolean;
    illness_flag?: boolean;
    reason_bucket?: string;
    pain_severity?: number;
    pain_locations?: string[];
    sleep_quality?: number;
    perceived_energy?: number;
    motivation?: number;
    life_stress?: number;
    time_constraint_minutes?: number;
  },
): Promise<CalibrationResult | null> {
  try {
    if (!VALID_MOODS.has(checkinPayload.mood)) return null;

    const checkinInput: CalibratorCheckinInput = {
      mood: checkinPayload.mood as Mood5,
      rpe: checkinPayload.rpe ?? null,
      soreness: checkinPayload.soreness ?? null,
      pain_flag: checkinPayload.pain_flag ?? null,
      illness_flag: checkinPayload.illness_flag ?? null,
      reason_bucket: checkinPayload.reason_bucket && VALID_REASON_BUCKETS.has(checkinPayload.reason_bucket)
        ? (checkinPayload.reason_bucket as ReasonBucket)
        : null,
      pain_severity: checkinPayload.pain_severity ?? null,
      pain_locations: checkinPayload.pain_locations ?? null,
      sleep_quality: checkinPayload.sleep_quality ?? null,
      perceived_energy: checkinPayload.perceived_energy ?? null,
      motivation: checkinPayload.motivation ?? null,
      life_stress: checkinPayload.life_stress ?? null,
      time_constraint_minutes: checkinPayload.time_constraint_minutes ?? null,
    };

    // Fetch wearable signals from R&F pipeline
    const [stateRes, loadRes] = await Promise.all([
      getDailyUserState(userId, date),
      getTrainingLoad7Days(userId, date),
    ]);

    let wearableSignals: WearableSignalsInput | null = null;

    if (!stateRes.error && !loadRes.error) {
      const row = stateRes.data;
      const loadRows = loadRes.data;

      const sleep = row ? mapSleep(row, date) : null;
      const hrv = row ? mapHrv(row, date) : null;
      const metrics = row ? mapMetrics(row, date) : null;
      const trainingLoad7Days = mapTrainingLoad(loadRows);

      const dailyCheckin: DailyCheckinInput | null = {
        mood: checkinPayload.mood as DailyCheckinInput["mood"],
        rpe: checkinPayload.rpe ?? null,
        soreness: checkinPayload.soreness ?? null,
        pain_flag: checkinPayload.pain_flag ?? false,
        illness_flag: checkinPayload.illness_flag ?? false,
      };

      const rfInput: ReadinessAndFatigueInput = { sleep, hrv, metrics, trainingLoad7Days, dailyCheckin };
      const rfOutput = computeReadinessAndFatigue(rfInput);
      wearableSignals = buildWearableSignals(rfOutput);
    }

    const calibratorInput: CalibratorInput = {
      morning_checkin: checkinInput,
      wearable_signals: wearableSignals,
      planned_session: null,
    };

    return calibrateSession(calibratorInput);
  } catch (err) {
    console.warn("[user-flags] Calibration error (non-fatal):", err);
    return null;
  }
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

  // Parse body
  let body: unknown;
  try {
    const rawBody = req.body;
    if (typeof rawBody === "string") {
      body = JSON.parse(rawBody);
    } else {
      body = rawBody;
    }
  } catch {
    res.status(400).json({
      error: "INVALID_REQUEST",
      details: { formErrors: ["Invalid JSON"], fieldErrors: {} },
    });
    return;
  }

  // Validate
  const parseResult = UserFlagsRequestSchema.safeParse(body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "INVALID_REQUEST",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const payload = parseResult.data;

  // Business-rule validation (mood-specific required fields)
  if (payload.mood === "drained" && !payload.reason_bucket) {
    res.status(400).json({
      error: "VALIDATION_FAILED",
      details: "drained mood requires reason_bucket",
    });
    return;
  }
  if (
    payload.mood === "drained" &&
    payload.reason_bucket === "hurt" &&
    (payload.pain_severity == null || payload.pain_severity < 1)
  ) {
    res.status(400).json({
      error: "VALIDATION_FAILED",
      details: "hurt reason requires pain_severity >= 1",
    });
    return;
  }
  if (
    payload.mood === "drained" &&
    payload.reason_bucket === "hurt" &&
    (!payload.pain_locations || payload.pain_locations.length === 0)
  ) {
    res.status(400).json({
      error: "VALIDATION_FAILED",
      details: "hurt reason requires at least one pain_location",
    });
    return;
  }

  // Resolve identity
  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader) {
    userId = await resolveUserIdFromAuthHeader(authHeader);
  } else {
    userId = cleanEnvValue(process.env.TRAINELO_USER_ID);
  }

  if (!userId) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  // Default date to today UTC
  const date = payload.date ?? new Date().toISOString().slice(0, 10);
  const recorded_at = new Date().toISOString();

  // Extract scale values: prefer top-level fields, fall back to payload
  const payloadObj = (payload.payload ?? {}) as Record<string, unknown>;
  const sleepQuality = payload.sleep_quality
    ?? (typeof payloadObj.sleep_quality === "number" ? payloadObj.sleep_quality : undefined);
  const perceivedEnergy = payload.perceived_energy
    ?? (typeof payloadObj.perceived_energy === "number" ? payloadObj.perceived_energy : undefined);
  const motivation = payload.motivation
    ?? (typeof payloadObj.motivation === "number" ? payloadObj.motivation : undefined);
  const lifeStress = payload.life_stress
    ?? (typeof payloadObj.life_stress === "number" ? payloadObj.life_stress : undefined);

  // Persist
  const result = await upsertDailyCheckin({
    user_id: userId,
    date,
    mood: payload.mood,
    rpe: payload.rpe,
    soreness: payload.soreness,
    pain_flag: payload.pain_flag,
    illness_flag: payload.illness_flag,
    notes: payload.notes,
    reason_bucket: payload.reason_bucket,
    reason_tags: payload.reason_tags,
    pain_severity: payload.pain_severity,
    pain_locations: payload.pain_locations,
    sleep_quality: sleepQuality,
    perceived_energy: perceivedEnergy,
    motivation,
    life_stress: lifeStress,
    time_constraint_minutes: payload.time_constraint_minutes,
    checkin_version: payload.checkin_version ?? 2,
    payload: payload.payload,
  });

  if (!result.success) {
    // Constraint violations (check, not-null, exclusion) are client errors
    const constraintCodes = ["23514", "23502", "23503"];
    if (result.error_code && constraintCodes.includes(result.error_code)) {
      console.warn("[user-flags] Constraint violation:", result.error);
      res.status(400).json({ error: "VALIDATION_FAILED" });
      return;
    }
    console.error("[user-flags] Persistence failed:", result.error);
    res.status(500).json({ error: "PERSISTENCE_FAILED" });
    return;
  }

  console.log("[user-flags] Recorded:", { user_id: userId, date, mood: payload.mood });

  // Run calibrator (non-fatal — persistence already succeeded)
  const calibration = await runPostPersistCalibration(userId, date, {
    mood: payload.mood,
    rpe: payload.rpe,
    soreness: payload.soreness,
    pain_flag: payload.pain_flag,
    illness_flag: payload.illness_flag,
    reason_bucket: payload.reason_bucket,
    pain_severity: payload.pain_severity,
    pain_locations: payload.pain_locations,
    sleep_quality: sleepQuality,
    perceived_energy: perceivedEnergy,
    motivation,
    life_stress: lifeStress,
    time_constraint_minutes: payload.time_constraint_minutes,
  });

  if (calibration) {
    console.log(
      `[user-flags] Calibration: level=${calibration.level} ` +
        `intensity=${calibration.intensity_multiplier} duration=${calibration.duration_multiplier}`,
    );
  }

  res.status(200).json({ ok: true, recorded_at, date, calibration: calibration ?? null });
}
