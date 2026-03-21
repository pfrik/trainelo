import { describe, it, expect } from "vitest";
import {
  detectHRMax,
  detectRestingHR,
  detectHRVBaseline,
  hasSignificantChange,
  computeConfidenceScore,
} from "./detectThresholds";
import type {
  WorkoutHRSample,
  RestingHRSample,
  HRVSample,
} from "./types";

// ============================================================================
// Fixtures
// ============================================================================

const REF_DATE = "2026-03-15";

function makeWorkoutSamples(count: number, baseHR: number = 180): WorkoutHRSample[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-03-${String(15 - i).padStart(2, "0")}`,
    max_heart_rate: baseHR + (i % 3) - 1, // slight variation
    duration_seconds: 1800, // 30 min
  }));
}

function makeRHRSamples(count: number, baseHR: number = 52): RestingHRSample[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-03-${String(15 - i).padStart(2, "0")}`,
    resting_heart_rate: baseHR + (i % 3) - 1,
  }));
}

function makeHRVSamples(count: number, baseHRV: number = 45): HRVSample[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-03-${String(15 - i).padStart(2, "0")}`,
    hrv_rmssd: baseHRV + (i % 5) - 2,
  }));
}

// ============================================================================
// HR Max Detection
// ============================================================================

describe("detectHRMax", () => {
  it("returns null with fewer than 3 valid samples", () => {
    const samples = makeWorkoutSamples(2);
    expect(detectHRMax(samples, REF_DATE)).toBeNull();
  });

  it("returns null when no samples", () => {
    expect(detectHRMax([], REF_DATE)).toBeNull();
  });

  it("detects HR max as average of top 2 values", () => {
    const samples: WorkoutHRSample[] = [
      { date: "2026-03-15", max_heart_rate: 185, duration_seconds: 1800 },
      { date: "2026-03-14", max_heart_rate: 190, duration_seconds: 1800 },
      { date: "2026-03-13", max_heart_rate: 188, duration_seconds: 1800 },
      { date: "2026-03-12", max_heart_rate: 170, duration_seconds: 1800 },
    ];
    const result = detectHRMax(samples, REF_DATE)!;
    // Top 2: 190, 188 → average = 189
    expect(result.value).toBe(189);
    expect(result.dataPoints).toBe(4);
    expect(result.method).toBe("top2_average");
  });

  it("filters out workouts shorter than 10 minutes", () => {
    const samples: WorkoutHRSample[] = [
      { date: "2026-03-15", max_heart_rate: 195, duration_seconds: 300 }, // 5 min — filtered
      { date: "2026-03-14", max_heart_rate: 185, duration_seconds: 1800 },
      { date: "2026-03-13", max_heart_rate: 188, duration_seconds: 1800 },
      { date: "2026-03-12", max_heart_rate: 182, duration_seconds: 1800 },
    ];
    const result = detectHRMax(samples, REF_DATE)!;
    // Filtered: only 3 valid. Top 2: 188, 185 → average = 187 (rounded)
    expect(result.value).toBe(187);
    expect(result.dataPoints).toBe(3);
  });

  it("filters out HR below 100 or above 230", () => {
    const samples: WorkoutHRSample[] = [
      { date: "2026-03-15", max_heart_rate: 80, duration_seconds: 1800 },  // too low
      { date: "2026-03-14", max_heart_rate: 240, duration_seconds: 1800 }, // too high
      { date: "2026-03-13", max_heart_rate: 185, duration_seconds: 1800 },
      { date: "2026-03-12", max_heart_rate: 182, duration_seconds: 1800 },
      { date: "2026-03-11", max_heart_rate: 178, duration_seconds: 1800 },
    ];
    const result = detectHRMax(samples, REF_DATE)!;
    expect(result.value).toBe(184); // Top 2: 185, 182 → 183.5 → 184
    expect(result.dataPoints).toBe(3);
  });

  it("returns high confidence with many consistent samples", () => {
    // Need 3 min + 8 extra = 11 samples to reach 0.7 base
    const samples = makeWorkoutSamples(12, 185);
    const result = detectHRMax(samples, REF_DATE)!;
    expect(result.confidence.level).toBe("high");
    expect(result.confidence.score).toBeGreaterThanOrEqual(0.7);
  });

  it("reduces confidence for stale data", () => {
    const samples: WorkoutHRSample[] = [
      { date: "2026-02-01", max_heart_rate: 185, duration_seconds: 1800 },
      { date: "2026-02-02", max_heart_rate: 188, duration_seconds: 1800 },
      { date: "2026-02-03", max_heart_rate: 182, duration_seconds: 1800 },
    ];
    const result = detectHRMax(samples, REF_DATE)!;
    // Newest sample > 30 days ago → recency penalty
    expect(result.confidence.score).toBeLessThan(0.5);
  });
});

// ============================================================================
// Resting HR Detection
// ============================================================================

describe("detectRestingHR", () => {
  it("returns null with fewer than 7 valid samples", () => {
    const samples = makeRHRSamples(6);
    expect(detectRestingHR(samples, REF_DATE)).toBeNull();
  });

  it("detects resting HR as median", () => {
    const samples: RestingHRSample[] = [
      { date: "2026-03-15", resting_heart_rate: 52 },
      { date: "2026-03-14", resting_heart_rate: 54 },
      { date: "2026-03-13", resting_heart_rate: 50 },
      { date: "2026-03-12", resting_heart_rate: 53 },
      { date: "2026-03-11", resting_heart_rate: 51 },
      { date: "2026-03-10", resting_heart_rate: 55 },
      { date: "2026-03-09", resting_heart_rate: 52 },
    ];
    const result = detectRestingHR(samples, REF_DATE)!;
    // Sorted: 50, 51, 52, 52, 53, 54, 55 → median = 52
    expect(result.value).toBe(52);
    expect(result.method).toBe("median_14d");
  });

  it("filters out RHR below 30 or above 120", () => {
    const samples: RestingHRSample[] = [
      { date: "2026-03-15", resting_heart_rate: 25 },  // too low
      { date: "2026-03-14", resting_heart_rate: 130 }, // too high
      ...makeRHRSamples(7),
    ];
    const result = detectRestingHR(samples, REF_DATE)!;
    expect(result.dataPoints).toBe(7); // Only valid ones counted
  });

  it("is robust to outliers due to median", () => {
    const samples: RestingHRSample[] = [
      { date: "2026-03-15", resting_heart_rate: 52 },
      { date: "2026-03-14", resting_heart_rate: 100 }, // outlier
      { date: "2026-03-13", resting_heart_rate: 50 },
      { date: "2026-03-12", resting_heart_rate: 53 },
      { date: "2026-03-11", resting_heart_rate: 51 },
      { date: "2026-03-10", resting_heart_rate: 55 },
      { date: "2026-03-09", resting_heart_rate: 52 },
    ];
    const result = detectRestingHR(samples, REF_DATE)!;
    // Sorted: 50, 51, 52, 52, 53, 55, 100 → median = 52
    expect(result.value).toBe(52);
  });

  it("returns high confidence with many recent consistent samples", () => {
    // Need 7 min + 8 extra = 15 samples to reach 0.7 base
    const samples = makeRHRSamples(16, 52);
    const result = detectRestingHR(samples, REF_DATE)!;
    expect(result.confidence.level).toBe("high");
  });
});

// ============================================================================
// HRV Baseline Detection
// ============================================================================

describe("detectHRVBaseline", () => {
  it("returns null with fewer than 7 valid samples", () => {
    const samples = makeHRVSamples(6);
    expect(detectHRVBaseline(samples, REF_DATE)).toBeNull();
  });

  it("detects HRV baseline as median", () => {
    const samples: HRVSample[] = [
      { date: "2026-03-15", hrv_rmssd: 42 },
      { date: "2026-03-14", hrv_rmssd: 48 },
      { date: "2026-03-13", hrv_rmssd: 44 },
      { date: "2026-03-12", hrv_rmssd: 46 },
      { date: "2026-03-11", hrv_rmssd: 40 },
      { date: "2026-03-10", hrv_rmssd: 50 },
      { date: "2026-03-09", hrv_rmssd: 45 },
    ];
    const result = detectHRVBaseline(samples, REF_DATE)!;
    // Sorted: 40, 42, 44, 45, 46, 48, 50 → median = 45
    expect(result.value).toBe(45);
    expect(result.method).toBe("median_14d");
  });

  it("filters out HRV below 5 or above 200", () => {
    const samples: HRVSample[] = [
      { date: "2026-03-15", hrv_rmssd: 3 },   // too low
      { date: "2026-03-14", hrv_rmssd: 210 }, // too high
      ...makeHRVSamples(7),
    ];
    const result = detectHRVBaseline(samples, REF_DATE)!;
    expect(result.dataPoints).toBe(7);
  });

  it("applies recency penalty for stale data", () => {
    const samples: HRVSample[] = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-${String(5 - i).padStart(2, "0")}`,
      hrv_rmssd: 45 + i,
    }));
    const result = detectHRVBaseline(samples, REF_DATE)!;
    // Newest sample is March 5, ref is March 15 → 10 days > 3 staleness threshold
    expect(result.confidence.score).toBeLessThan(
      detectHRVBaseline(makeHRVSamples(7), REF_DATE)!.confidence.score,
    );
  });
});

// ============================================================================
// Confidence Scoring
// ============================================================================

describe("computeConfidenceScore", () => {
  it("starts at base 0.3 and increases with extra points", () => {
    const result = computeConfidenceScore([50, 51, 52], 3, REF_DATE, REF_DATE, 3);
    expect(result.score).toBeCloseTo(0.3, 1);
  });

  it("increases score with more data points", () => {
    const result = computeConfidenceScore(
      [50, 51, 52, 53, 54, 55, 56, 57],
      3,
      REF_DATE,
      REF_DATE,
      3,
    );
    // 5 extra points × 0.05 = 0.25, base 0.3 + 0.25 = 0.55
    expect(result.score).toBeCloseTo(0.55, 1);
  });

  it("caps base score at 0.85", () => {
    const values = Array.from({ length: 30 }, (_, i) => 50 + (i % 2));
    const result = computeConfidenceScore(values, 3, REF_DATE, REF_DATE, 3);
    expect(result.score).toBeLessThanOrEqual(0.85);
  });

  it("penalizes high variance", () => {
    // High CoV: values spread widely
    const consistent = computeConfidenceScore([50, 51, 50, 51, 50, 51, 50, 51, 50, 51], 3, REF_DATE, REF_DATE, 3);
    const inconsistent = computeConfidenceScore([30, 70, 35, 65, 40, 60, 45, 55, 50, 50], 3, REF_DATE, REF_DATE, 3);
    expect(inconsistent.score).toBeLessThan(consistent.score);
  });

  it("penalizes stale data", () => {
    const fresh = computeConfidenceScore([50, 51, 52], 3, REF_DATE, REF_DATE, 3);
    const stale = computeConfidenceScore([50, 51, 52], 3, "2026-03-01", REF_DATE, 3);
    expect(stale.score).toBeLessThan(fresh.score);
  });

  it("maps scores to correct levels", () => {
    const low = computeConfidenceScore([50, 51, 52], 3, "2026-02-01", REF_DATE, 3);
    expect(low.level).toBe("low");

    const med = computeConfidenceScore([50, 51, 52, 53, 54, 55, 56], 3, REF_DATE, REF_DATE, 3);
    expect(med.level).toBe("medium");

    const high = computeConfidenceScore(
      Array.from({ length: 14 }, (_, i) => 50 + (i % 2)),
      3,
      REF_DATE,
      REF_DATE,
      3,
    );
    expect(high.level).toBe("high");
  });
});

// ============================================================================
// Significant Change
// ============================================================================

describe("hasSignificantChange", () => {
  it("returns true when no existing value", () => {
    expect(hasSignificantChange("hr_max", 185, null)).toBe(true);
  });

  it("returns true when HR max change >= 2 bpm", () => {
    expect(hasSignificantChange("hr_max", 187, 185)).toBe(true);
    expect(hasSignificantChange("hr_max", 183, 185)).toBe(true);
  });

  it("returns false when HR max change < 2 bpm", () => {
    expect(hasSignificantChange("hr_max", 186, 185)).toBe(false);
    expect(hasSignificantChange("hr_max", 185, 185)).toBe(false);
  });

  it("returns true when RHR change >= 2 bpm", () => {
    expect(hasSignificantChange("resting_hr", 54, 52)).toBe(true);
  });

  it("returns false when RHR change < 2 bpm", () => {
    expect(hasSignificantChange("resting_hr", 53, 52)).toBe(false);
  });

  it("returns true when HRV change >= 3 ms", () => {
    expect(hasSignificantChange("hrv_baseline", 48, 45)).toBe(true);
  });

  it("returns false when HRV change < 3 ms", () => {
    expect(hasSignificantChange("hrv_baseline", 47, 45)).toBe(false);
  });
});
