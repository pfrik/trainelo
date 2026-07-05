/**
 * intervals.icu → Supabase sync.
 *
 * Pulls wellness days and activities from the intervals.icu API and upserts
 * them into the canonical tables (canonical_daily_metrics, sleep_sessions,
 * hrv_nights, workouts) plus the MVP daily_metrics table, mirroring what the
 * local Garmin scraper writes.
 *
 * Cross-source dedupe: activities that reached intervals.icu via the official
 * Garmin integration carry the Garmin activity ID in external_id. When a
 * workouts row with source='garmin' and that source_ref already exists (from
 * the scraper), the activity is skipped so daily_training_load never counts
 * the same session twice.
 *
 * Shared by api/cron/intervals-sync.ts (Vercel cron) and
 * scripts/intervals-backfill.ts (local runs).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  transformWellness,
  shiftDate,
  INTERVALS_SOURCE,
  INTERVALS_SCHEMA_VERSION,
  type HrvHistoryEntry,
} from "../core/intervals/transformWellness.js";
import {
  transformActivity,
  getGarminSourceRef,
} from "../core/intervals/transformActivity.js";
import type {
  IntervalsWellness,
  IntervalsActivity,
} from "../core/intervals/types.js";

const INTERVALS_API_BASE = "https://intervals.icu/api/v1";
const HRV_CONTEXT_LOOKBACK_DAYS = 28;
const GARMIN_SOURCE = "garmin";

export interface IntervalsSyncConfig {
  supabase: SupabaseClient;
  athleteId: string;
  apiKey: string;
  userId: string;
  /** Inclusive date range, YYYY-MM-DD. */
  oldest: string;
  newest: string;
  dryRun?: boolean;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  log?: (message: string, context?: Record<string, unknown>) => void;
}

export interface SyncSectionStats {
  fetched: number;
  upserted: number;
  /** Records skipped because the Garmin scraper already synced them. */
  deduped: number;
  skipped: number;
}

export interface IntervalsSyncStats {
  wellness: SyncSectionStats;
  activities: SyncSectionStats;
  errors: string[];
}

function emptySection(): SyncSectionStats {
  return { fetched: 0, upserted: 0, deduped: 0, skipped: 0 };
}

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
}

async function fetchIntervals<T>(
  fetchImpl: typeof fetch,
  apiKey: string,
  path: string,
): Promise<T> {
  const response = await fetchImpl(`${INTERVALS_API_BASE}${path}`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 200);
    throw new Error(`intervals.icu ${path} → HTTP ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
}

/** True when a row with this (user, source, source_ref) already exists. */
async function recordExists(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  source: string,
  sourceRef: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_ref", sourceRef)
    .limit(1);
  if (error) throw new Error(`${table} exists check failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Upsert keyed on (user_id, source, source_ref) for tables whose partial
 * unique index PostgREST can't target with ON CONFLICT (workouts,
 * sleep_sessions) — same check-then-write approach as the Garmin scraper.
 */
async function upsertBySourceRef(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  row: Record<string, unknown>,
): Promise<void> {
  const sourceRef = String(row.source_ref);
  const exists = await recordExists(supabase, table, userId, INTERVALS_SOURCE, sourceRef);
  if (exists) {
    const { error } = await supabase
      .from(table)
      .update(row)
      .eq("user_id", userId)
      .eq("source", INTERVALS_SOURCE)
      .eq("source_ref", sourceRef);
    if (error) throw new Error(`${table} update ${sourceRef} failed: ${error.message}`);
  } else {
    const { error } = await supabase.from(table).insert(row);
    if (error) throw new Error(`${table} insert ${sourceRef} failed: ${error.message}`);
  }
}

async function upsertOnConflict(
  supabase: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  onConflict: string,
): Promise<void> {
  const { error } = await supabase.from(table).upsert(row, { onConflict });
  if (error) {
    throw new Error(`${table} upsert ${String(row.source_ref ?? row.date)} failed: ${error.message}`);
  }
}

/**
 * Nightly rMSSD per date from existing hrv_nights rows (any source), so
 * intervals-sourced baselines stay continuous with scraper-era history.
 */
async function loadHrvContext(
  supabase: SupabaseClient,
  userId: string,
  oldest: string,
  newest: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("hrv_nights")
    .select("date, hrv_rmssd, updated_at")
    .eq("user_id", userId)
    .gte("date", shiftDate(oldest, -HRV_CONTEXT_LOOKBACK_DAYS))
    .lte("date", newest)
    .order("date", { ascending: true })
    .order("updated_at", { ascending: true });
  if (error) throw new Error(`hrv_nights history query failed: ${error.message}`);

  const byDate = new Map<string, number>();
  for (const row of data ?? []) {
    const value = Number(row.hrv_rmssd);
    if (Number.isFinite(value) && value > 0) {
      byDate.set(row.date, value); // ordered by updated_at — latest row wins
    }
  }
  return byDate;
}

async function writeSyncState(
  supabase: SupabaseClient,
  userId: string,
  dataType: string,
  newest: string,
  stats: SyncSectionStats,
  durationMs: number,
  errorMessage: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    user_id: userId,
    provider: INTERVALS_SOURCE,
    source: INTERVALS_SOURCE,
    data_type: dataType,
    last_sync_date: newest,
    last_sync_timestamp: now,
    last_sync_completed_at: errorMessage ? null : now,
    sync_status: errorMessage ? "failed" : "completed",
    last_sync_records_fetched: stats.fetched,
    last_sync_records_created: stats.upserted,
    last_sync_records_updated: 0,
    last_sync_records_skipped: stats.deduped + stats.skipped,
    last_sync_duration_ms: durationMs,
    updated_at: now,
    schema_version: INTERVALS_SCHEMA_VERSION,
  };
  if (errorMessage) {
    row.last_error_message = errorMessage.slice(0, 500);
    row.last_error_at = now;
  }
  const { error } = await supabase
    .from("sync_state")
    .upsert(row, { onConflict: "user_id,provider,data_type" });
  if (error) throw new Error(`sync_state upsert failed: ${error.message}`);
}

export async function runIntervalsSync(
  config: IntervalsSyncConfig,
): Promise<IntervalsSyncStats> {
  const {
    supabase,
    athleteId,
    apiKey,
    userId,
    oldest,
    newest,
    dryRun = false,
    fetchImpl = fetch,
    log = () => {},
  } = config;

  const stats: IntervalsSyncStats = {
    wellness: emptySection(),
    activities: emptySection(),
    errors: [],
  };

  // --- Wellness ------------------------------------------------------------
  const wellnessStart = Date.now();
  let wellnessError: string | null = null;
  try {
    const wellness = await fetchIntervals<IntervalsWellness[]>(
      fetchImpl,
      apiKey,
      `/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`,
    );
    stats.wellness.fetched = wellness.length;
    log("wellness fetched", { count: wellness.length, oldest, newest });

    const hrvContext = dryRun
      ? new Map<string, number>()
      : await loadHrvContext(supabase, userId, oldest, newest);

    // Ascending so each day's HRV baseline sees the days synced before it
    wellness.sort((a, b) => a.id.localeCompare(b.id));

    for (const day of wellness) {
      try {
        const history: HrvHistoryEntry[] = Array.from(
          hrvContext,
          ([date, hrv_rmssd]) => ({ date, hrv_rmssd }),
        );
        const rows = transformWellness(day, userId, history);

        const hasAnyRow =
          rows.dailyMetrics || rows.sleepSession || rows.hrvNight || rows.dailyMetricsMvp;
        if (!hasAnyRow) {
          stats.wellness.skipped++;
          continue;
        }

        if (dryRun) {
          log("would upsert wellness", { date: day.id });
          stats.wellness.upserted++;
          continue;
        }

        if (rows.dailyMetrics) {
          await upsertOnConflict(
            supabase, "canonical_daily_metrics", rows.dailyMetrics, "user_id,date,source",
          );
        }
        if (rows.hrvNight) {
          await upsertOnConflict(supabase, "hrv_nights", rows.hrvNight, "user_id,date,source");
        }
        if (rows.sleepSession) {
          await upsertBySourceRef(supabase, "sleep_sessions", userId, rows.sleepSession);
        }
        if (rows.dailyMetricsMvp) {
          await upsertOnConflict(supabase, "daily_metrics", rows.dailyMetricsMvp, "user_id,date");
        }

        if (typeof day.hrv === "number" && day.hrv > 0) {
          hrvContext.set(day.id, day.hrv);
        }
        stats.wellness.upserted++;
        log("wellness synced", { date: day.id });
      } catch (err) {
        stats.wellness.skipped++;
        stats.errors.push(`wellness ${day.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    wellnessError = err instanceof Error ? err.message : String(err);
    stats.errors.push(`wellness: ${wellnessError}`);
  }
  if (!dryRun) {
    try {
      await writeSyncState(
        supabase, userId, "wellness", newest, stats.wellness,
        Date.now() - wellnessStart, wellnessError ?? null,
      );
    } catch (err) {
      stats.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  // --- Activities ------------------------------------------------------------
  const activitiesStart = Date.now();
  let activitiesError: string | null = null;
  try {
    const activities = await fetchIntervals<IntervalsActivity[]>(
      fetchImpl,
      apiKey,
      `/athlete/${athleteId}/activities?oldest=${oldest}T00:00:00&newest=${newest}T23:59:59`,
    );
    stats.activities.fetched = activities.length;
    log("activities fetched", { count: activities.length, oldest, newest });

    for (const activity of activities) {
      try {
        const row = transformActivity(activity, userId);

        const garminRef = getGarminSourceRef(activity);
        if (
          garminRef &&
          !dryRun &&
          (await recordExists(supabase, "workouts", userId, GARMIN_SOURCE, garminRef))
        ) {
          stats.activities.deduped++;
          log("activity deduped against garmin row", { id: activity.id, garmin_ref: garminRef });
          continue;
        }

        if (dryRun) {
          log("would upsert activity", { id: activity.id, title: row.title });
          stats.activities.upserted++;
          continue;
        }

        await upsertBySourceRef(supabase, "workouts", userId, row);
        stats.activities.upserted++;
        log("activity synced", { id: activity.id, title: row.title });
      } catch (err) {
        stats.activities.skipped++;
        stats.errors.push(
          `activity ${activity.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    activitiesError = err instanceof Error ? err.message : String(err);
    stats.errors.push(`activities: ${activitiesError}`);
  }
  if (!dryRun) {
    try {
      await writeSyncState(
        supabase, userId, "activities", newest, stats.activities,
        Date.now() - activitiesStart, activitiesError ?? null,
      );
    } catch (err) {
      stats.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return stats;
}
