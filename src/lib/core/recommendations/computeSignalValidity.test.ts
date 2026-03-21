import { describe, it, expect } from "vitest";
import {
  validateSleep,
  validateHrv,
  validateMetrics,
  validateLoad,
  computeSignalValidityReport,
} from "./computeSignalValidity";
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
  date: "2026-03-19",
  duration_seconds: 8 * 3600,
  sleep_score: 85,
  deep_seconds: 5400,
  rem_seconds: 7200,
  avg_hrv_ms: 45,
};

const goodHrv: HrvNightInput = {
  date: "2026-03-19",
  hrv_rmssd: 55,
  hrv_baseline: 50,
  hrv_status: "normal",
  weekly_avg: 52,
};

const goodMetrics: DailyMetricsInput = {
  date: "2026-03-19",
  recovery_score: 80,
  body_battery_high: 90,
  body_battery_low: 30,
  resting_heart_rate: 52,
  stress_avg: 25,
};

function makeLoad(tss: number): TrainingLoadInput[] {
  if (tss === 0) return [];
  return [
    { date: "2026-03-19", workouts_count: 1, total_duration_seconds: 3600, total_tss: tss },
  ];
}

// ---------------------------------------------------------------------------
// validateSleep
// ---------------------------------------------------------------------------

describe("validateSleep", () => {
  it("returns invalid for score=0 and duration=0", () => {
    const result = validateSleep({ ...goodSleep, sleep_score: 0, duration_seconds: 0 });
    expect(result.valid).toBe(false);
    expect(result.quality).toBe(0);
    expect(result.invalid_reason).toBe("zero_score_and_duration");
  });

  it("returns invalid for duration < 30min", () => {
    const result = validateSleep({ ...goodSleep, duration_seconds: 20 * 60 });
    expect(result.valid).toBe(false);
    expect(result.quality).toBe(0);
    expect(result.invalid_reason).toBe("duration_under_30min");
  });

  it("returns degraded for score=0 with duration", () => {
    const result = validateSleep({ ...goodSleep, sleep_score: 0, duration_seconds: 6 * 3600 });
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(0.3);
    expect(result.invalid_reason).toBe("zero_score_with_duration");
  });

  it("returns valid with quality scaling for normal sleep", () => {
    const result = validateSleep(goodSleep);
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(0.85);
    expect(result.invalid_reason).toBeUndefined();
  });

  it("returns quality 1.0 for perfect score", () => {
    const result = validateSleep({ ...goodSleep, sleep_score: 100 });
    expect(result.quality).toBe(1.0);
  });

  it("clamps quality to 0-1 range", () => {
    const result = validateSleep({ ...goodSleep, sleep_score: 150 });
    expect(result.quality).toBe(1.0);
  });

  it("handles exactly 30min duration as valid", () => {
    const result = validateSleep({ ...goodSleep, duration_seconds: 30 * 60 });
    expect(result.valid).toBe(true);
  });

  it("handles 29min duration as invalid", () => {
    const result = validateSleep({ ...goodSleep, duration_seconds: 29 * 60 });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateHrv
// ---------------------------------------------------------------------------

describe("validateHrv", () => {
  it("returns invalid for rmssd=0", () => {
    const result = validateHrv({ ...goodHrv, hrv_rmssd: 0 });
    expect(result.valid).toBe(false);
    expect(result.quality).toBe(0);
    expect(result.invalid_reason).toBe("rmssd_non_positive");
  });

  it("returns invalid for negative rmssd", () => {
    const result = validateHrv({ ...goodHrv, hrv_rmssd: -5 });
    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("rmssd_non_positive");
  });

  it("returns invalid for rmssd > 300 (implausible)", () => {
    const result = validateHrv({ ...goodHrv, hrv_rmssd: 350 });
    expect(result.valid).toBe(false);
    expect(result.quality).toBe(0);
    expect(result.invalid_reason).toBe("rmssd_implausible");
  });

  it("returns degraded for baseline ≤ 0", () => {
    const result = validateHrv({ ...goodHrv, hrv_baseline: 0 });
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(0.4);
    expect(result.invalid_reason).toBe("baseline_non_positive");
  });

  it("returns degraded for negative baseline", () => {
    const result = validateHrv({ ...goodHrv, hrv_baseline: -10 });
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(0.4);
  });

  it("returns valid quality 1.0 for normal HRV", () => {
    const result = validateHrv(goodHrv);
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(1.0);
    expect(result.invalid_reason).toBeUndefined();
  });

  it("accepts rmssd=300 as valid boundary", () => {
    const result = validateHrv({ ...goodHrv, hrv_rmssd: 300 });
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(1.0);
  });

  it("rejects rmssd=301 as implausible", () => {
    const result = validateHrv({ ...goodHrv, hrv_rmssd: 301 });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateMetrics
// ---------------------------------------------------------------------------

describe("validateMetrics", () => {
  it("returns invalid when all key metrics are zero", () => {
    const result = validateMetrics({
      ...goodMetrics,
      recovery_score: 0,
      body_battery_high: 0,
      resting_heart_rate: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.quality).toBe(0);
    expect(result.invalid_reason).toBe("all_zeros");
  });

  it("returns degraded when only recovery is zero", () => {
    const result = validateMetrics({ ...goodMetrics, recovery_score: 0 });
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(0.4);
    expect(result.invalid_reason).toBe("zero_recovery");
  });

  it("returns valid quality 1.0 for normal metrics", () => {
    const result = validateMetrics(goodMetrics);
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(1.0);
    expect(result.invalid_reason).toBeUndefined();
  });

  it("recovery=0 + body_battery_high>0 is degraded, not invalid", () => {
    const result = validateMetrics({
      ...goodMetrics,
      recovery_score: 0,
      body_battery_high: 50,
      resting_heart_rate: 60,
    });
    expect(result.valid).toBe(true);
    expect(result.quality).toBe(0.4);
  });
});

// ---------------------------------------------------------------------------
// validateLoad
// ---------------------------------------------------------------------------

describe("validateLoad", () => {
  it("returns null for empty array (absent)", () => {
    expect(validateLoad([])).toBeNull();
  });

  it("returns degraded for negative TSS", () => {
    const result = validateLoad([
      { date: "2026-03-19", workouts_count: 1, total_duration_seconds: 3600, total_tss: -50 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
    expect(result!.quality).toBe(0.5);
    expect(result!.invalid_reason).toBe("negative_tss");
  });

  it("returns valid quality 1.0 for normal load", () => {
    const result = validateLoad(makeLoad(100));
    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
    expect(result!.quality).toBe(1.0);
  });

  it("detects negative TSS in any entry", () => {
    const result = validateLoad([
      { date: "2026-03-19", workouts_count: 1, total_duration_seconds: 3600, total_tss: 50 },
      { date: "2026-03-18", workouts_count: 1, total_duration_seconds: 3600, total_tss: -10 },
    ]);
    expect(result!.quality).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// computeSignalValidityReport (orchestrator)
// ---------------------------------------------------------------------------

describe("computeSignalValidityReport", () => {
  it("returns null for absent signals", () => {
    const report = computeSignalValidityReport(null, null, null, []);
    expect(report.sleep).toBeNull();
    expect(report.hrv).toBeNull();
    expect(report.metrics).toBeNull();
    expect(report.load).toBeNull();
  });

  it("populates all fields when all signals present", () => {
    const report = computeSignalValidityReport(goodSleep, goodHrv, goodMetrics, makeLoad(100));
    expect(report.sleep).not.toBeNull();
    expect(report.hrv).not.toBeNull();
    expect(report.metrics).not.toBeNull();
    expect(report.load).not.toBeNull();
  });

  it("marks invalid sleep correctly in report", () => {
    const report = computeSignalValidityReport(
      { ...goodSleep, sleep_score: 0, duration_seconds: 0 },
      goodHrv,
      goodMetrics,
      makeLoad(100),
    );
    expect(report.sleep!.valid).toBe(false);
    expect(report.hrv!.valid).toBe(true);
    expect(report.metrics!.valid).toBe(true);
  });

  it("marks invalid HRV correctly in report", () => {
    const report = computeSignalValidityReport(
      goodSleep,
      { ...goodHrv, hrv_rmssd: 0 },
      goodMetrics,
      makeLoad(100),
    );
    expect(report.sleep!.valid).toBe(true);
    expect(report.hrv!.valid).toBe(false);
  });
});
