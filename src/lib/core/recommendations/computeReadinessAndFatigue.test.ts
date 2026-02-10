import { describe, it, expect } from "vitest";
import {
  computeReadinessAndFatigue,
  type ReadinessAndFatigueInput,
  type ReadinessAndFatigueOutput,
} from "./computeReadinessAndFatigue";
import type { ReasonCode } from "../contracts";
import type {
  SleepSessionInput,
  HrvNightInput,
  DailyMetricsInput,
  TrainingLoadInput,
} from "./computeDailyRecommendation";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const goodSleep: SleepSessionInput = {
  date: "2026-02-09",
  duration_seconds: 8 * 3600, // 8 h
  sleep_score: 85,
  deep_seconds: 5400,
  rem_seconds: 7200,
  avg_hrv_ms: 45,
};

const poorSleep: SleepSessionInput = {
  date: "2026-02-09",
  duration_seconds: 5 * 3600, // 5 h — below 6 h threshold
  sleep_score: 40,
  deep_seconds: 2000,
  rem_seconds: 3000,
  avg_hrv_ms: 25,
};

const lowScoreSleep: SleepSessionInput = {
  date: "2026-02-09",
  duration_seconds: 7.5 * 3600, // fine duration
  sleep_score: 50, // below 60 threshold
  deep_seconds: 3000,
  rem_seconds: 4000,
  avg_hrv_ms: 30,
};

const goodHrv: HrvNightInput = {
  date: "2026-02-09",
  hrv_rmssd: 55,
  hrv_baseline: 50, // ratio 1.1 — above threshold
  hrv_status: "normal",
  weekly_avg: 52,
};

const suppressedHrv: HrvNightInput = {
  date: "2026-02-09",
  hrv_rmssd: 30,
  hrv_baseline: 50, // ratio 0.6 — below 0.8 threshold
  hrv_status: "low",
  weekly_avg: 48,
};

const zeroBaselineHrv: HrvNightInput = {
  date: "2026-02-09",
  hrv_rmssd: 40,
  hrv_baseline: 0,
  hrv_status: "unknown",
  weekly_avg: 0,
};

const goodMetrics: DailyMetricsInput = {
  date: "2026-02-09",
  recovery_score: 80,
  body_battery_high: 90,
  body_battery_low: 30,
  resting_heart_rate: 52,
  stress_avg: 25,
};

const poorMetrics: DailyMetricsInput = {
  date: "2026-02-09",
  recovery_score: 20,
  body_battery_high: 40,
  body_battery_low: 15,
  resting_heart_rate: 65,
  stress_avg: 60,
};

function makeLoad(tss: number): TrainingLoadInput[] {
  // Spread TSS across 3 days for realism
  if (tss === 0) return [];
  const perDay = tss / 3;
  return [
    { date: "2026-02-09", workouts_count: 1, total_duration_seconds: 3600, total_tss: perDay },
    { date: "2026-02-08", workouts_count: 1, total_duration_seconds: 3600, total_tss: perDay },
    { date: "2026-02-07", workouts_count: 1, total_duration_seconds: 3600, total_tss: perDay },
  ];
}

function fullHealthyInput(): ReadinessAndFatigueInput {
  return {
    sleep: goodSleep,
    hrv: goodHrv,
    metrics: goodMetrics,
    trainingLoad7Days: makeLoad(300),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasCode(output: ReadinessAndFatigueOutput, code: ReasonCode): boolean {
  return output.reason_codes.includes(code);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeReadinessAndFatigue", () => {
  // ======= Output invariants ===============================================

  describe("output invariants", () => {
    it("readiness_score is an integer in 0..100", () => {
      const result = computeReadinessAndFatigue(fullHealthyInput());
      expect(Number.isInteger(result.readiness_score)).toBe(true);
      expect(result.readiness_score).toBeGreaterThanOrEqual(0);
      expect(result.readiness_score).toBeLessThanOrEqual(100);
    });

    it("fatigue_score is an integer in 0..100", () => {
      const result = computeReadinessAndFatigue(fullHealthyInput());
      expect(Number.isInteger(result.fatigue_score)).toBe(true);
      expect(result.fatigue_score).toBeGreaterThanOrEqual(0);
      expect(result.fatigue_score).toBeLessThanOrEqual(100);
    });

    it("reason_codes is non-empty", () => {
      const result = computeReadinessAndFatigue(fullHealthyInput());
      expect(result.reason_codes.length).toBeGreaterThanOrEqual(1);
    });

    it("is deterministic (same input → same output)", () => {
      const input = fullHealthyInput();
      const a = computeReadinessAndFatigue(input);
      const b = computeReadinessAndFatigue(input);
      expect(a).toEqual(b);
    });
  });

  // ======= Normal / healthy case ==========================================

  describe("normal case — full data, healthy signals", () => {
    it("produces high readiness and moderate fatigue", () => {
      const result = computeReadinessAndFatigue(fullHealthyInput());
      expect(result.readiness_score).toBeGreaterThanOrEqual(60);
      expect(result.fatigue_score).toBeGreaterThan(0);
      expect(result.fatigue_score).toBeLessThan(80);
    });

    it("returns RECOVERY_OPTIMAL when no warnings apply", () => {
      const result = computeReadinessAndFatigue(fullHealthyInput());
      expect(hasCode(result, "RECOVERY_OPTIMAL")).toBe(true);
      expect(result.reason_codes).toEqual(["RECOVERY_OPTIMAL"]);
    });
  });

  // ======= Cold start / missing data ======================================

  describe("cold start — no data at all", () => {
    const emptyInput: ReadinessAndFatigueInput = {
      sleep: null,
      hrv: null,
      metrics: null,
      trainingLoad7Days: [],
    };

    it("returns INSUFFICIENT_DATA", () => {
      const result = computeReadinessAndFatigue(emptyInput);
      expect(hasCode(result, "INSUFFICIENT_DATA")).toBe(true);
    });

    it("returns neutral readiness (~50) and zero fatigue", () => {
      const result = computeReadinessAndFatigue(emptyInput);
      expect(result.readiness_score).toBe(50);
      expect(result.fatigue_score).toBe(0);
    });
  });

  describe("partial data — only one source", () => {
    it("flags INSUFFICIENT_DATA with only sleep", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: null,
        metrics: null,
        trainingLoad7Days: [],
      });
      expect(hasCode(result, "INSUFFICIENT_DATA")).toBe(true);
    });

    it("flags INSUFFICIENT_DATA with only training load", () => {
      const result = computeReadinessAndFatigue({
        sleep: null,
        hrv: null,
        metrics: null,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "INSUFFICIENT_DATA")).toBe(true);
    });

    it("does NOT flag INSUFFICIENT_DATA with 2+ sources", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: null,
        trainingLoad7Days: [],
      });
      expect(hasCode(result, "INSUFFICIENT_DATA")).toBe(false);
    });
  });

  // ======= SLEEP_POOR =====================================================

  describe("SLEEP_POOR reason code", () => {
    it("fires when sleep_score < 60", () => {
      const result = computeReadinessAndFatigue({
        sleep: lowScoreSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "SLEEP_POOR")).toBe(true);
    });

    it("fires when sleep duration < 6 hours", () => {
      const result = computeReadinessAndFatigue({
        sleep: poorSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "SLEEP_POOR")).toBe(true);
    });

    it("does NOT fire when sleep is good", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "SLEEP_POOR")).toBe(false);
    });

    it("does NOT fire when sleep is null", () => {
      const result = computeReadinessAndFatigue({
        sleep: null,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "SLEEP_POOR")).toBe(false);
    });

    it("lowers readiness compared to good sleep", () => {
      const good = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      const bad = computeReadinessAndFatigue({
        sleep: poorSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(bad.readiness_score).toBeLessThan(good.readiness_score);
    });
  });

  // ======= HRV_LOW ========================================================

  describe("HRV_LOW reason code", () => {
    it("fires when rmssd/baseline < 0.8", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: suppressedHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "HRV_LOW")).toBe(true);
    });

    it("does NOT fire when HRV is normal", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "HRV_LOW")).toBe(false);
    });

    it("does NOT fire when baseline is zero (non-computable)", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: zeroBaselineHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "HRV_LOW")).toBe(false);
    });

    it("does NOT fire when HRV is null", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: null,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "HRV_LOW")).toBe(false);
    });

    it("lowers readiness compared to normal HRV", () => {
      const normal = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      const suppressed = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: suppressedHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(suppressed.readiness_score).toBeLessThan(normal.readiness_score);
    });
  });

  // ======= TRAINING_LOAD_HIGH ==============================================

  describe("TRAINING_LOAD_HIGH reason code", () => {
    it("fires when 7-day TSS > 500", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(600),
      });
      expect(hasCode(result, "TRAINING_LOAD_HIGH")).toBe(true);
    });

    it("does NOT fire when 7-day TSS <= 500", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(300),
      });
      expect(hasCode(result, "TRAINING_LOAD_HIGH")).toBe(false);
    });

    it("does NOT fire at exactly TSS = 500", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(500),
      });
      expect(hasCode(result, "TRAINING_LOAD_HIGH")).toBe(false);
    });

    it("increases fatigue_score", () => {
      const low = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(100),
      });
      const high = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(600),
      });
      expect(high.fatigue_score).toBeGreaterThan(low.fatigue_score);
    });
  });

  // ======= Multiple reason codes ==========================================

  describe("multiple reason codes", () => {
    it("can include SLEEP_POOR + HRV_LOW + TRAINING_LOAD_HIGH", () => {
      const result = computeReadinessAndFatigue({
        sleep: poorSleep,
        hrv: suppressedHrv,
        metrics: poorMetrics,
        trainingLoad7Days: makeLoad(600),
      });
      expect(hasCode(result, "SLEEP_POOR")).toBe(true);
      expect(hasCode(result, "HRV_LOW")).toBe(true);
      expect(hasCode(result, "TRAINING_LOAD_HIGH")).toBe(true);
      expect(hasCode(result, "RECOVERY_OPTIMAL")).toBe(false);
    });

    it("produces very low readiness when everything is bad", () => {
      const result = computeReadinessAndFatigue({
        sleep: poorSleep,
        hrv: suppressedHrv,
        metrics: poorMetrics,
        trainingLoad7Days: makeLoad(700),
      });
      expect(result.readiness_score).toBeLessThanOrEqual(20);
      expect(result.fatigue_score).toBe(100);
    });
  });

  // ======= Boundary / edge cases ==========================================

  describe("boundary and edge cases", () => {
    it("handles zero sleep_score and zero duration", () => {
      const result = computeReadinessAndFatigue({
        sleep: { ...goodSleep, sleep_score: 0, duration_seconds: 0 },
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: [],
      });
      expect(result.readiness_score).toBeGreaterThanOrEqual(0);
      expect(result.readiness_score).toBeLessThanOrEqual(100);
      expect(hasCode(result, "SLEEP_POOR")).toBe(true);
    });

    it("handles sleep_score of exactly 60 (no SLEEP_POOR)", () => {
      const result = computeReadinessAndFatigue({
        sleep: { ...goodSleep, sleep_score: 60, duration_seconds: 7 * 3600 },
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "SLEEP_POOR")).toBe(false);
    });

    it("handles HRV ratio of exactly 0.8 (no HRV_LOW)", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: { ...goodHrv, hrv_rmssd: 40, hrv_baseline: 50 }, // ratio = 0.8
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      expect(hasCode(result, "HRV_LOW")).toBe(false);
    });

    it("caps fatigue_score at 100 for extreme TSS", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(2000),
      });
      expect(result.fatigue_score).toBe(100);
    });

    it("returns fatigue_score 0 with no training load", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: [],
      });
      expect(result.fatigue_score).toBe(0);
    });

    it("handles negative hrv_baseline gracefully", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: { ...goodHrv, hrv_baseline: -10, hrv_rmssd: 40 },
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(200),
      });
      // Should not fire HRV_LOW (baseline unusable)
      expect(hasCode(result, "HRV_LOW")).toBe(false);
      expect(result.readiness_score).toBeGreaterThanOrEqual(0);
    });

    it("handles recovery_score 0", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: { ...goodMetrics, recovery_score: 0 },
        trainingLoad7Days: makeLoad(200),
      });
      expect(result.readiness_score).toBeGreaterThanOrEqual(0);
      expect(result.readiness_score).toBeLessThanOrEqual(100);
    });

    it("handles recovery_score 100", () => {
      const result = computeReadinessAndFatigue({
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: { ...goodMetrics, recovery_score: 100 },
        trainingLoad7Days: [],
      });
      expect(result.readiness_score).toBeGreaterThanOrEqual(70);
    });
  });
});
