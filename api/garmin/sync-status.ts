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
import { createLogger, generateRequestId } from "../../src/lib/core/observability/log.js";

import { cleanEnvValue, resolveUserId } from "../../src/lib/api/resolveUser.js";

// ============================================================================
// ============================================================================
// Handler
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const log = createLogger("garmin/sync-status", generateRequestId());

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
    log.error("sync status failed", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
}
