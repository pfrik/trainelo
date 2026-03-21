/**
 * POST /api/calibration/undo
 * Vercel Serverless Function: Undo a calibration change.
 *
 * Validates the event is undoable (owned by user, not expired, not already undone),
 * restores the previous threshold value, appends an undo_request event, and
 * starts a cooldown period to prevent immediate re-calibration.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLogger, generateRequestId } from "../../src/lib/core/observability/log.js";
import {
  getCalibrationEvent,
  markCalibrationEventUndone,
  insertCalibrationEvent,
  restoreThresholdValue,
} from "../../src/lib/db/queries.js";

// ============================================================================
// Request Schema
// ============================================================================

const UndoRequestSchema = z.object({
  /** UUID of the calibration event to undo. */
  calibration_event_id: z.string().uuid(),
  /** Optional reason for the undo. */
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
// Constants
// ============================================================================

/** Cooldown period after undo — prevent auto-recalibration for 7 days. */
const COOLDOWN_DAYS = 7;

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

  const parseResult = UndoRequestSchema.safeParse(body);
  if (!parseResult.success) {
    res.status(400).json({ error: "INVALID_REQUEST", details: parseResult.error.flatten() });
    return;
  }

  const { calibration_event_id, reason } = parseResult.data;

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

  const log = createLogger("calibration/undo", generateRequestId());

  try {
    const now = new Date().toISOString();

    // 1. Fetch the event (scoped to user)
    const eventRes = await getCalibrationEvent(userId, calibration_event_id);
    if (eventRes.error) {
      res.status(500).json({ error: "DB_ERROR", details: eventRes.error });
      return;
    }
    if (!eventRes.data) {
      res.status(404).json({ error: "EVENT_NOT_FOUND" });
      return;
    }

    const event = eventRes.data;

    // 2. Validate undo eligibility
    if (!event.is_undoable) {
      res.status(400).json({ error: "NOT_UNDOABLE", details: "This event is not marked as undoable." });
      return;
    }
    if (event.was_undone) {
      res.status(400).json({ error: "ALREADY_UNDONE", details: "This event has already been undone." });
      return;
    }
    if (event.undo_deadline && new Date(event.undo_deadline) < new Date(now)) {
      res.status(400).json({ error: "UNDO_EXPIRED", details: "The undo deadline has passed." });
      return;
    }

    // 3. Restore threshold if the event references one and has previous_value
    let restoredThresholdId: string | null = null;
    if (event.threshold_id && event.previous_value) {
      const restoreRes = await restoreThresholdValue(
        userId,
        event.threshold_id,
        event.previous_value,
        now,
      );
      if (restoreRes.error) {
        log.warn("threshold restore failed (non-fatal)", { error: restoreRes.error });
      } else {
        restoredThresholdId = restoreRes.data?.id ?? null;
      }
    }

    // 4. Mark original event as undone
    const markRes = await markCalibrationEventUndone(calibration_event_id, now);
    if (markRes.error) {
      res.status(500).json({ error: "DB_ERROR", details: markRes.error });
      return;
    }

    // 5. Insert undo event with cooldown
    const cooldownEndsAt = new Date(now);
    cooldownEndsAt.setDate(cooldownEndsAt.getDate() + COOLDOWN_DAYS);

    const undoEventRes = await insertCalibrationEvent({
      user_id: userId,
      event_type: "undo_request",
      threshold_id: restoredThresholdId ?? event.threshold_id,
      threshold_type: event.threshold_type,
      previous_value: event.new_value,
      new_value: event.previous_value,
      change_reason: reason ?? "User initiated undo",
      change_trigger: "user_request",
      undo_event_id: calibration_event_id,
      cooldown_ends_at: cooldownEndsAt.toISOString(),
      cooldown_reason: "post_undo_cooldown",
      actor_type: "user",
      actor_id: userId,
      notes: reason ?? null,
    });

    if (undoEventRes.error) {
      res.status(500).json({ error: "DB_ERROR", details: undoEventRes.error });
      return;
    }

    log.info("undo complete", {
      user_id: userId,
      event_id: calibration_event_id,
      threshold_type: event.threshold_type,
      cooldown_until: cooldownEndsAt.toISOString(),
    });

    res.status(200).json({
      ok: true,
      undo_event_id: undoEventRes.data?.id ?? null,
      original_event_id: calibration_event_id,
      threshold_type: event.threshold_type,
      restored_threshold_id: restoredThresholdId,
      cooldown_ends_at: cooldownEndsAt.toISOString(),
    });
  } catch (error) {
    log.error("undo failed", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: "UNDO_FAILED" });
  }
}
