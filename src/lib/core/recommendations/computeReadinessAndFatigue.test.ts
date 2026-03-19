import { describe, it, expect } from "vitest";
import {
  computeReadinessAndFatigue,
  type ReadinessAndFatigueInput,
  type ReadinessAndFatigueOutput,
  type DailyCheckinInput,
} from "./computeReadinessAndFatigue";
import type { ReasonCode } from "../contracts";
import type { DailyTssEntry } from "./computeEwma";
import type {
  SleepSessionInput,
  HrvNightInput,
  DailyMetricsInput,
  TrainingLoadInput,
} from "./computeDailyRecommendation";
import type { HrvHistoryEntry } from "./detectTrends";

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

  // ======= Daily check-in adjustments ======================================

  describe("daily check-in adjustments", () => {
    function withCheckin(checkin: DailyCheckinInput): ReadinessAndFatigueInput {
      return { ...fullHealthyInput(), dailyCheckin: checkin };
    }

    const baseline = computeReadinessAndFatigue(fullHealthyInput());

    it("drained mood lowers readiness and increases fatigue", () => {
      const result = computeReadinessAndFatigue(withCheckin({ mood: "drained" }));
      expect(result.readiness_score).toBeLessThan(baseline.readiness_score);
      expect(result.fatigue_score).toBeGreaterThan(baseline.fatigue_score);
    });

    it("tired mood lowers readiness and increases fatigue", () => {
      const result = computeReadinessAndFatigue(withCheckin({ mood: "tired" }));
      expect(result.readiness_score).toBeLessThan(baseline.readiness_score);
      expect(result.fatigue_score).toBeGreaterThan(baseline.fatigue_score);
    });

    it("drained mood adds FATIGUE_ELEVATED", () => {
      const result = computeReadinessAndFatigue(withCheckin({ mood: "drained" }));
      expect(hasCode(result, "FATIGUE_ELEVATED")).toBe(true);
    });

    it("tired mood adds FATIGUE_ELEVATED", () => {
      const result = computeReadinessAndFatigue(withCheckin({ mood: "tired" }));
      expect(hasCode(result, "FATIGUE_ELEVATED")).toBe(true);
    });

    it("good mood improves readiness", () => {
      const result = computeReadinessAndFatigue(withCheckin({ mood: "good" }));
      expect(result.readiness_score).toBeGreaterThanOrEqual(baseline.readiness_score);
    });

    it("great mood improves readiness", () => {
      const result = computeReadinessAndFatigue(withCheckin({ mood: "great" }));
      expect(result.readiness_score).toBeGreaterThanOrEqual(baseline.readiness_score);
    });

    it("okay mood does not change scores", () => {
      const result = computeReadinessAndFatigue(withCheckin({ mood: "okay" }));
      expect(result.readiness_score).toBe(baseline.readiness_score);
      expect(result.fatigue_score).toBe(baseline.fatigue_score);
    });

    it("high RPE (>= 8) increases fatigue and adds FATIGUE_ELEVATED", () => {
      const result = computeReadinessAndFatigue(withCheckin({ rpe: 9 }));
      expect(result.fatigue_score).toBeGreaterThan(baseline.fatigue_score);
      expect(hasCode(result, "FATIGUE_ELEVATED")).toBe(true);
    });

    it("moderate RPE (< 8) does not change fatigue", () => {
      const result = computeReadinessAndFatigue(withCheckin({ rpe: 5 }));
      expect(result.fatigue_score).toBe(baseline.fatigue_score);
    });

    it("high soreness (>= 7) increases fatigue", () => {
      const result = computeReadinessAndFatigue(withCheckin({ soreness: 8 }));
      expect(result.fatigue_score).toBeGreaterThan(baseline.fatigue_score);
      expect(hasCode(result, "FATIGUE_ELEVATED")).toBe(true);
    });

    it("moderate soreness (< 7) does not change fatigue", () => {
      const result = computeReadinessAndFatigue(withCheckin({ soreness: 4 }));
      expect(result.fatigue_score).toBe(baseline.fatigue_score);
    });

    it("pain_flag lowers readiness, increases fatigue, adds FATIGUE_HIGH", () => {
      const result = computeReadinessAndFatigue(withCheckin({ pain_flag: true }));
      expect(result.readiness_score).toBeLessThan(baseline.readiness_score);
      expect(result.fatigue_score).toBeGreaterThan(baseline.fatigue_score);
      expect(hasCode(result, "FATIGUE_HIGH")).toBe(true);
    });

    it("illness_flag lowers readiness, increases fatigue, adds FATIGUE_HIGH", () => {
      const result = computeReadinessAndFatigue(withCheckin({ illness_flag: true }));
      expect(result.readiness_score).toBeLessThan(baseline.readiness_score);
      expect(result.fatigue_score).toBeGreaterThan(baseline.fatigue_score);
      expect(hasCode(result, "FATIGUE_HIGH")).toBe(true);
    });

    it("combined pain + illness produces strong impact", () => {
      const result = computeReadinessAndFatigue(
        withCheckin({ pain_flag: true, illness_flag: true }),
      );
      expect(result.readiness_score).toBeLessThan(baseline.readiness_score - 20);
      expect(result.fatigue_score).toBeGreaterThan(baseline.fatigue_score + 20);
    });

    it("is deterministic with check-in input", () => {
      const input = withCheckin({ mood: "tired", rpe: 9, soreness: 8 });
      const a = computeReadinessAndFatigue(input);
      const b = computeReadinessAndFatigue(input);
      expect(a).toEqual(b);
    });

    it("clamps readiness at 0 even with extreme negative adjustments", () => {
      // Stack all negative factors on already-bad base data
      const input: ReadinessAndFatigueInput = {
        sleep: poorSleep,
        hrv: suppressedHrv,
        metrics: poorMetrics,
        trainingLoad7Days: makeLoad(700),
        dailyCheckin: {
          mood: "drained",
          pain_flag: true,
          illness_flag: true,
        },
      };
      const result = computeReadinessAndFatigue(input);
      expect(result.readiness_score).toBe(0);
      expect(result.fatigue_score).toBe(100);
    });

    it("clamps fatigue at 100 even with extreme positive adjustments", () => {
      const input: ReadinessAndFatigueInput = {
        sleep: goodSleep,
        hrv: goodHrv,
        metrics: goodMetrics,
        trainingLoad7Days: makeLoad(700),
        dailyCheckin: {
          mood: "drained",
          rpe: 10,
          soreness: 10,
          pain_flag: true,
          illness_flag: true,
        },
      };
      const result = computeReadinessAndFatigue(input);
      expect(result.fatigue_score).toBe(100);
      expect(result.readiness_score).toBeGreaterThanOrEqual(0);
    });

    it("null/undefined check-in fields are no-ops", () => {
      const result = computeReadinessAndFatigue(
        withCheckin({ mood: null, rpe: null, soreness: null, pain_flag: null, illness_flag: null }),
      );
      expect(result.readiness_score).toBe(baseline.readiness_score);
      expect(result.fatigue_score).toBe(baseline.fatigue_score);
    });

    it("absent dailyCheckin field is a no-op", () => {
      const result = computeReadinessAndFatigue(fullHealthyInput());
      expect(result.readiness_score).toBe(baseline.readiness_score);
      expect(result.fatigue_score).toBe(baseline.fatigue_score);
    });

    it("does not duplicate FATIGUE_ELEVATED when multiple triggers fire", () => {
      const result = computeReadinessAndFatigue(
        withCheckin({ mood: "tired", rpe: 9, soreness: 8 }),
      );
      const count = result.reason_codes.filter((c) => c === "FATIGUE_ELEVATED").length;
      expect(count).toBe(1);
    });

    it("does not duplicate FATIGUE_HIGH when both pain and illness fire", () => {
      const result = computeReadinessAndFatigue(
        withCheckin({ pain_flag: true, illness_flag: true }),
      );
      const count = result.reason_codes.filter((c) => c === "FATIGUE_HIGH").length;
      expect(count).toBe(1);
    });
  });

  // ======= Phase 5: Confidence, Baseline, Trends ============================

  describe("Phase 5 — confidence, baseline mode, and trend detection", () => {
    it("omits confidence and baseline_mode when optional inputs absent", () => {
      const result = computeReadinessAndFatigue(fullHealthyInput());
      expect(result.confidence).toBeUndefined();
      expect(result.baseline_mode).toBeUndefined();
    });

    it("returns baseline_mode when totalDataDays is provided", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 3,
      });
      expect(result.baseline_mode).toBe("cold_start");
    });

    it("returns mature baseline_mode for 30 days", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 30,
      });
      expect(result.baseline_mode).toBe("mature");
    });

    it("adds COLD_START reason for cold_start baseline mode", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 3,
      });
      expect(hasCode(result, "COLD_START")).toBe(true);
    });

    it("does not add COLD_START for mature baseline mode", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 30,
      });
      expect(hasCode(result, "COLD_START")).toBe(false);
    });

    it("returns confidence breakdown when totalDataDays provided", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 30,
        latestDataTimestamp: "2026-03-18T10:00:00Z",
        currentTimestamp: "2026-03-18T12:00:00Z",
      });
      expect(result.confidence).toBeDefined();
      expect(result.confidence!.data_availability).toBe(1); // all 4 sources
      expect(result.confidence!.signal_consistency).toBeGreaterThan(0.5);
      expect(result.confidence!.data_recency).toBe(1.0); // 2h old
      expect(result.confidence!.overall).toBeGreaterThan(0);
      expect(result.confidence!.overall).toBeLessThanOrEqual(1);
    });

    it("fires HRV_DECLINING with declining HRV history", () => {
      const hrvHistory: HrvHistoryEntry[] = [
        { date: "2026-03-18", hrv_rmssd: 32 },
        { date: "2026-03-17", hrv_rmssd: 38 },
        { date: "2026-03-16", hrv_rmssd: 44 },
        { date: "2026-03-15", hrv_rmssd: 50 },
        { date: "2026-03-14", hrv_rmssd: 55 },
      ];
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        hrvHistory,
      });
      expect(hasCode(result, "HRV_DECLINING")).toBe(true);
    });

    it("does not fire HRV_DECLINING with stable HRV history", () => {
      const hrvHistory: HrvHistoryEntry[] = [
        { date: "2026-03-18", hrv_rmssd: 50 },
        { date: "2026-03-17", hrv_rmssd: 51 },
        { date: "2026-03-16", hrv_rmssd: 49 },
        { date: "2026-03-15", hrv_rmssd: 50 },
        { date: "2026-03-14", hrv_rmssd: 50 },
      ];
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        hrvHistory,
      });
      expect(hasCode(result, "HRV_DECLINING")).toBe(false);
    });

    it("fires STREAK_RISK at 5 consecutive training days", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        consecutiveTrainingDays: 5,
      });
      expect(hasCode(result, "STREAK_RISK")).toBe(true);
    });

    it("does not fire STREAK_RISK at 4 consecutive training days", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        consecutiveTrainingDays: 4,
      });
      expect(hasCode(result, "STREAK_RISK")).toBe(false);
    });

    it("does not fire TRAINING_LOAD_LOW when priorChronicLoad28d is null (MVP)", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        chronicLoad28d: 100,
        priorChronicLoad28d: null,
      });
      expect(hasCode(result, "TRAINING_LOAD_LOW")).toBe(false);
    });

    it("fires TRAINING_LOAD_LOW when current < 60% of prior", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        chronicLoad28d: 200,
        priorChronicLoad28d: 500,
      });
      expect(hasCode(result, "TRAINING_LOAD_LOW")).toBe(true);
    });

    it("backward compat: existing tests produce same output without new fields", () => {
      const input = fullHealthyInput();
      const result = computeReadinessAndFatigue(input);
      // No confidence or baseline_mode keys
      expect("confidence" in result).toBe(false);
      expect("baseline_mode" in result).toBe(false);
      // Same shape as before
      expect(result).toHaveProperty("readiness_score");
      expect(result).toHaveProperty("fatigue_score");
      expect(result).toHaveProperty("reason_codes");
    });

    it("confidence uses neutral recency when no latestDataTimestamp", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 30,
        // no latestDataTimestamp
      });
      expect(result.confidence).toBeDefined();
      expect(result.confidence!.data_recency).toBe(0.5);
    });

    it("fires ADAPTATION_PHASE when load increased ≥120% in mature mode", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 30,
        chronicLoad28d: 600,
        priorChronicLoad28d: 400,
      });
      expect(hasCode(result, "ADAPTATION_PHASE")).toBe(true);
    });

    it("does not fire ADAPTATION_PHASE in cold_start mode", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 3, // cold_start
        chronicLoad28d: 600,
        priorChronicLoad28d: 400,
      });
      expect(hasCode(result, "ADAPTATION_PHASE")).toBe(false);
    });

    it("does not fire ADAPTATION_PHASE when load is stable", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        totalDataDays: 30,
        chronicLoad28d: 500,
        priorChronicLoad28d: 500,
      });
      expect(hasCode(result, "ADAPTATION_PHASE")).toBe(false);
    });

    it("does not fire ADAPTATION_PHASE without totalDataDays (no baseline_mode)", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        chronicLoad28d: 600,
        priorChronicLoad28d: 400,
      });
      expect(hasCode(result, "ADAPTATION_PHASE")).toBe(false);
    });
  });

  // ======= Phase 6: EWMA fitness/fatigue integration ========================

  describe("Phase 6 — EWMA fitness/fatigue integration", () => {
    /** Generate N days of constant TSS ending on a fixed date. */
    function makeDailyTss(tssPerDay: number, days: number): DailyTssEntry[] {
      const entries: DailyTssEntry[] = [];
      const end = new Date("2026-03-19T00:00:00Z");
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - i);
        entries.push({
          date: d.toISOString().slice(0, 10),
          total_tss: tssPerDay,
        });
      }
      return entries;
    }

    it("omits ewma when dailyTssHistory is absent", () => {
      const result = computeReadinessAndFatigue(fullHealthyInput());
      expect(result.ewma).toBeUndefined();
    });

    it("omits ewma when dailyTssHistory is null", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        dailyTssHistory: null,
        targetDate: "2026-03-19",
      });
      expect(result.ewma).toBeUndefined();
    });

    it("omits ewma when dailyTssHistory is empty", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        dailyTssHistory: [],
        targetDate: "2026-03-19",
      });
      expect(result.ewma).toBeUndefined();
    });

    it("omits ewma when targetDate is null", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        dailyTssHistory: makeDailyTss(50, 30),
        targetDate: null,
      });
      expect(result.ewma).toBeUndefined();
    });

    it("backward compat: identical scores without EWMA input", () => {
      const input = fullHealthyInput();
      const withoutEwma = computeReadinessAndFatigue(input);
      const withNullEwma = computeReadinessAndFatigue({
        ...input,
        dailyTssHistory: null,
        targetDate: null,
      });
      expect(withoutEwma.readiness_score).toBe(withNullEwma.readiness_score);
      expect(withoutEwma.fatigue_score).toBe(withNullEwma.fatigue_score);
      expect(withoutEwma.reason_codes).toEqual(withNullEwma.reason_codes);
    });

    it("returns ewma when history is provided", () => {
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        dailyTssHistory: makeDailyTss(50, 30),
        targetDate: "2026-03-19",
      });
      expect(result.ewma).toBeDefined();
      expect(result.ewma!.fitness_score).toBeGreaterThan(0);
      expect(result.ewma!.fatigue_score).toBeGreaterThan(0);
      expect(result.ewma!.data_days).toBe(30);
      expect(result.ewma!.cold_start_fatigue).toBe(false);
      expect(result.ewma!.cold_start_fitness).toBe(false);
    });

    it("cold start fatigue preserves legacy fatigue_score", () => {
      // Only 5 days of history → cold_start_fatigue=true
      const shortHistory = makeDailyTss(80, 5);
      const withEwma = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        dailyTssHistory: shortHistory,
        targetDate: "2026-03-19",
      });
      const withoutEwma = computeReadinessAndFatigue(fullHealthyInput());

      // Should keep legacy fatigue score
      expect(withEwma.fatigue_score).toBe(withoutEwma.fatigue_score);
      expect(withEwma.ewma!.cold_start_fatigue).toBe(true);
    });

    it("fitness provides readiness bonus when not cold start", () => {
      // Taper scenario: built fitness over 45 days at moderate load,
      // then 15 days rest. Fatigue has decayed, fitness remains.
      // The fitness bonus should lift readiness above baseline (no EWMA).
      const taperHistory: DailyTssEntry[] = [];
      for (let i = 59; i >= 0; i--) {
        const d = new Date("2026-03-19T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - i);
        taperHistory.push({
          date: d.toISOString().slice(0, 10),
          total_tss: i >= 15 ? 60 : 0, // 45 days training, 15 days rest
        });
      }
      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        trainingLoad7Days: makeLoad(0), // no recent load (rest week)
        dailyTssHistory: taperHistory,
        targetDate: "2026-03-19",
      });
      const baseline = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        trainingLoad7Days: makeLoad(0),
      });

      // With low EWMA fatigue (tapered) + fitness bonus, readiness should exceed baseline
      expect(result.readiness_score).toBeGreaterThan(baseline.readiness_score);
      // Fitness bonus should be present (form positive after taper)
      expect(result.ewma!.form_score).toBeGreaterThan(0);
    });

    it("FORM_POSITIVE fires when form_raw > 10", () => {
      // Build scenario: trained hard 3 weeks ago, resting since
      // This means high fitness (slow decay) but low fatigue (fast decay)
      const entries: DailyTssEntry[] = [];
      for (let i = 59; i >= 0; i--) {
        const d = new Date("2026-03-19T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - i);
        // High TSS for first 45 days, then rest for last 15 days
        entries.push({
          date: d.toISOString().slice(0, 10),
          total_tss: i >= 15 ? 80 : 0,
        });
      }

      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        dailyTssHistory: entries,
        targetDate: "2026-03-19",
      });

      // After 15 days of rest, fatigue should have decayed more than fitness
      expect(result.ewma!.form_raw).toBeGreaterThan(10);
      expect(hasCode(result, "FORM_POSITIVE")).toBe(true);
    });

    it("FORM_NEGATIVE fires when form_raw < -20", () => {
      // Build scenario: low base then sudden heavy block
      const entries: DailyTssEntry[] = [];
      for (let i = 49; i >= 0; i--) {
        const d = new Date("2026-03-19T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - i);
        // Low TSS for first 40 days, then very high for last 10 days
        entries.push({
          date: d.toISOString().slice(0, 10),
          total_tss: i >= 10 ? 20 : 150,
        });
      }

      const result = computeReadinessAndFatigue({
        ...fullHealthyInput(),
        dailyTssHistory: entries,
        targetDate: "2026-03-19",
      });

      // Acute fatigue should exceed fitness → negative form
      expect(result.ewma!.form_raw).toBeLessThan(-20);
      expect(hasCode(result, "FORM_NEGATIVE")).toBe(true);
    });
  });
});
