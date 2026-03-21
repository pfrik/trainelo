/**
 * POST /api/calibration/lock
 * Vercel Serverless Function: Lock or unlock a user threshold.
 *
 * When locked, the threshold cannot be auto-updated by the passive calibration
 * engine. The user can optionally set an expiration (lock_until) after which
 * the lock auto-expires.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  getUserThreshold,
  updateUserThresholdLock,
  insertCalibrationEvent,
} from "../../src/lib/db/queries.js";

// ============================================================================
// Request Schema
// ============================================================================

const LockRequestSchema = z.object({
  /** UUID of the threshold to lock/unlock. */
  threshold_id: z.string().uuid(),
  /** true = lock, false = unlock. Defaults to true. */
  lock: z.boolean().optional().default(true),
  /** Optional lock expiration (ISO 8601 datetime). Ignored when unlocking. */
  lock_until: z.string().datetime().optional(),
  /** Optional reason for the lock/unlock. */
  reason: z.string().max(500).optional(),
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
  try { return new URL(u).toString(); } catch { return null; }
}

function inferSupabaseBaseUrlFromJwt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { iss?: unknown };
    const issuer = typeof payload?.iss === "string" ? payload.iss : null;
    if (!issuer) return null;
    if (issuer.endsWith("/auth/v1")) return issuer.slice(0, -"/auth/v1".length);
    return new URL(issuer).origin;
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

function extractBearerToken(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function resolveUserIdFromAuthHeader(authHeader: string): Promise<string | null> {
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  const inferredParsedUrl = (() => {
    const base = inferSupabaseBaseUrlFromJwt(token);
    return base ? tryParseUrl(base) : null;
  })();
  let supabaseUrl: string | null = inferredParsedUrl;

  if (!supabaseUrl) {
    for (const candidate of [
      cleanEnvValue(process.env.SUPABASE_URL),
      cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
      cleanEnvValue(process.env.VITE_SUPABASE_URL),
    ]) {
      if (!candidate) continue;
      const parsed = tryParseUrl(candidate);
      if (parsed) { supabaseUrl = parsed; break; }
    }
  }
  if (!supabaseUrl) return null;

  const supabaseKey =
    cleanEnvValue(process.env.SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseKey) return null;

  const client = getAuthClient(supabaseUrl, supabaseKey);
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
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
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "INVALID_REQUEST", details: "Invalid JSON" });
    return;
  }

  const parseResult = LockRequestSchema.safeParse(body);
  if (!parseResult.success) {
    res.status(400).json({ error: "INVALID_REQUEST", details: parseResult.error.flatten() });
    return;
  }

  const { threshold_id, lock, lock_until, reason } = parseResult.data;

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

  try {
    const now = new Date().toISOString();

    // 1. Fetch the threshold (active, scoped to user)
    const thresholdRes = await getUserThreshold(userId, threshold_id);
    if (thresholdRes.error) {
      res.status(500).json({ error: "DB_ERROR", details: thresholdRes.error });
      return;
    }
    if (!thresholdRes.data) {
      res.status(404).json({ error: "THRESHOLD_NOT_FOUND", details: "No active threshold found with this ID." });
      return;
    }

    const threshold = thresholdRes.data;

    // 2. Check idempotency
    if (lock && threshold.is_locked) {
      // Already locked — return success without re-locking
      res.status(200).json({
        ok: true,
        threshold_id: threshold.id,
        threshold_type: threshold.threshold_type,
        is_locked: true,
        locked_at: threshold.locked_at,
        lock_expires_at: threshold.lock_expires_at,
        already_locked: true,
      });
      return;
    }
    if (!lock && !threshold.is_locked) {
      // Already unlocked — return success
      res.status(200).json({
        ok: true,
        threshold_id: threshold.id,
        threshold_type: threshold.threshold_type,
        is_locked: false,
        locked_at: null,
        lock_expires_at: null,
        already_unlocked: true,
      });
      return;
    }

    // 3. Update the threshold
    const updateRes = await updateUserThresholdLock(threshold_id, {
      is_locked: lock,
      locked_at: lock ? now : null,
      locked_reason: lock ? (reason ?? null) : null,
      lock_expires_at: lock ? (lock_until ?? null) : null,
    });

    if (updateRes.error) {
      res.status(500).json({ error: "DB_ERROR", details: updateRes.error });
      return;
    }

    // 4. Append audit event
    const eventType = lock ? "threshold_locked" : "threshold_unlocked";
    const auditRes = await insertCalibrationEvent({
      user_id: userId,
      event_type: eventType,
      threshold_id: threshold.id,
      threshold_type: threshold.threshold_type,
      previous_value: { is_locked: !lock },
      new_value: { is_locked: lock, lock_expires_at: lock ? (lock_until ?? null) : null },
      change_reason: reason ?? `User ${lock ? "locked" : "unlocked"} threshold`,
      change_trigger: "user_request",
      actor_type: "user",
      actor_id: userId,
    });

    if (auditRes.error) {
      // Non-fatal: lock was applied, audit failed
      console.warn("[lock] Audit event insert failed (non-fatal):", auditRes.error);
    }

    console.log(
      `[lock] user=${userId} threshold=${threshold_id} ` +
        `type=${threshold.threshold_type} lock=${lock} expires=${lock_until ?? "never"}`,
    );

    res.status(200).json({
      ok: true,
      event_id: auditRes.data?.id ?? null,
      threshold_id: threshold.id,
      threshold_type: threshold.threshold_type,
      is_locked: lock,
      locked_at: lock ? now : null,
      lock_expires_at: lock ? (lock_until ?? null) : null,
    });
  } catch (error) {
    console.error("[lock] Error:", error);
    res.status(500).json({ error: "LOCK_FAILED" });
  }
}
