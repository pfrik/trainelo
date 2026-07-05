import { describe, it, expect } from "vitest";
import {
  transformWellness,
  computeHrvBaseline,
  computeHrvWeeklyAvg,
  shiftDate,
  INTERVALS_SOURCE,
  type HrvHistoryEntry,
} from "./transformWellness.js";
import type { IntervalsWellness } from "./types.js";

const USER_ID = "00000000-0000-0000-0000-000000000001";

/** Real wellness shape captured from the intervals.icu API (2026-07-03). */
function makeFullWellness(overrides: Partial<IntervalsWellness> = {}): IntervalsWellness {
  return {
    id: "2026-07-03",
    ctl: 48.179146,
    atl: 39.88687,
    updated: "2026-07-03T23:13:00.207+00:00",
    weight: null,
    restingHR: 52,
    hrv: 48,
    hrvSDNN: null,
    sleepSecs: 26520,
    sleepScore: 81,
    sleepQuality: 2,
    avgSleepingHR: null,
    spO2: null,
    steps: 9589,
    respiration: null,
    ...overrides,
  };
}

function makeHistory(entries: Array<[string, number]>): HrvHistoryEntry[] {
  return entries.map(([date, hrv_rmssd]) => ({ date, hrv_rmssd }));
}

describe("shiftDate", () => {
  it("shifts across month boundaries", () => {
    expect(shiftDate("2026-07-03", -28)).toBe("2026-06-05");
    expect(shiftDate("2026-07-03", -1)).toBe("2026-07-02");
  });
});

describe("computeHrvBaseline", () => {
  it("averages the trailing 28 days excluding the current date", () => {
    const history = makeHistory([
      ["2026-07-01", 50],
      ["2026-07-02", 52],
      ["2026-06-30", 54],
      ["2026-07-03", 999], // current date — must be excluded
    ]);
    expect(computeHrvBaseline("2026-07-03", history)).toBe(52);
  });

  it("returns null with fewer than 3 trailing readings", () => {
    const history = makeHistory([
      ["2026-07-01", 50],
      ["2026-07-02", 52],
    ]);
    expect(computeHrvBaseline("2026-07-03", history)).toBeNull();
  });

  it("ignores readings older than 28 days", () => {
    const history = makeHistory([
      ["2026-06-04", 100], // outside window (2026-06-05 .. 2026-07-02)
      ["2026-06-05", 50],
      ["2026-06-10", 52],
      ["2026-07-02", 54],
    ]);
    expect(computeHrvBaseline("2026-07-03", history)).toBe(52);
  });
});

describe("computeHrvWeeklyAvg", () => {
  it("averages the trailing 7 days including the current night", () => {
    const history = makeHistory([
      ["2026-06-26", 999], // outside 7-day window (2026-06-27 .. 2026-07-02)
      ["2026-06-27", 40],
      ["2026-07-02", 50],
    ]);
    expect(computeHrvWeeklyAvg("2026-07-03", history, 60)).toBe(50);
  });

  it("falls back to the current value alone with no history", () => {
    expect(computeHrvWeeklyAvg("2026-07-03", [], 48)).toBe(48);
  });
});

describe("transformWellness", () => {
  const history = makeHistory([
    ["2026-06-28", 50],
    ["2026-06-30", 52],
    ["2026-07-02", 54],
  ]);

  it("fans a full wellness day out to all four rows", () => {
    const result = transformWellness(makeFullWellness(), USER_ID, history);
    expect(result.dailyMetrics).not.toBeNull();
    expect(result.sleepSession).not.toBeNull();
    expect(result.hrvNight).not.toBeNull();
    expect(result.dailyMetricsMvp).not.toBeNull();
  });

  it("maps canonical_daily_metrics fields", () => {
    const result = transformWellness(makeFullWellness(), USER_ID, history);
    expect(result.dailyMetrics).toMatchObject({
      user_id: USER_ID,
      source: INTERVALS_SOURCE,
      source_ref: "daily_2026-07-03",
      date: "2026-07-03",
      steps: 9589,
      resting_heart_rate: 52,
      blood_oxygen_avg: null,
      weight_kg: null,
    });
  });

  it("synthesizes sleep timestamps from midnight UTC plus duration", () => {
    const result = transformWellness(makeFullWellness(), USER_ID, history);
    expect(result.sleepSession).toMatchObject({
      source_ref: "sleep_2026-07-03",
      sleep_start: "2026-07-03T00:00:00.000Z",
      sleep_end: "2026-07-03T07:22:00.000Z", // 26520s = 7h22m
      sleep_seconds: 26520,
      sleep_score: 81,
      avg_hrv_ms: 48,
    });
  });

  it("computes hrv_nights baseline, weekly avg and status from history", () => {
    const result = transformWellness(makeFullWellness(), USER_ID, history);
    expect(result.hrvNight).toMatchObject({
      source_ref: "hrv_2026-07-03",
      hrv_rmssd: 48,
      hrv_baseline: 52, // mean(50, 52, 54)
      weekly_avg: 51, // mean(50, 52, 54) in 7d window + current 48
      hrv_status: "normal", // 48 / 52 = 0.923
    });
  });

  it("flags hrv_status low when rMSSD drops well below baseline", () => {
    const result = transformWellness(
      makeFullWellness({ hrv: 35 }),
      USER_ID,
      makeHistory([
        ["2026-06-28", 50],
        ["2026-06-30", 52],
        ["2026-07-02", 54],
      ]),
    );
    expect(result.hrvNight).toMatchObject({
      hrv_rmssd: 35,
      hrv_status: "low", // 35 / 52 = 0.673
    });
  });

  it("reports hrv_status unknown and null baseline during cold start", () => {
    const result = transformWellness(makeFullWellness(), USER_ID, []);
    expect(result.hrvNight).toMatchObject({
      hrv_baseline: null,
      hrv_status: "unknown",
      weekly_avg: 48,
    });
  });

  it("maps the MVP daily_metrics row", () => {
    const result = transformWellness(makeFullWellness(), USER_ID, history);
    expect(result.dailyMetricsMvp).toEqual({
      user_id: USER_ID,
      date: "2026-07-03",
      hrv_ms: 48,
      resting_heart_rate: 52,
      sleep_hours: 7.37,
      sleep_quality: 8,
    });
  });

  it("omits sleep and HRV rows when those signals are absent", () => {
    const partial = makeFullWellness({ hrv: null, sleepSecs: null, sleepScore: null });
    const result = transformWellness(partial, USER_ID, history);
    expect(result.sleepSession).toBeNull();
    expect(result.hrvNight).toBeNull();
    expect(result.dailyMetrics).not.toBeNull();
    expect(result.dailyMetricsMvp).toEqual({
      user_id: USER_ID,
      date: "2026-07-03",
      resting_heart_rate: 52,
    });
  });

  it("returns all nulls for an empty wellness day", () => {
    const empty: IntervalsWellness = {
      id: "2026-07-01",
      restingHR: null,
      hrv: null,
      sleepSecs: null,
      sleepScore: null,
      steps: null,
    };
    const result = transformWellness(empty, USER_ID, []);
    expect(result.dailyMetrics).toBeNull();
    expect(result.sleepSession).toBeNull();
    expect(result.hrvNight).toBeNull();
    expect(result.dailyMetricsMvp).toBeNull();
  });

  it("throws on an invalid date id", () => {
    expect(() =>
      transformWellness({ id: "garbage" } as IntervalsWellness, USER_ID, []),
    ).toThrow(/invalid date/);
  });
});
