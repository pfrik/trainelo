/**
 * POST /api/engine/today
 *
 * Vercel Serverless Function: Returns today's recommendation using the TATS engine.
 *
 * This endpoint runs the full recommendation engine pipeline:
 * 1. Loads user data from Supabase
 * 2. Computes enhanced baseline from 42-day history
 * 3. Runs daily state update (fitness/fatigue + recovery)
 * 4. Generates training recommendation with risk analysis
 * 5. Persists result with idempotency (same inputs = cached result)
 *
 * Request:
 *   POST /api/engine/today
 *   Headers:
 *     Authorization: Bearer <supabase-jwt>  (optional, falls back to TRAINELO_USER_ID)
 *   Body:
 *     { date?: string, forceRecompute?: boolean, includeDebug?: boolean }
 *
 * Response:
 *   {
 *     recommendation_id: string,
 *     date: string,
 *     cached: boolean,
 *     action: "GO" | "MODIFY" | "SWAP" | "SKIP",
 *     readiness: { ... },
 *     decision: { ... },
 *     debug?: { ... }
 *   }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runEngineForUserDay, type RunEngineResult } from "../../src/server/engine/runEngineForUserDay.js";

// ============================================================================
// Configuration
// ============================================================================

const TEST_USER_ID = process.env.TRAINELO_USER_ID;
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
      auth: { autoRefreshToken: false, persistSession: false },
    });
    authClientConfig = { supabaseUrl, supabaseKey };
  } catch (error) {
    console.warn("[auth] Supabase client init failed.", error);
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
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    console.warn("[auth] Auth token verification failed.", error?.message);
    return null;
  }

  return data.user.id;
}

// ============================================================================
// Response Types
// ============================================================================

interface EngineApiResponse {
  recommendation_id: string;
  date: string;
  user_id: string;
  cached: boolean;
  action: string;
  summary: string;
  readiness: {
    readiness_smoothed: number;
    performance_potential: number;
    fitness_total: number;
    fatigue_total: number;
    data_confidence: number;
  };
  decision: {
    action: string;
    confidence: number;
    explanation: string;
    modifications?: Array<{
      type: string;
      reason: string;
    }>;
    final_workout?: {
      sport: string;
      workout_type: string;
      planned_duration_sec: number;
      description?: string | null;
    };
  };
  debug?: unknown;
  generated_at: string;
}

interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}

// ============================================================================
// Response Builders
// ============================================================================

function buildSuccessResponse(
  userId: string,
  dateIso: string,
  result: RunEngineResult
): EngineApiResponse {
  const outputs = result.outputs;
  const decision = outputs?.decision;
  const readiness = outputs?.readiness;

  // For cached results, extract from existing recommendation
  if (result.cached && result.existingRecommendation) {
    const recData = result.existingRecommendation.recommendation_data as any;
    const recReadiness = recData?.readiness ?? {};
    const recDecision = recData?.decision ?? recData ?? {};

    return {
      recommendation_id: result.recommendationId,
      date: dateIso,
      user_id: userId,
      cached: true,
      action: recDecision.action ?? "GO",
      summary: result.existingRecommendation.recommendation_summary,
      readiness: {
        readiness_smoothed: recReadiness.readiness_smoothed ?? 0.7,
        performance_potential: recReadiness.performance_potential ?? 0,
        fitness_total: recReadiness.fitness_total ?? 0,
        fatigue_total: recReadiness.fatigue_total ?? 0,
        data_confidence: recReadiness.data_confidence ?? 0.5,
      },
      decision: {
        action: recDecision.action ?? "GO",
        confidence: recDecision.confidence ?? 0.5,
        explanation: recDecision.explanation ?? "",
        modifications: recDecision.modifications?.map((m: any) => ({
          type: m.type,
          reason: m.reason,
        })),
        final_workout: recDecision.final_workout
          ? {
              sport: recDecision.final_workout.sport,
              workout_type: recDecision.final_workout.workout_type,
              planned_duration_sec: recDecision.final_workout.planned_duration_sec,
              description: recDecision.final_workout.description,
            }
          : undefined,
      },
      debug: result.debug,
      generated_at: new Date().toISOString(),
    };
  }

  // For fresh results
  return {
    recommendation_id: result.recommendationId,
    date: dateIso,
    user_id: userId,
    cached: false,
    action: decision?.action ?? "GO",
    summary: generateSummary(decision, readiness),
    readiness: {
      readiness_smoothed: readiness?.readiness_smoothed ?? 0.7,
      performance_potential: readiness?.performance_potential ?? 0,
      fitness_total: readiness?.fitness_total ?? 0,
      fatigue_total: readiness?.fatigue_total ?? 0,
      data_confidence: readiness?.data_confidence ?? 0.5,
    },
    decision: {
      action: decision?.action ?? "GO",
      confidence: decision?.confidence ?? 0.5,
      explanation: decision?.explanation ?? "",
      modifications: decision?.modifications?.map((m) => ({
        type: m.type,
        reason: m.reason,
      })),
      final_workout: decision?.final_workout
        ? {
            sport: decision.final_workout.sport,
            workout_type: decision.final_workout.workout_type,
            planned_duration_sec: decision.final_workout.planned_duration_sec,
            description: decision.final_workout.description,
          }
        : undefined,
    },
    debug: result.debug,
    generated_at: new Date().toISOString(),
  };
}

function generateSummary(decision: any, readiness: any): string {
  if (!decision || !readiness) {
    return "Recommendation generated with limited data.";
  }

  const readinessPercent = Math.round((readiness.readiness_smoothed ?? 0.7) * 100);

  switch (decision.action) {
    case "GO":
      return `Ready to train (${readinessPercent}% readiness). Proceed with planned workout.`;
    case "MODIFY":
      return `Modified training recommended (${readinessPercent}% readiness). ${decision.modifications?.[0]?.reason ?? "Adjustments suggested."}`;
    case "SWAP":
      return `Workout swap recommended (${readinessPercent}% readiness). ${decision.explanation ?? "Consider alternative."}`;
    case "SKIP":
      return `Rest day recommended (${readinessPercent}% readiness). ${decision.explanation ?? "Recovery prioritized."}`;
    default:
      return `Training recommendation (${readinessPercent}% readiness).`;
  }
}

function buildErrorResponse(code: string, message: string, details?: string): ErrorResponse {
  return {
    error: message,
    code,
    details,
  };
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
    res.status(405).json(buildErrorResponse("METHOD_NOT_ALLOWED", "Only POST method is allowed"));
    return;
  }

  // Parse request body
  const body = typeof req.body === "object" ? req.body : {};
  const requestedDate = body.date as string | undefined;
  const forceRecompute = body.forceRecompute === true;
  const includeDebug = body.includeDebug === true;

  // Determine date
  const now = new Date();
  const dateIso = requestedDate?.slice(0, 10) ?? now.toISOString().slice(0, 10);

  // Resolve user ID
  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader) {
    userId = await resolveUserIdFromAuthHeader(authHeader);
    if (!userId) {
      console.warn("[engine/today] Invalid or expired auth token");
    }
  }

  if (!userId && TEST_USER_ID) {
    userId = TEST_USER_ID;
    console.log(`[engine/today] Using test user: ${userId}`);
  }

  if (!userId) {
    res.status(401).json(
      buildErrorResponse(
        "UNAUTHORIZED",
        "Authentication required",
        "Provide a valid Authorization header or set TRAINELO_USER_ID env var"
      )
    );
    return;
  }

  // Run engine
  try {
    console.log(`[engine/today] Running engine for user ${userId} on ${dateIso}`);
    const startTime = Date.now();

    const result = await runEngineForUserDay(userId, dateIso, {
      forceRecompute,
      includeDebug,
    });

    const elapsed = Date.now() - startTime;
    console.log(
      `[engine/today] ${result.cached ? "Cached" : "Fresh"} result in ${elapsed}ms ` +
        `(hash: ${result.inputHash.slice(0, 8)}...)`
    );

    const response = buildSuccessResponse(userId, dateIso, result);
    res.status(200).json(response);
  } catch (error) {
    console.error("[engine/today] Engine error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json(
      buildErrorResponse("ENGINE_ERROR", "Failed to generate recommendation", message)
    );
  }
}
