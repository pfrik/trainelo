import { describe, it, expect } from "vitest";
import {
  linearSlope,
  detectHrvDeclining,
  detectTrainingLoadLow,
  detectStreakRisk,
  detectAdaptationPhase,
  type HrvHistoryEntry,
} from "./detectTrends";

// ---------------------------------------------------------------------------
// linearSlope
// ---------------------------------------------------------------------------

describe("linearSlope", () => {
  it("returns null for empty array", () => {
    expect(linearSlope([])).toBeNull();
  });

  it("returns null for single value", () => {
    expect(linearSlope([42])).toBeNull();
  });

  it("returns 0 for constant values", () => {
    expect(linearSlope([5, 5, 5, 5])).toBe(0);
  });

  it("returns positive slope for increasing values", () => {
    const slope = linearSlope([10, 20, 30, 40]);
    expect(slope).toBe(10);
  });

  it("returns negative slope for decreasing values", () => {
    const slope = linearSlope([40, 30, 20, 10]);
    expect(slope).toBe(-10);
  });

  it("handles two-point case", () => {
    const slope = linearSlope([0, 6]);
    expect(slope).toBe(6);
  });

  it("returns best-fit slope for noisy data", () => {
    // Roughly increasing: 10, 12, 11, 14, 13
    const slope = linearSlope([10, 12, 11, 14, 13]);
    expect(slope).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// detectHrvDeclining
// ---------------------------------------------------------------------------

describe("detectHrvDeclining", () => {
  function makeHistory(values: number[]): HrvHistoryEntry[] {
    // values are newest-first (as returned by DB query)
    return values.map((v, i) => ({
      date: `2026-03-${String(18 - i).padStart(2, "0")}`,
      hrv_rmssd: v,
    }));
  }

  it("returns null for < 4 data points", () => {
    expect(detectHrvDeclining(makeHistory([50, 48, 45]))).toBeNull();
  });

  it("returns null for stable HRV", () => {
    expect(detectHrvDeclining(makeHistory([50, 51, 49, 50, 50]))).toBeNull();
  });

  it("returns null for rising HRV", () => {
    expect(detectHrvDeclining(makeHistory([60, 55, 50, 45, 40]))).toBeNull();
  });

  it("fires HRV_DECLINING for >10% drop over 5 days", () => {
    // Oldest-first after reverse: 50, 48, 44, 40, 35
    // Mean ~43.4, slope ~-3.5/day → ~-8%/day (well above 2%)
    const result = detectHrvDeclining(makeHistory([35, 40, 44, 48, 50]));
    expect(result).toBe("HRV_DECLINING");
  });

  it("fires HRV_DECLINING for consistent daily drops", () => {
    // 50 → 48 → 46 → 44 → 42 = -2/day, mean 46, slope/mean = -4.3%/day
    const result = detectHrvDeclining(makeHistory([42, 44, 46, 48, 50]));
    expect(result).toBe("HRV_DECLINING");
  });

  it("does not fire for small decline under threshold", () => {
    // 50 → 49.5 → 49 → 48.5 → 48 = -0.5/day, mean 49, slope/mean ~-1%/day
    const result = detectHrvDeclining(makeHistory([48, 48.5, 49, 49.5, 50]));
    expect(result).toBeNull();
  });

  it("handles exactly 4 data points", () => {
    // 50, 44, 38, 32 → strong decline
    const result = detectHrvDeclining(makeHistory([32, 38, 44, 50]));
    expect(result).toBe("HRV_DECLINING");
  });

  it("caps at 7 data points", () => {
    // 8 entries, but only 7 used
    const values = [30, 35, 40, 45, 50, 55, 60, 65];
    const result = detectHrvDeclining(makeHistory(values));
    // Still declining (newest 30, oldest 65 → strong negative slope)
    expect(result).toBe("HRV_DECLINING");
  });

  it("returns null for zero mean", () => {
    const result = detectHrvDeclining(makeHistory([0, 0, 0, 0]));
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectTrainingLoadLow
// ---------------------------------------------------------------------------

describe("detectTrainingLoadLow", () => {
  it("returns null when chronicLoad28d is null", () => {
    expect(detectTrainingLoadLow(null, 500)).toBeNull();
  });

  it("returns null when priorChronicLoad28d is null", () => {
    expect(detectTrainingLoadLow(300, null)).toBeNull();
  });

  it("returns null when both are null", () => {
    expect(detectTrainingLoadLow(null, null)).toBeNull();
  });

  it("returns null when priorChronicLoad28d is 0", () => {
    expect(detectTrainingLoadLow(100, 0)).toBeNull();
  });

  it("fires TRAINING_LOAD_LOW when current < 60% of prior", () => {
    expect(detectTrainingLoadLow(250, 500)).toBe("TRAINING_LOAD_LOW");
  });

  it("does not fire when current >= 60% of prior", () => {
    expect(detectTrainingLoadLow(300, 500)).toBeNull();
  });

  it("does not fire at exactly 60%", () => {
    expect(detectTrainingLoadLow(300, 500)).toBeNull();
  });

  it("fires at 59%", () => {
    expect(detectTrainingLoadLow(295, 500)).toBe("TRAINING_LOAD_LOW");
  });

  it("returns null when priorChronicLoad28d is negative", () => {
    expect(detectTrainingLoadLow(100, -100)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectStreakRisk
// ---------------------------------------------------------------------------

describe("detectStreakRisk", () => {
  it("returns null for null input", () => {
    expect(detectStreakRisk(null)).toBeNull();
  });

  it("returns null for 0 days", () => {
    expect(detectStreakRisk(0)).toBeNull();
  });

  it("returns null for 4 consecutive days", () => {
    expect(detectStreakRisk(4)).toBeNull();
  });

  it("fires STREAK_RISK at 5 days", () => {
    expect(detectStreakRisk(5)).toBe("STREAK_RISK");
  });

  it("fires STREAK_RISK at 6 days", () => {
    expect(detectStreakRisk(6)).toBe("STREAK_RISK");
  });

  it("fires STREAK_RISK at 10 days", () => {
    expect(detectStreakRisk(10)).toBe("STREAK_RISK");
  });
});

// ---------------------------------------------------------------------------
// detectAdaptationPhase
// ---------------------------------------------------------------------------

describe("detectAdaptationPhase", () => {
  it("returns null when chronicLoad28d is null", () => {
    expect(detectAdaptationPhase(null, 500, "mature")).toBeNull();
  });

  it("returns null when priorChronicLoad28d is null", () => {
    expect(detectAdaptationPhase(600, null, "mature")).toBeNull();
  });

  it("returns null when priorChronicLoad28d is 0", () => {
    expect(detectAdaptationPhase(600, 0, "mature")).toBeNull();
  });

  it("returns null when baselineMode is cold_start", () => {
    expect(detectAdaptationPhase(700, 500, "cold_start")).toBeNull();
  });

  it("returns null when baselineMode is null", () => {
    expect(detectAdaptationPhase(700, 500, null)).toBeNull();
  });

  it("fires ADAPTATION_PHASE when load increased ≥120% in mature mode", () => {
    expect(detectAdaptationPhase(600, 500, "mature")).toBe("ADAPTATION_PHASE");
  });

  it("fires ADAPTATION_PHASE when load increased ≥120% in building mode", () => {
    expect(detectAdaptationPhase(600, 500, "building")).toBe("ADAPTATION_PHASE");
  });

  it("does not fire when load increase is < 120%", () => {
    expect(detectAdaptationPhase(550, 500, "mature")).toBeNull();
  });

  it("fires at exactly 120%", () => {
    expect(detectAdaptationPhase(600, 500, "mature")).toBe("ADAPTATION_PHASE");
  });

  it("does not fire when load decreased", () => {
    expect(detectAdaptationPhase(400, 500, "mature")).toBeNull();
  });

  it("does not fire when load is stable", () => {
    expect(detectAdaptationPhase(500, 500, "mature")).toBeNull();
  });

  it("returns null when priorChronicLoad28d is negative", () => {
    expect(detectAdaptationPhase(600, -100, "mature")).toBeNull();
  });
});
