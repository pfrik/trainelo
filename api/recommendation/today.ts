/**
 * POST /api/recommendation/today
 * Vercel Serverless Function: Returns today's recommendation based on real user data.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getUserDataSummary,
  calculateEvidence,
  type CalculatedEvidence,
  type UserDataSummary,
} from "../../src/lib/db/queries.js";
import {
  SchemaVersion,
  type TodayRecommendationResponse,
  type RecommendationCandidate,
  type ReasonCode,
  type CautionLevel,
} from "../../src/lib/core/contracts/recommendation.js";

// ============================================================================
// Configuration
// ============================================================================

// For development/testing, use TRAINELO_USER_ID env var
// In production, this should come from auth token
const TEST_USER_ID = process.env.TRAINELO_USER_ID;
let authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient | null {
  if (authClient) {
    return authClient;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseKey = serviceRoleKey || anonKey;

  if (!supabaseUrl || !supabaseKey) {
    const hasSupabaseUrl = Boolean(supabaseUrl);
    const hasServiceRoleKey = Boolean(serviceRoleKey);
    const hasAnonKey = Boolean(anonKey);
    console.warn("Supabase auth env missing.", {
      hasSupabaseUrl,
      hasServiceRoleKey,
      hasAnonKey,
    });
    return null;
  }

  authClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

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

  const client = getAuthClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    console.warn("Auth token verification failed.", error?.message);
    return null;
  }

  return data.user.id;
}

// ============================================================================
// Recommendation Logic
// ============================================================================

interface RecommendationContext {
  evidence: CalculatedEvidence;
  data: UserDataSummary;
  date: string;
}

/**
 * Determine primary recommendation based on evidence.
 */
function determinePrimaryRecommendation(
  ctx: RecommendationContext
): "workout" | "lite" | "rest" {
  const { evidence } = ctx;

  // High fatigue or poor HRV -> suggest rest
  if (evidence.fatigue_score !== null && evidence.fatigue_score > 70) {
    return "rest";
  }

  if (evidence.hrv_trend === "declining") {
    return evidence.fatigue_score && evidence.fatigue_score > 50 ? "rest" : "lite";
  }

  // Poor sleep quality -> suggest lighter workout
  if (evidence.sleep_quality !== null && evidence.sleep_quality < 50) {
    return "lite";
  }

  // Many consecutive workout days -> suggest rest
  if (evidence.days_since_rest !== null && evidence.days_since_rest >= 5) {
    return "rest";
  }

  if (evidence.days_since_rest !== null && evidence.days_since_rest >= 3) {
    return "lite";
  }

  // Default: proceed with scheduled workout
  return "workout";
}

/**
 * Build dynamic rationale based on evidence.
 */
function buildRationale(
  candidateType: string,
  evidence: CalculatedEvidence
): string {
  const parts: string[] = [];

  switch (candidateType) {
    case "scheduled":
      if (evidence.hrv_trend === "rising") {
        parts.push("Your HRV is trending up, indicating good recovery.");
      }
      if (evidence.sleep_quality !== null && evidence.sleep_quality >= 70) {
        parts.push(`Sleep quality was good (${evidence.sleep_quality}%).`);
      }
      if (evidence.fatigue_score !== null && evidence.fatigue_score < 40) {
        parts.push("Fatigue levels are low.");
      }
      if (parts.length === 0) {
        parts.push("Proceed with your scheduled workout.");
      }
      break;

    case "lite_alternative":
      if (evidence.hrv_trend === "declining") {
        parts.push("Your HRV has been declining recently.");
      }
      if (evidence.sleep_quality !== null && evidence.sleep_quality < 60) {
        parts.push(`Sleep quality was suboptimal (${evidence.sleep_quality}%).`);
      }
      if (evidence.fatigue_score !== null && evidence.fatigue_score > 50) {
        parts.push("Moderate fatigue detected.");
      }
      if (parts.length === 0) {
        parts.push("Consider a lighter session to maintain consistency.");
      }
      break;

    case "rest_day":
      if (evidence.fatigue_score !== null && evidence.fatigue_score > 65) {
        parts.push(`High fatigue detected (${evidence.fatigue_score}/100).`);
      }
      if (evidence.days_since_rest !== null && evidence.days_since_rest >= 4) {
        parts.push(`You've trained ${evidence.days_since_rest} days in a row.`);
      }
      if (evidence.hrv_trend === "declining") {
        parts.push("Your HRV trend suggests accumulated stress.");
      }
      if (parts.length === 0) {
        parts.push("A rest day will support recovery and adaptation.");
      }
      break;

    case "skip":
      parts.push("Skip today if life gets in the way.");
      break;
  }

  return parts.join(" ");
}

/**
 * Determine reason codes based on evidence.
 */
function determineReasonCodes(
  candidateType: string,
  evidence: CalculatedEvidence,
  isColdStart: boolean
): ReasonCode[] {
  const codes: ReasonCode[] = [];

  if (isColdStart) {
    codes.push("COLD_START");
  }

  if (evidence.confidence < 0.5) {
    codes.push("INSUFFICIENT_DATA");
  }

  switch (candidateType) {
    case "scheduled":
      codes.push("SCHEDULED_WORKOUT_EXISTS");
      if (evidence.hrv_trend === "rising" || evidence.hrv_trend === "stable") {
        codes.push("RECOVERY_OPTIMAL");
      }
      break;

    case "lite_alternative":
      if (evidence.fatigue_score !== null && evidence.fatigue_score > 50) {
        codes.push("FATIGUE_ELEVATED");
      }
      if (evidence.sleep_quality !== null && evidence.sleep_quality < 60) {
        codes.push("SLEEP_POOR");
      }
      if (evidence.hrv_trend === "declining") {
        codes.push("HRV_DECLINING");
      }
      break;

    case "rest_day":
      codes.push("REST_DAY_DUE");
      if (evidence.fatigue_score !== null && evidence.fatigue_score > 65) {
        codes.push("FATIGUE_HIGH");
      }
      if (evidence.hrv_trend === "declining") {
        codes.push("HRV_LOW");
      }
      break;

    case "skip":
      codes.push("USER_PREFERENCE");
      break;
  }

  return codes;
}

/**
 * Determine caution level based on evidence and recommendation type.
 */
function determineCautionLevel(
  candidateType: string,
  evidence: CalculatedEvidence
): CautionLevel {
  if (candidateType === "scheduled") {
    if (evidence.fatigue_score !== null && evidence.fatigue_score > 60) {
      return "moderate";
    }
    if (evidence.hrv_trend === "declining") {
      return "low";
    }
  }

  return "none";
}

/**
 * Build candidates based on evidence and primary recommendation.
 */
function buildCandidates(ctx: RecommendationContext): RecommendationCandidate[] {
  const { evidence, data } = ctx;
  const primary = determinePrimaryRecommendation(ctx);
  const isColdStart = evidence.confidence < 0.5;

  // Get last workout type to suggest similar or complementary workout
  const lastWorkout = data.workouts[0];
  const suggestedType = lastWorkout?.activity_type === "running" ? "running" : "running";

  const candidates: RecommendationCandidate[] = [];

  // Scheduled workout candidate
  const scheduledCandidate: RecommendationCandidate = {
    candidate_id: "scheduled",
    template_ref: "easy-run-30min",
    label: "Easy Run (30 min)",
    rationale: buildRationale("scheduled", evidence),
    reason_codes: determineReasonCodes("scheduled", evidence, isColdStart),
    caution_level: determineCautionLevel("scheduled", evidence),
  };

  // Lite alternative candidate
  const liteCandidate: RecommendationCandidate = {
    candidate_id: "lite_alternative",
    template_ref: "recovery-jog-20min",
    label: "Recovery Jog (20 min)",
    rationale: buildRationale("lite_alternative", evidence),
    reason_codes: determineReasonCodes("lite_alternative", evidence, isColdStart),
    caution_level: "none",
  };

  // Rest day candidate
  const restCandidate: RecommendationCandidate = {
    candidate_id: "rest_day",
    template_ref: null,
    label: "Rest Day",
    rationale: buildRationale("rest_day", evidence),
    reason_codes: determineReasonCodes("rest_day", evidence, isColdStart),
    caution_level: "none",
  };

  // Skip candidate
  const skipCandidate: RecommendationCandidate = {
    candidate_id: "skip",
    template_ref: null,
    label: "Skip Today",
    rationale: buildRationale("skip", evidence),
    reason_codes: determineReasonCodes("skip", evidence, isColdStart),
    caution_level: "none",
  };

  // Order candidates based on primary recommendation
  switch (primary) {
    case "workout":
      candidates.push(scheduledCandidate, liteCandidate, restCandidate, skipCandidate);
      break;
    case "lite":
      candidates.push(liteCandidate, scheduledCandidate, restCandidate, skipCandidate);
      break;
    case "rest":
      candidates.push(restCandidate, liteCandidate, scheduledCandidate, skipCandidate);
      break;
  }

  return candidates;
}

/**
 * Build full recommendation response.
 */
function buildRecommendationResponse(
  userId: string,
  date: string,
  generatedAt: string,
  evidence: CalculatedEvidence,
  data: UserDataSummary
): TodayRecommendationResponse {
  const ctx: RecommendationContext = { evidence, data, date };
  const candidates = buildCandidates(ctx);

  return {
    schema_version: SchemaVersion,
    recommendation_id: `${userId}:${date}`,
    date,
    user_id: userId,
    candidates,
    evidence: {
      fatigue_score: evidence.fatigue_score,
      fitness_score: evidence.fitness_score,
      hrv_trend: evidence.hrv_trend,
      sleep_quality: evidence.sleep_quality,
      days_since_rest: evidence.days_since_rest,
      confidence: evidence.confidence,
    },
    llm_used: false,
    generated_at: generatedAt,
  };
}

/**
 * Build cold-start response when no user ID is available.
 */
function buildColdStartResponse(
  date: string,
  generatedAt: string
): TodayRecommendationResponse {
  return {
    schema_version: SchemaVersion,
    recommendation_id: `anonymous:${date}`,
    date,
    user_id: "anonymous",
    candidates: [
      {
        candidate_id: "scheduled",
        template_ref: "easy-run-30min",
        label: "Easy Run (30 min)",
        rationale: "Start with a light session to build your baseline.",
        reason_codes: ["COLD_START", "INSUFFICIENT_DATA"],
        caution_level: "low",
      },
      {
        candidate_id: "lite_alternative",
        template_ref: "recovery-jog-20min",
        label: "Recovery Jog (20 min)",
        rationale: "A gentle option to ease into training.",
        reason_codes: ["COLD_START", "INSUFFICIENT_DATA"],
        caution_level: "none",
      },
      {
        candidate_id: "rest_day",
        template_ref: null,
        label: "Rest Day",
        rationale: "Rest is always a valid choice.",
        reason_codes: ["COLD_START", "REST_DAY_DUE"],
        caution_level: "none",
      },
      {
        candidate_id: "skip",
        template_ref: null,
        label: "Skip Today",
        rationale: "Skip if life gets in the way.",
        reason_codes: ["COLD_START", "USER_PREFERENCE"],
        caution_level: "none",
      },
    ],
    evidence: {
      fatigue_score: null,
      fitness_score: null,
      hrv_trend: null,
      sleep_quality: null,
      days_since_rest: null,
      confidence: 0.3,
    },
    llm_used: false,
    generated_at: generatedAt,
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
      res.status(200).json(buildColdStartResponse(date, generatedAt));
      return;
    }
  } else if (TEST_USER_ID) {
    userId = TEST_USER_ID;
  }

  if (!userId) {
    // No user ID available - return cold-start response
    console.log("No user ID available, returning cold-start response");
    res.status(200).json(buildColdStartResponse(date, generatedAt));
    return;
  }

  try {
    // Fetch user data from database
    console.log(`Fetching data for user ${userId}...`);
    const data = await getUserDataSummary(userId);

    console.log(
      `Found: ${data.hrv.length} HRV records, ${data.sleep.length} sleep records, ` +
        `${data.workouts.length} workouts, ${data.dailyMetrics.length} daily metrics`
    );

    // Calculate evidence from data
    const evidence = calculateEvidence(data);
    console.log("Calculated evidence:", evidence);

    // Build response
    const response = buildRecommendationResponse(
      userId,
      date,
      generatedAt,
      evidence,
      data
    );

    res.status(200).json(response);
  } catch (error) {
    console.error("Error building recommendation:", error);

    // Fall back to cold-start response on error
    res.status(200).json(buildColdStartResponse(date, generatedAt));
  }
}
