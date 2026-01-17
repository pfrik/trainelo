/**
 * Database query functions for dashboard data.
 * Server-side only - uses service role client.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export interface HRVRecord {
  id: string;
  date: string;
  hrv_rmssd: number | null;
  hrv_baseline: number | null;
  hrv_status: string | null;
  weekly_avg: number | null;
}

export interface SleepRecord {
  id: string;
  date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  duration_seconds: number | null;
  sleep_score: number | null;
  deep_seconds: number | null;
  light_seconds: number | null;
  rem_seconds: number | null;
  awake_seconds: number | null;
  efficiency_percent: number | null;
  avg_heart_rate: number | null;
}

export interface WorkoutRecord {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  activity_type: string | null;
  activity_subtype: string | null;
  title: string | null;
  distance_meters: number | null;
  avg_heart_rate: number | null;
  training_stress_score: number | null;
  perceived_exertion: number | null;
}

export interface DailyMetricsRecord {
  id: string;
  date: string;
  steps: number | null;
  active_calories: number | null;
  resting_heart_rate: number | null;
  stress_avg: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  recovery_score: number | null;
}

export interface UserDataSummary {
  hrv: HRVRecord[];
  sleep: SleepRecord[];
  workouts: WorkoutRecord[];
  dailyMetrics: DailyMetricsRecord[];
}

// ============================================================================
// Service Role Client
// ============================================================================

let serviceRoleClient: SupabaseClient | null = null;

function stripSurroundingQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function sanitizeEnvValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const withoutControl = value.replace(/[\u0000-\u001F\u007F]/g, "");
  const trimmed = withoutControl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const unquoted = stripSurroundingQuotes(trimmed).trim();
  return unquoted.length > 0 ? unquoted : null;
}

function getValidatedSupabaseUrl(): string {
  const cleaned = sanitizeEnvValue(process.env.SUPABASE_URL);
  if (!cleaned) {
    throw new Error("Missing/invalid SUPABASE_URL");
  }

  try {
    const parsed = new URL(cleaned);
    return parsed.toString();
  } catch {
    throw new Error("Missing/invalid SUPABASE_URL");
  }
}

/**
 * Get or create a Supabase client with service role privileges.
 */
function getServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  const supabaseUrl = getValidatedSupabaseUrl();
  const serviceRoleKey = sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey =
    sanitizeEnvValue(process.env.SUPABASE_ANON_KEY) ||
    sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    sanitizeEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
  const hasService = !!serviceRoleKey;
  const hasAnon = !!anonKey;

  console.log(`[db] Using supabaseUrl: ${JSON.stringify(supabaseUrl)}`);
  console.log("[db] Key present:", { hasService, hasAnon });

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  try {
    serviceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (err) {
    console.warn("[db] Supabase client init failed.", {
      supabaseUrl: JSON.stringify(supabaseUrl),
      message: (err as { message?: string } | null | undefined)?.message,
    });
    throw err;
  }

  return serviceRoleClient;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get recent HRV records for a user.
 */
export async function getRecentHRV(
  userId: string,
  days: number = 7
): Promise<HRVRecord[]> {
  const client = getServiceRoleClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await client
    .from("hrv_nights")
    .select("id, date, hrv_rmssd, hrv_baseline, hrv_status, weekly_avg")
    .eq("user_id", userId)
    .gte("date", startDate.toISOString().split("T")[0])
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching HRV data:", error);
    return [];
  }

  return data || [];
}

/**
 * Get recent sleep records for a user.
 */
export async function getRecentSleep(
  userId: string,
  days: number = 7
): Promise<SleepRecord[]> {
  const client = getServiceRoleClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await client
    .from("sleep_sessions")
    .select(
      "id, date, sleep_start, sleep_end, duration_seconds, sleep_score, deep_seconds, light_seconds, rem_seconds, awake_seconds, efficiency_percent, avg_heart_rate"
    )
    .eq("user_id", userId)
    .gte("date", startDate.toISOString().split("T")[0])
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching sleep data:", error);
    return [];
  }

  return data || [];
}

/**
 * Get recent workouts for a user.
 */
export async function getRecentWorkouts(
  userId: string,
  days: number = 14
): Promise<WorkoutRecord[]> {
  const client = getServiceRoleClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await client
    .from("workouts")
    .select(
      "id, started_at, ended_at, duration_seconds, activity_type, activity_subtype, title, distance_meters, avg_heart_rate, training_stress_score, perceived_exertion"
    )
    .eq("user_id", userId)
    .gte("started_at", startDate.toISOString())
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error fetching workouts:", error);
    return [];
  }

  return data || [];
}

/**
 * Get recent daily metrics for a user.
 */
export async function getDailyMetrics(
  userId: string,
  days: number = 7
): Promise<DailyMetricsRecord[]> {
  const client = getServiceRoleClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await client
    .from("canonical_daily_metrics")
    .select(
      "id, date, steps, active_calories, resting_heart_rate, stress_avg, body_battery_high, body_battery_low, recovery_score"
    )
    .eq("user_id", userId)
    .gte("date", startDate.toISOString().split("T")[0])
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching daily metrics:", error);
    return [];
  }

  return data || [];
}

/**
 * Fetch all user data needed for recommendation in parallel.
 */
export async function getUserDataSummary(
  userId: string
): Promise<UserDataSummary> {
  const [hrv, sleep, workouts, dailyMetrics] = await Promise.all([
    getRecentHRV(userId, 7),
    getRecentSleep(userId, 7),
    getRecentWorkouts(userId, 14),
    getDailyMetrics(userId, 7),
  ]);

  return { hrv, sleep, workouts, dailyMetrics };
}

// ============================================================================
// Evidence Calculation
// ============================================================================

export interface CalculatedEvidence {
  fatigue_score: number | null;
  fitness_score: number | null;
  hrv_trend: "rising" | "stable" | "declining" | null;
  sleep_quality: number | null;
  days_since_rest: number | null;
  confidence: number;
}

/**
 * Calculate HRV trend from recent records.
 * Compares most recent HRV to the 7-day baseline.
 */
function calculateHRVTrend(
  hrv: HRVRecord[]
): "rising" | "stable" | "declining" | null {
  if (hrv.length < 2) return null;

  const latest = hrv[0];
  if (!latest.hrv_rmssd) return null;

  // Use baseline if available, otherwise calculate from recent data
  const baseline = latest.hrv_baseline || latest.weekly_avg;

  if (!baseline) {
    // Calculate average from available records
    const validRecords = hrv.filter((r) => r.hrv_rmssd != null);
    if (validRecords.length < 2) return null;

    const avg =
      validRecords.slice(1).reduce((sum, r) => sum + (r.hrv_rmssd || 0), 0) /
      (validRecords.length - 1);

    const diff = ((latest.hrv_rmssd - avg) / avg) * 100;

    if (diff > 10) return "rising";
    if (diff < -10) return "declining";
    return "stable";
  }

  const diff = ((latest.hrv_rmssd - baseline) / baseline) * 100;

  if (diff > 10) return "rising";
  if (diff < -10) return "declining";
  return "stable";
}

/**
 * Calculate sleep quality from last night's sleep.
 * Uses sleep_score if available, otherwise estimates from duration.
 */
function calculateSleepQuality(sleep: SleepRecord[]): number | null {
  if (sleep.length === 0) return null;

  const lastNight = sleep[0];

  // Use sleep score directly if available
  if (lastNight.sleep_score != null) {
    return lastNight.sleep_score;
  }

  // Estimate from duration (target: 7-9 hours = 70-100%)
  if (lastNight.duration_seconds != null) {
    const hours = lastNight.duration_seconds / 3600;
    if (hours >= 8) return 90;
    if (hours >= 7) return 80;
    if (hours >= 6) return 65;
    if (hours >= 5) return 50;
    return 35;
  }

  return null;
}

/**
 * Calculate days since last rest day.
 * A rest day is defined as a day with no workouts or only very light activity.
 */
function calculateDaysSinceRest(workouts: WorkoutRecord[]): number | null {
  if (workouts.length === 0) return null;

  // Group workouts by date
  const workoutDates = new Set(
    workouts.map((w) => w.started_at.split("T")[0])
  );

  const today = new Date();
  let daysSinceRest = 0;

  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];

    if (!workoutDates.has(dateStr)) {
      // Found a rest day
      return daysSinceRest;
    }
    daysSinceRest++;
  }

  return daysSinceRest;
}

/**
 * Calculate fatigue score based on recent training load.
 * Higher score = more fatigued.
 */
function calculateFatigueScore(
  workouts: WorkoutRecord[],
  dailyMetrics: DailyMetricsRecord[]
): number | null {
  // Use body battery if available
  const latestMetrics = dailyMetrics[0];
  if (latestMetrics?.body_battery_low != null) {
    // Body battery is 0-100 where higher = more energy
    // Invert to fatigue score where higher = more fatigued
    return 100 - latestMetrics.body_battery_low;
  }

  // Otherwise estimate from training load
  if (workouts.length === 0) return null;

  // Count workouts in last 3 days and estimate fatigue
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentWorkouts = workouts.filter(
    (w) => new Date(w.started_at) >= threeDaysAgo
  );

  // Simple heuristic: more workouts = more fatigue
  const workoutCount = recentWorkouts.length;
  const totalDuration = recentWorkouts.reduce(
    (sum, w) => sum + (w.duration_seconds || 0),
    0
  );

  // Base fatigue on workout volume
  // 0 workouts = 20, 1 = 35, 2 = 50, 3+ = 65+
  const baseFatigue = Math.min(20 + workoutCount * 15, 80);

  // Add duration factor (each hour adds ~5 points)
  const durationBonus = Math.min((totalDuration / 3600) * 5, 20);

  return Math.round(baseFatigue + durationBonus);
}

/**
 * Calculate overall evidence from user data.
 */
export function calculateEvidence(data: UserDataSummary): CalculatedEvidence {
  const { hrv, sleep, workouts, dailyMetrics } = data;

  // Calculate individual metrics
  const hrv_trend = calculateHRVTrend(hrv);
  const sleep_quality = calculateSleepQuality(sleep);
  const days_since_rest = calculateDaysSinceRest(workouts);
  const fatigue_score = calculateFatigueScore(workouts, dailyMetrics);

  // Fitness score is harder to calculate without long-term data
  // For now, use recovery score if available
  const fitness_score = dailyMetrics[0]?.recovery_score || null;

  // Calculate confidence based on data availability
  let dataPoints = 0;
  if (hrv.length > 0) dataPoints++;
  if (sleep.length > 0) dataPoints++;
  if (workouts.length > 0) dataPoints++;
  if (dailyMetrics.length > 0) dataPoints++;

  // Confidence: 0.3 (cold start) to 0.9 (all data available)
  const confidence = Math.min(0.3 + dataPoints * 0.15, 0.9);

  return {
    fatigue_score,
    fitness_score,
    hrv_trend,
    sleep_quality,
    days_since_rest,
    confidence,
  };
}
