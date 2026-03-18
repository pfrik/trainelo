/**
 * GET /api/garmin/sync-status
 *
 * Returns Garmin integration connection status and per-data-type sync state.
 *
 * Authentication: Bearer token (same as /api/recommendation/today)
 *
 * Response:
 *   {
 *     connected: boolean,
 *     provider: "garmin",
 *     last_connected_at: string | null,
 *     sync_types: Array<{ data_type, last_synced_at, record_count, status }>,
 *     data_freshness_hours: number | null
 *   }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getSyncStatuses,
} from "../../src/lib/db/queries.js";

// ============================================================================
// Auth helpers (same pattern as recommendation/today)
// ============================================================================

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
    const seg = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = seg + "=".repeat((4 - (seg.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { iss?: unknown };
    const issuer = typeof payload?.iss === "string" ? payload.iss : null;
    if (!issuer) return null;
    if (issuer.endsWith("/auth/v1")) return issuer.slice(0, -"/auth/v1".length);
    return new URL(issuer).origin;
  } catch {
    return null;
  }
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let authClient: SupabaseClient | null = null;
let authClientConfig: { url: string; key: string } | null = null;

function getAuthClient(url: string, key: string): SupabaseClient | null {
  if (authClient && authClientConfig?.url === url && authClientConfig?.key === key) {
    return authClient;
  }
  try {
    authClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    authClientConfig = { url, key };
    return authClient;
  } catch {
    return null;
  }
}

async function resolveUserId(authHeader: string): Promise<string | null> {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];

  const inferred = inferSupabaseBaseUrlFromJwt(token);
  let supabaseUrl = inferred ? tryParseUrl(inferred) : null;

  if (!supabaseUrl) {
    for (const env of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL"]) {
      const v = cleanEnvValue(process.env[env]);
      if (v) { supabaseUrl = tryParseUrl(v); if (supabaseUrl) break; }
    }
  }
  if (!supabaseUrl) return null;

  const key =
    cleanEnvValue(process.env.SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) return null;

  const client = getAuthClient(supabaseUrl, key);
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
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Resolve user
  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader) {
    userId = await resolveUserId(authHeader);
  } else if (cleanEnvValue(process.env.TRAINELO_USER_ID)) {
    userId = cleanEnvValue(process.env.TRAINELO_USER_ID);
  }

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const syncRows = await getSyncStatuses(userId);

    // Derive connection status from sync_state rows
    // (integration_connections isn't written by the sync script)
    let mostRecentSync: string | null = null;
    if (syncRows.length > 0) {
      mostRecentSync = syncRows.reduce((latest, row) => {
        if (!row.last_sync_completed_at) return latest;
        if (!latest) return row.last_sync_completed_at;
        return row.last_sync_completed_at > latest ? row.last_sync_completed_at : latest;
      }, null as string | null);
    }

    // Calculate data freshness: hours since most recent sync across all types
    let dataFreshnessHours: number | null = null;
    if (mostRecentSync) {
      const diffMs = Date.now() - new Date(mostRecentSync).getTime();
      dataFreshnessHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    }

    const connected = syncRows.length > 0 && mostRecentSync !== null;

    res.status(200).json({
      connected,
      provider: "garmin",
      last_synced_at: mostRecentSync,
      sync_types: syncRows.map((r) => ({
        data_type: r.data_type,
        last_synced_at: r.last_sync_completed_at,
        record_count: r.last_sync_records_fetched,
        status: r.sync_status,
      })),
      data_freshness_hours: dataFreshnessHours,
    });
  } catch (err) {
    console.error("[sync-status] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
