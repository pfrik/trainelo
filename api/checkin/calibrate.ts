/**
 * POST /api/checkin/calibrate
 * Vercel Serverless Function: Runs the deterministic session calibrator.
 *
 * Accepts check-in data + optional planned session, fetches wearable signals
 * from the R&F pipeline, runs the pure calibrator, and returns the result.
 *
 * Use cases:
 * - Preview calibration before persisting a check-in
 * - Recalibrate after editing check-in fields
 * - Standalone calibration with explicit wearable overrides
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  getDailyUserState,
  getTrainingLoad7Days,
  getDailyCheckin,
  type DailyUserStateRow,
  type TrainingLoadRow,
} from "../../src/lib/db/queries.js";
import {
  computeReadinessAndFatigue,
  type ReadinessAndFatigueInput,
  type ReadinessAndFatigueOutput,
} from "../../src/lib/core/recommendations/computeReadinessAndFatigue.js";
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
import type {
  SleepSessionInput,
  HrvNightInput,
  DailyMetricsInput,
  TrainingLoadInput,
} from "../../src/lib/core/recommendations/computeDailyRecommendation.js";
import type { DailyCheckinInput } from "../../src/lib/core/recommendations/computeReadinessAndFatigue.js";

// ============================================================================
// Request Schema
// ============================================================================

const MoodSchema = z.enum(["drained", "tired", "okay", "good", "great"]);
const ReasonBucketSchema = z.enum(["sick", "hurt", "fried", "none"]);

const PlannedSessionSchema = z.object({
  planned_duration_minutes: z.number().int().min(1).nullable().optional(),
  planned_intensity: z.number().min(0).max(1).nullable().optional(),
}).optional();

const CalibrateRequestSchema = z.object({
  /** ISO date (YYYY-MM-DD). Defaults to today UTC. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  /**
   * Inline check-in data. If omitted, the endpoint reads the persisted
   * check-in for this user+date from the database.
   */
  checkin: z.object({
    mood: MoodSchema,
    rpe: z.number().int().min(1).max(10).nullable().optional(),
    soreness: z.number().int().min(0).max(10).nullable().optional(),
    pain_flag: z.boolean().nullable().optional(),
    illness_flag: z.boolean().nullable().optional(),
    reason_bucket: ReasonBucketSchema.nullable().optional(),
    pain_severity: z.number().int().min(0).max(10).nullable().optional(),
    pain_locations: z.array(z.string().max(50)).max(20).nullable().optional(),
    sleep_quality: z.number().int().min(1).max(5).nullable().optional(),
    perceived_energy: z.number().int().min(1).max(5).nullable().optional(),
    motivation: z.number().int().min(1).max(5).nullable().optional(),
    life_stress: z.number().int().min(1).max(5).nullable().optional(),
    time_constraint_minutes: z.number().int().min(1).nullable().optional(),
  }).optional(),

  /** Planned session details (for duration/intensity multiplier context). */
  planned_session: PlannedSessionSchema,
});

// ============================================================================
// Auth Helpers (shared pattern)
// ============================================================================

let authClient: SupabaseClient | null = null;
let authClientConfig: { supabaseUrl: string; supabaseKey: string } | null = null;

function cleanEnvValue(v: string | undefined | null): string | null {
  if (v === undefined || v === null) return null;
  const withoutControls = v.replace(/[\u0000-\u001F\u007F]/g, "");
  let cleaned = withoutControls.trim();
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
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

function inferSupabaseBaseUrlFromJwt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadSegment = parts[1];
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLength);
    const payloadJson = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(payloadJson) as { iss?: unknown };
    const issuer = typeof payload?.iss === "string" ? payload.iss : null;
    if (!issuer) return null;
    if (issuer.endsWith("/auth/v1")) return issuer.slice(0, -"/auth/v1".length);
    return new URL(issuer).origin;
  } catch {
    return null;
  }
}

function getAuthClient(supabaseUrl: string, supabaseKey: string): SupabaseClient | null {
  if (
    authClient &&
    authClientConfig?.supabaseUrl === supabaseUrl &&
    authClientConfig?.supabaseKey === supabaseKey
  ) {
    return authClient;
  }
  try {
    authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    authClientConfig = { supabaseUrl, supabaseKey };
  } catch (error) {
    console.warn("[auth] Supabase client init failed.", {
      message: error instanceof Error ? error.message : undefined,
    });
    return null;
  }
  return authClient;
}

function extractBearerToken(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function resolveUserIdFromAuthHeader(authHeader: string): Promise<string | null> {
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  const inferredBaseUrl = inferSupabaseBaseUrlFromJwt(token);
  const inferredParsedUrl = inferredBaseUrl ? tryParseUrl(inferredBaseUrl) : null;
  let supabaseUrl: string | null = inferredParsedUrl;

  if (!supabaseUrl) {
    const candidates = [
      cleanEnvValue(process.env.SUPABASE_URL),
      cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
      cleanEnvValue(process.env.VITE_SUPABASE_URL),
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const parsed = tryParseUrl(candidate);
      if (parsed) { supabaseUrl = parsed; break; }
    }
  }

  if (!supabaseUrl) return null;

  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey =
    cleanEnvValue(process.env.SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
  const supabaseKey = anonKey || serviceRoleKey;
  if (!supabaseKey) return null;

  const client = getAuthClient(supabaseUrl, supabaseKey);
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// ============================================================================
// Input Mapping (same as today.ts — DB rows → R&F pipeline inputs)
// ============================================================================

function mapSleep(row: DailyUserStateRow, date: string): SleepSessionInput | null {
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

function mapHrv(row: DailyUserStateRow, date: string): HrvNightInput | null {
  if (row.hrv_rmssd == null || row.hrv_baseline == null) return null;
  return { date, hrv_rmssd: row.hrv_rmssd, hrv_baseline: row.hrv_baseline, hrv_status: "", weekly_avg: 0 };
}

function mapMetrics(row: DailyUserStateRow, date: string): DailyMetricsInput | null {
  if (row.recovery_score == null) return null;
  return { date, recovery_score: row.recovery_score, body_battery_high: 0, body_battery_low: 0, resting_heart_rate: 0, stress_avg: 0 };
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
const VALID_REASON_BUCKETS = new Set(["sick", "hurt", "fried", "none"]);

function mapCheckinForRF(row: { mood: string; rpe?: number | null; soreness?: number | null; pain_flag?: boolean | null; illness_flag?: boolean | null }): DailyCheckinInput | null {
  if (!VALID_MOODS.has(row.mood)) return null;
  return {
    mood: row.mood as DailyCheckinInput["mood"],
    rpe: row.rpe ?? null,
    soreness: row.soreness ?? null,
    pain_flag: row.pain_flag ?? false,
    illness_flag: row.illness_flag ?? false,
  };
}

// ============================================================================
// Wearable Signal Derivation
// ============================================================================

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
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "INVALID_REQUEST", details: "Invalid JSON" });
    return;
  }

  // Validate
  const parseResult = CalibrateRequestSchema.safeParse(body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "INVALID_REQUEST",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const payload = parseResult.data;

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

  const now = new Date();
  const date = payload.date ?? now.toISOString().slice(0, 10);

  try {
    // ---- Resolve check-in data ----
    // Prefer inline check-in; fall back to DB row for this user+date
    let checkinInput: CalibratorCheckinInput | null = null;

    if (payload.checkin) {
      checkinInput = {
        mood: payload.checkin.mood as Mood5,
        rpe: payload.checkin.rpe ?? null,
        soreness: payload.checkin.soreness ?? null,
        pain_flag: payload.checkin.pain_flag ?? null,
        illness_flag: payload.checkin.illness_flag ?? null,
        reason_bucket: payload.checkin.reason_bucket
          ? (payload.checkin.reason_bucket as ReasonBucket)
          : null,
        pain_severity: payload.checkin.pain_severity ?? null,
        pain_locations: payload.checkin.pain_locations ?? null,
        sleep_quality: payload.checkin.sleep_quality ?? null,
        perceived_energy: payload.checkin.perceived_energy ?? null,
        motivation: payload.checkin.motivation ?? null,
        life_stress: payload.checkin.life_stress ?? null,
        time_constraint_minutes: payload.checkin.time_constraint_minutes ?? null,
      };
    } else {
      // Fetch persisted check-in from DB
      const checkinRes = await getDailyCheckin(userId, date);
      if (checkinRes.data && VALID_MOODS.has(checkinRes.data.mood)) {
        const row = checkinRes.data;
        checkinInput = {
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
        };
      }
    }

    if (!checkinInput) {
      res.status(400).json({
        error: "NO_CHECKIN_DATA",
        details: "No inline check-in provided and no persisted check-in found for this date.",
      });
      return;
    }

    // ---- Fetch wearable signals via R&F pipeline ----
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

      const dailyCheckin = mapCheckinForRF(checkinInput);
      const rfInput: ReadinessAndFatigueInput = {
        sleep,
        hrv,
        metrics,
        trainingLoad7Days,
        dailyCheckin,
      };
      const rfOutput = computeReadinessAndFatigue(rfInput);
      wearableSignals = buildWearableSignals(rfOutput);
    } else {
      console.warn("[calibrate] DB fetch error (non-fatal), proceeding without wearable signals.");
    }

    // ---- Run calibrator ----
    const calibratorInput: CalibratorInput = {
      morning_checkin: checkinInput,
      wearable_signals: wearableSignals,
      planned_session: payload.planned_session
        ? {
            planned_duration_minutes: payload.planned_session.planned_duration_minutes ?? null,
            planned_intensity: payload.planned_session.planned_intensity ?? null,
          }
        : null,
    };

    const result: CalibrationResult = calibrateSession(calibratorInput);

    console.log(
      `[calibrate] user=${userId} date=${date} level=${result.level} ` +
        `intensity=${result.intensity_multiplier} duration=${result.duration_multiplier} ` +
        `rules=[${result.applied_rules.join(",")}]`,
    );

    res.status(200).json({
      ok: true,
      date,
      calibration: result,
    });
  } catch (error) {
    console.error("[calibrate] Error:", error);
    res.status(500).json({ error: "CALIBRATION_FAILED" });
  }
}
