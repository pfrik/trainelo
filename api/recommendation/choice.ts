/**
 * POST /api/recommendation/choice
 * Vercel Serverless Function: Records user's choice on a recommendation.
 *
 * Validates request → resolves user identity → persists to recommendation_events → responds.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ChoiceRequestSchema } from "../../src/lib/core/contracts/index.js";
import { createLogger, generateRequestId } from "../../src/lib/core/observability/log.js";

const authLog = createLogger("choice/auth");
import { buildChoiceResponse } from "../../src/lib/core/recommendation/choiceResponseBuilder.js";
import { insertRecommendationEvent } from "../../src/lib/db/queries.js";

// ============================================================================
// Configuration
// ============================================================================

let authClient: SupabaseClient | null = null;
let authClientConfig: { supabaseUrl: string; supabaseKey: string } | null = null;

// ============================================================================
// Auth Helpers (same pattern as today.ts)
// ============================================================================

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
    authLog.warn("supabase client init failed", {
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
    authLog.warn("no valid supabaseUrl candidate");
    return null;
  }

  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey =
    cleanEnvValue(process.env.SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
  const supabaseKey = anonKey || serviceRoleKey;

  if (!supabaseKey) {
    authLog.warn("missing supabase key for token verification");
    return null;
  }

  const client = getAuthClient(supabaseUrl, supabaseKey);
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    authLog.warn("auth token verification failed", {
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
  res: VercelResponse
): Promise<void> {
  const log = createLogger("choice", generateRequestId());

  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Parse body robustly
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

  // Validate request body
  const parseResult = ChoiceRequestSchema.safeParse(body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "INVALID_REQUEST",
      details: parseResult.error.flatten(),
    });
    return;
  }

  const choiceRequest = parseResult.data;

  // Resolve user identity
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

  // Persist choice
  const recorded_at = new Date().toISOString();

  const result = await insertRecommendationEvent({
    user_id: userId,
    recommendation_id: choiceRequest.recommendation_id,
    chosen_candidate_id: choiceRequest.chosen_candidate_id,
    action: choiceRequest.action,
    note: choiceRequest.note ?? null,
    recorded_at,
  });

  if (!result.success) {
    log.error("persistence failed", { error: result.error });
    res.status(500).json({ error: "PERSISTENCE_FAILED" });
    return;
  }

  log.info(result.duplicate ? "duplicate choice (idempotent)" : "choice recorded", {
    user_id: userId,
    recommendation_id: choiceRequest.recommendation_id,
    candidate: choiceRequest.chosen_candidate_id,
    action: choiceRequest.action,
  });

  res.status(200).json(buildChoiceResponse({ recorded_at }));
}
