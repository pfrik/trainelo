/**
 * POST /api/user-flags
 * Vercel Serverless Function: Persists morning check-in data.
 *
 * Validates request → resolves user identity → upserts daily_checkins row → responds.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { upsertDailyCheckin } from "../src/lib/db/queries.js";

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

  res.status(200).json({ ok: true, recorded_at, date });
}
