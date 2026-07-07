import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runIntervalsSync } from "./intervalsSync.js";
import type { IntervalsWellness, IntervalsActivity } from "../core/intervals/types.js";

const USER_ID = "00000000-0000-0000-0000-000000000001";

interface RecordedWrite {
  table: string;
  op: "insert" | "update" | "upsert";
  row: Record<string, unknown>;
  onConflict?: string;
}

interface FakeStore {
  writes: RecordedWrite[];
  /** Existing rows keyed "table|source|source_ref" for existence checks. */
  existing: Set<string>;
  /** Rows returned for the hrv_nights history query. */
  hrvHistory: Array<{ date: string; hrv_rmssd: number; updated_at: string }>;
  /** When true, the time-overlap workout query finds a match. */
  hasOverlappingWorkout?: boolean;
}

/**
 * Minimal chainable/thenable stand-in for the supabase-js query builder,
 * covering the calls runIntervalsSync makes.
 */
function makeFakeSupabase(store: FakeStore): SupabaseClient {
  class FakeQuery {
    private op: "select" | "update" = "select";
    private row: Record<string, unknown> | null = null;
    private filters: Record<string, unknown> = {};
    private ranged = false;

    constructor(private table: string) {}

    select() { this.op = "select"; return this; }
    update(row: Record<string, unknown>) { this.op = "update"; this.row = row; return this; }
    eq(key: string, value: unknown) { this.filters[key] = value; return this; }
    neq() { return this; }
    gte() { this.ranged = true; return this; }
    lte() { this.ranged = true; return this; }
    order() { return this; }
    limit() { return this; }

    insert(row: Record<string, unknown>) {
      store.writes.push({ table: this.table, op: "insert", row });
      return Promise.resolve({ error: null });
    }

    upsert(row: Record<string, unknown>, opts?: { onConflict?: string }) {
      store.writes.push({ table: this.table, op: "upsert", row, onConflict: opts?.onConflict });
      return Promise.resolve({ error: null });
    }

    then(
      resolve: (value: { data: unknown; error: null }) => unknown,
      _reject?: (reason: unknown) => unknown,
    ) {
      if (this.op === "update") {
        store.writes.push({ table: this.table, op: "update", row: this.row ?? {} });
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      // History query (date-ranged select on hrv_nights)
      if (this.table === "hrv_nights" && this.ranged) {
        return Promise.resolve({ data: store.hrvHistory, error: null }).then(resolve);
      }
      // Time-overlap workout query (started_at-ranged select on workouts)
      if (this.table === "workouts" && this.ranged) {
        const data = store.hasOverlappingWorkout ? [{ id: "overlap-row" }] : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      }
      // Existence check keyed on source + source_ref
      const key = `${this.table}|${String(this.filters.source)}|${String(this.filters.source_ref)}`;
      const data = store.existing.has(key) ? [{ id: "existing-row" }] : [];
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  }

  return {
    from: (table: string) => new FakeQuery(table),
  } as unknown as SupabaseClient;
}

function makeFetchStub(
  wellness: IntervalsWellness[],
  activities: IntervalsActivity[],
): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/wellness") ? wellness : activities;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

const WELLNESS_DAY: IntervalsWellness = {
  id: "2026-07-05",
  restingHR: 59,
  hrv: 35,
  sleepSecs: 29280,
  sleepScore: 81,
  steps: 5502,
};

const GARMIN_ACTIVITY: IntervalsActivity = {
  id: "i161742359",
  external_id: "23440166400",
  source: "GARMIN_CONNECT",
  type: "Swim",
  name: "Pool Swim",
  start_date: "2026-07-01T09:33:58Z",
  moving_time: 1751,
  elapsed_time: 3512,
  icu_training_load: 16,
};

function runSync(store: FakeStore, wellness: IntervalsWellness[], activities: IntervalsActivity[]) {
  return runIntervalsSync({
    supabase: makeFakeSupabase(store),
    athleteId: "i99999",
    apiKey: "test-key",
    userId: USER_ID,
    oldest: "2026-07-03",
    newest: "2026-07-05",
    fetchImpl: makeFetchStub(wellness, activities),
  });
}

function emptyStore(): FakeStore {
  return { writes: [], existing: new Set(), hrvHistory: [] };
}

describe("runIntervalsSync", () => {
  it("fans a wellness day out to all four tables plus sync_state", async () => {
    const store = emptyStore();
    const stats = await runSync(store, [WELLNESS_DAY], []);

    expect(stats.errors).toEqual([]);
    expect(stats.wellness).toMatchObject({ fetched: 1, upserted: 1 });

    const tables = store.writes.map((w) => w.table);
    expect(tables).toContain("canonical_daily_metrics");
    expect(tables).toContain("hrv_nights");
    expect(tables).toContain("sleep_sessions");
    expect(tables).toContain("daily_metrics");
    // sync_state written once per section (wellness + activities)
    expect(tables.filter((t) => t === "sync_state")).toHaveLength(2);
  });

  it("computes the HRV baseline from existing DB history", async () => {
    const store = emptyStore();
    store.hrvHistory = [
      { date: "2026-06-28", hrv_rmssd: 50, updated_at: "2026-06-28T08:00:00Z" },
      { date: "2026-06-30", hrv_rmssd: 52, updated_at: "2026-06-30T08:00:00Z" },
      { date: "2026-07-02", hrv_rmssd: 54, updated_at: "2026-07-02T08:00:00Z" },
    ];
    await runSync(store, [WELLNESS_DAY], []);

    const hrvWrite = store.writes.find((w) => w.table === "hrv_nights");
    expect(hrvWrite?.row).toMatchObject({
      hrv_rmssd: 35,
      hrv_baseline: 52, // mean(50, 52, 54) from scraper-era rows
      hrv_status: "low",
    });
  });

  it("skips activities the Garmin scraper already synced", async () => {
    const store = emptyStore();
    store.existing.add("workouts|garmin|23440166400");
    const stats = await runSync(store, [], [GARMIN_ACTIVITY]);

    expect(stats.activities).toMatchObject({ fetched: 1, upserted: 0, deduped: 1 });
    expect(store.writes.filter((w) => w.table === "workouts")).toHaveLength(0);
  });

  it("inserts new activities under the intervals_icu source", async () => {
    const store = emptyStore();
    const stats = await runSync(store, [], [GARMIN_ACTIVITY]);

    expect(stats.activities).toMatchObject({ fetched: 1, upserted: 1, deduped: 0 });
    const write = store.writes.find((w) => w.table === "workouts");
    expect(write?.op).toBe("insert");
    expect(write?.row).toMatchObject({
      source: "intervals_icu",
      source_ref: "i161742359",
      activity_type: "swim_pool",
      training_stress_score: 16,
    });
  });

  it("skips new activities overlapping a workout from another source", async () => {
    const store = emptyStore();
    store.hasOverlappingWorkout = true;
    // Dropbox-sourced ride: no Garmin ref, but a garmin workout started
    // at the same moment (same session via a different upload path)
    const dropboxRide: IntervalsActivity = {
      ...GARMIN_ACTIVITY,
      id: "i-dropbox",
      source: "DROPBOX",
      external_id: "ride.fit",
    };
    const stats = await runSync(store, [], [dropboxRide]);

    expect(stats.activities).toMatchObject({ fetched: 1, upserted: 0, deduped: 1 });
    expect(store.writes.filter((w) => w.table === "workouts")).toHaveLength(0);
  });

  it("still updates an existing intervals row despite an overlapping workout", async () => {
    const store = emptyStore();
    store.hasOverlappingWorkout = true;
    store.existing.add("workouts|intervals_icu|i161742359");
    const stats = await runSync(store, [], [GARMIN_ACTIVITY]);

    expect(stats.activities).toMatchObject({ upserted: 1, deduped: 0 });
    expect(store.writes.find((w) => w.table === "workouts")?.op).toBe("update");
  });

  it("updates in place when the intervals row already exists", async () => {
    const store = emptyStore();
    store.existing.add("workouts|intervals_icu|i161742359");
    const stats = await runSync(store, [], [GARMIN_ACTIVITY]);

    expect(stats.activities).toMatchObject({ upserted: 1 });
    const write = store.writes.find((w) => w.table === "workouts");
    expect(write?.op).toBe("update");
  });

  it("records per-record errors without aborting the run", async () => {
    const store = emptyStore();
    const badActivity = { ...GARMIN_ACTIVITY, id: "i-broken", start_date: null };
    const stats = await runSync(store, [], [badActivity, GARMIN_ACTIVITY]);

    expect(stats.activities).toMatchObject({ fetched: 2, upserted: 1, skipped: 1 });
    expect(stats.errors).toHaveLength(1);
    expect(stats.errors[0]).toContain("i-broken");
  });

  it("writes nothing in dry-run mode", async () => {
    const store = emptyStore();
    const stats = await runIntervalsSync({
      supabase: makeFakeSupabase(store),
      athleteId: "i99999",
      apiKey: "test-key",
      userId: USER_ID,
      oldest: "2026-07-03",
      newest: "2026-07-05",
      dryRun: true,
      fetchImpl: makeFetchStub([WELLNESS_DAY], [GARMIN_ACTIVITY]),
    });

    expect(store.writes).toHaveLength(0);
    expect(stats.wellness.upserted).toBe(1);
    expect(stats.activities.upserted).toBe(1);
  });
});
