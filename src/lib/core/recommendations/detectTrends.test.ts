import { describe, it, expect } from "vitest";
import {
  linearSlope,
  detectHrvDeclining,
  detectTrainingLoadLow,
  detectStreakRisk,
  detectAdaptationPhase,
  exceedsTrivialBand,
  detectHrvDecliningPersistent,
  computeTrendStates,
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

// ---------------------------------------------------------------------------
// exceedsTrivialBand
// ---------------------------------------------------------------------------

describe("exceedsTrivialBand", () => {
  it("returns false when total change is within 5% of baseline", () => {
    // slope=-0.5, window=5, totalChange=0.5*4=2. baseline=50 → band=2.5. 2<2.5
    expect(exceedsTrivialBand(-0.5, 50, 50, 5)).toBe(false);
  });

  it("returns true when total change exceeds 5% of baseline", () => {
    // slope=-2, window=5, totalChange=2*4=8. baseline=50 → band=2.5. 8>2.5
    expect(exceedsTrivialBand(-2, 50, 50, 5)).toBe(true);
  });

  it("uses absolute floor of 2ms when baseline is very low", () => {
    // baseline=10, 5%=0.5 → floor=2. slope=-0.4, window=5, totalChange=0.4*4=1.6. 1.6<2
    expect(exceedsTrivialBand(-0.4, 10, 10, 5)).toBe(false);
  });

  it("returns true when exceeding absolute floor", () => {
    // baseline=10, floor=2. slope=-1, window=5, totalChange=1*4=4. 4>2
    expect(exceedsTrivialBand(-1, 10, 10, 5)).toBe(true);
  });

  it("falls back to mean when no baseline", () => {
    // mean=50, no baseline → reference=50. band=2.5. slope=-1, totalChange=4. 4>2.5
    expect(exceedsTrivialBand(-1, 50, null, 5)).toBe(true);
  });

  it("falls back to mean when baseline is 0", () => {
    expect(exceedsTrivialBand(-1, 50, 0, 5)).toBe(true);
  });

  it("returns false when reference is 0", () => {
    expect(exceedsTrivialBand(-1, 0, null, 5)).toBe(false);
  });

  it("handles positive slopes correctly", () => {
    // slope=+3, window=5, totalChange=12. baseline=50, band=2.5. 12>2.5
    expect(exceedsTrivialBand(3, 50, 50, 5)).toBe(true);
  });

  it("uses baseline over mean when both available", () => {
    // baseline=100 → band=5. slope=-1, window=5, totalChange=4. 4<5 → false
    // If mean were used (mean=40 → band=2), it would be true
    expect(exceedsTrivialBand(-1, 40, 100, 5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectHrvDecliningPersistent
// ---------------------------------------------------------------------------

describe("detectHrvDecliningPersistent", () => {
  function makeHistory(values: number[]): HrvHistoryEntry[] {
    return values.map((v, i) => ({
      date: `2026-03-${String(18 - i).padStart(2, "0")}`,
      hrv_rmssd: v,
    }));
  }

  it("returns no detection for < 4 entries", () => {
    const result = detectHrvDecliningPersistent(makeHistory([50, 48, 45]));
    expect(result.code).toBeNull();
    expect(result.windows).toBe(0);
  });

  it("fires with exactly 4 entries (single window) for strong decline", () => {
    // 32, 38, 44, 50 → reversed: 50, 44, 38, 32. slope=-6/day, mean=41
    const result = detectHrvDecliningPersistent(makeHistory([32, 38, 44, 50]));
    expect(result.code).toBe("HRV_DECLINING");
    expect(result.windows).toBe(1);
    expect(result.hits).toBe(1);
  });

  it("confirms with 3-of-5 sub-windows for consistent decline", () => {
    // 8 data points, strong consistent decline (newest-first)
    // Reversed oldest-first: 70, 65, 60, 55, 50, 45, 40, 35
    const result = detectHrvDecliningPersistent(
      makeHistory([35, 40, 45, 50, 55, 60, 65, 70]),
    );
    expect(result.code).toBe("HRV_DECLINING");
    expect(result.hits).toBeGreaterThanOrEqual(3);
  });

  it("does not confirm when intermittent noise prevents persistence", () => {
    // Mostly stable with one dip → most sub-windows shouldn't fire
    // Reversed oldest-first: 50, 51, 49, 50, 50, 49, 51, 50
    const result = detectHrvDecliningPersistent(
      makeHistory([50, 51, 49, 50, 50, 49, 51, 50]),
    );
    expect(result.code).toBeNull();
  });

  it("caps at 10 entries", () => {
    // 12 entries, but only 10 used → 7 sub-windows
    const values = Array.from({ length: 12 }, (_, i) => 70 - i * 4); // newest-first decline
    const result = detectHrvDecliningPersistent(makeHistory(values));
    expect(result.windows).toBe(7); // 10 - 4 + 1
  });

  it("respects trivial band with baseline", () => {
    // Very small decline: 50→49.5→49→48.5 over 4 days with high baseline=200
    // band = max(200*0.05, 2) = 10. totalChange per window ≈ 0.5*3=1.5 < 10
    const result = detectHrvDecliningPersistent(
      makeHistory([48.5, 49, 49.5, 50]),
      200, // high baseline makes band=10
    );
    expect(result.code).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeTrendStates
// ---------------------------------------------------------------------------

describe("computeTrendStates", () => {
  function makeHistory(values: number[]): HrvHistoryEntry[] {
    return values.map((v, i) => ({
      date: `2026-03-${String(18 - i).padStart(2, "0")}`,
      hrv_rmssd: v,
    }));
  }

  it("returns empty array when no inputs provided", () => {
    const states = computeTrendStates(null, null, null, null, null, null);
    expect(states).toEqual([]);
  });

  it("includes HRV trend state for declining HRV", () => {
    const history = makeHistory([32, 38, 44, 50, 56, 62, 68, 74]);
    const states = computeTrendStates(history, null, null, null, null, null);
    const hrv = states.find((s) => s.metric === "hrv");
    expect(hrv).toBeDefined();
    expect(hrv!.direction).toBe("declining");
  });

  it("includes HRV trend state for stable HRV", () => {
    const history = makeHistory([50, 51, 49, 50, 50]);
    const states = computeTrendStates(history, null, null, null, null, null);
    const hrv = states.find((s) => s.metric === "hrv");
    expect(hrv).toBeDefined();
    expect(hrv!.direction).toBe("stable");
  });

  it("includes HRV trend state for rising HRV", () => {
    // Newest-first, rising: 74, 68, 62, 56, 50 → reversed: 50, 56, 62, 68, 74
    const history = makeHistory([74, 68, 62, 56, 50]);
    const states = computeTrendStates(history, null, null, null, null, null);
    const hrv = states.find((s) => s.metric === "hrv");
    expect(hrv).toBeDefined();
    expect(hrv!.direction).toBe("rising");
  });

  it("skips HRV trend with < 4 entries", () => {
    const history = makeHistory([50, 48, 45]);
    const states = computeTrendStates(history, null, null, null, null, null);
    expect(states.find((s) => s.metric === "hrv")).toBeUndefined();
  });

  it("includes training_load trend — declining", () => {
    const states = computeTrendStates(null, null, 200, 500, null, "mature");
    const load = states.find((s) => s.metric === "training_load");
    expect(load).toBeDefined();
    expect(load!.direction).toBe("declining");
    expect(load!.confirmation).toBe("confirmed");
    expect(load!.reason_code).toBe("TRAINING_LOAD_LOW");
  });

  it("includes training_load trend — rising with adaptation", () => {
    const states = computeTrendStates(null, null, 600, 400, null, "mature");
    const load = states.find((s) => s.metric === "training_load");
    expect(load).toBeDefined();
    expect(load!.direction).toBe("rising");
    expect(load!.reason_code).toBe("ADAPTATION_PHASE");
  });

  it("training_load rising without adaptation in cold_start", () => {
    const states = computeTrendStates(null, null, 600, 400, null, "cold_start");
    const load = states.find((s) => s.metric === "training_load");
    expect(load).toBeDefined();
    expect(load!.direction).toBe("rising");
    expect(load!.reason_code).toBeNull();
  });

  it("includes training_load trend — stable", () => {
    const states = computeTrendStates(null, null, 500, 500, null, "mature");
    const load = states.find((s) => s.metric === "training_load");
    expect(load).toBeDefined();
    expect(load!.direction).toBe("stable");
    expect(load!.reason_code).toBeNull();
  });

  it("includes streak trend — rising at 5 days", () => {
    const states = computeTrendStates(null, null, null, null, 5, null);
    const streak = states.find((s) => s.metric === "streak");
    expect(streak).toBeDefined();
    expect(streak!.direction).toBe("rising");
    expect(streak!.reason_code).toBe("STREAK_RISK");
  });

  it("includes streak trend — stable at 3 days", () => {
    const states = computeTrendStates(null, null, null, null, 3, null);
    const streak = states.find((s) => s.metric === "streak");
    expect(streak).toBeDefined();
    expect(streak!.direction).toBe("stable");
    expect(streak!.reason_code).toBeNull();
  });

  it("HRV confirmed when persistent detection fires", () => {
    // Strong consistent decline over 8 entries
    const history = makeHistory([35, 40, 45, 50, 55, 60, 65, 70]);
    const states = computeTrendStates(history, null, null, null, null, null);
    const hrv = states.find((s) => s.metric === "hrv");
    expect(hrv!.confirmation).toBe("confirmed");
    expect(hrv!.reason_code).toBe("HRV_DECLINING");
  });

  it("HRV tentative when persistent detection does not fire", () => {
    // Mild decline — direction=declining but persistence doesn't confirm
    // slope ~-1.2%/day (above -1% for declining direction, but below -2% for persistence)
    const history = makeHistory([47, 47.5, 48, 49, 50]);
    const states = computeTrendStates(history, null, null, null, null, null);
    const hrv = states.find((s) => s.metric === "hrv");
    expect(hrv!.confirmation).toBe("tentative");
    expect(hrv!.reason_code).toBeNull();
  });

  it("persistence_detail shows hits_of_windows for HRV", () => {
    const history = makeHistory([35, 40, 45, 50, 55, 60, 65, 70]);
    const states = computeTrendStates(history, null, null, null, null, null);
    const hrv = states.find((s) => s.metric === "hrv");
    expect(hrv!.persistence_detail).toMatch(/^\d+_of_\d+$/);
  });

  it("persistence_detail shows 28d_aggregate for training_load", () => {
    const states = computeTrendStates(null, null, 500, 500, null, "mature");
    const load = states.find((s) => s.metric === "training_load");
    expect(load!.persistence_detail).toBe("28d_aggregate");
  });

  it("persistence_detail shows consecutive days for streak", () => {
    const states = computeTrendStates(null, null, null, null, 6, null);
    const streak = states.find((s) => s.metric === "streak");
    expect(streak!.persistence_detail).toBe("6d_consecutive");
  });
});
