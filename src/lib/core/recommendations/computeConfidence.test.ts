import { describe, it, expect } from "vitest";
import {
  computeDataAvailability,
  computeSignalConsistency,
  computeDataRecency,
  detectBaselineMode,
  computeCompositeConfidence,
  type ConfidenceBreakdown,
  type BaselineMode,
} from "./computeConfidence";

// ---------------------------------------------------------------------------
// computeDataAvailability
// ---------------------------------------------------------------------------

describe("computeDataAvailability", () => {
  it("returns 0 when no sources present", () => {
    expect(computeDataAvailability(false, false, false, false)).toBe(0);
  });

  it("returns 0.25 for 1 source", () => {
    expect(computeDataAvailability(true, false, false, false)).toBe(0.25);
  });

  it("returns 0.5 for 2 sources", () => {
    expect(computeDataAvailability(true, true, false, false)).toBe(0.5);
  });

  it("returns 0.75 for 3 sources", () => {
    expect(computeDataAvailability(true, true, true, false)).toBe(0.75);
  });

  it("returns 1.0 for all 4 sources", () => {
    expect(computeDataAvailability(true, true, true, true)).toBe(1);
  });

  it("doesn't care which sources are present", () => {
    expect(computeDataAvailability(false, false, true, true)).toBe(0.5);
    expect(computeDataAvailability(false, true, false, true)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// computeSignalConsistency
// ---------------------------------------------------------------------------

describe("computeSignalConsistency", () => {
  it("returns 1.0 for empty array", () => {
    expect(computeSignalConsistency([])).toBe(1.0);
  });

  it("returns 1.0 for single signal", () => {
    expect(computeSignalConsistency([0.8])).toBe(1.0);
  });

  it("returns ~1.0 for identical signals", () => {
    expect(computeSignalConsistency([0.7, 0.7, 0.7])).toBeCloseTo(1.0, 10);
  });

  it("returns ~1.0 for very close signals", () => {
    const result = computeSignalConsistency([0.8, 0.82, 0.79]);
    expect(result).toBeGreaterThan(0.9);
  });

  it("returns lower value for divergent signals", () => {
    // Good HRV (0.9) + poor sleep (0.3) = high stdDev
    const result = computeSignalConsistency([0.9, 0.3]);
    expect(result).toBeLessThan(0.5);
  });

  it("returns 0 when stdDev >= 0.3", () => {
    // 0.0 and 1.0 → stdDev = 0.5
    const result = computeSignalConsistency([0.0, 1.0]);
    expect(result).toBe(0);
  });

  it("returns value between 0 and 1", () => {
    const result = computeSignalConsistency([0.6, 0.4, 0.5]);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("three signals all agreeing at 0.5 returns 1.0", () => {
    expect(computeSignalConsistency([0.5, 0.5, 0.5])).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// computeDataRecency
// ---------------------------------------------------------------------------

describe("computeDataRecency", () => {
  const base = "2026-03-18T12:00:00Z";

  it("returns 1.0 for data < 6h old", () => {
    const latest = "2026-03-18T08:00:00Z"; // 4h ago
    expect(computeDataRecency(latest, base)).toBe(1.0);
  });

  it("returns 1.0 for data exactly at current time", () => {
    expect(computeDataRecency(base, base)).toBe(1.0);
  });

  it("returns 0.9 for data 6-12h old", () => {
    const latest = "2026-03-18T02:00:00Z"; // 10h ago
    expect(computeDataRecency(latest, base)).toBe(0.9);
  });

  it("returns 0.7 for data 12-24h old", () => {
    const latest = "2026-03-17T18:00:00Z"; // 18h ago
    expect(computeDataRecency(latest, base)).toBe(0.7);
  });

  it("returns 0.4 for data 24-48h old", () => {
    const latest = "2026-03-16T18:00:00Z"; // 42h ago
    expect(computeDataRecency(latest, base)).toBe(0.4);
  });

  it("returns 0.2 for data > 48h old", () => {
    const latest = "2026-03-14T12:00:00Z"; // 96h ago
    expect(computeDataRecency(latest, base)).toBe(0.2);
  });

  it("returns 0.2 for invalid timestamps", () => {
    expect(computeDataRecency("not-a-date", base)).toBe(0.2);
    expect(computeDataRecency(base, "not-a-date")).toBe(0.2);
  });

  it("returns 1.0 when latest is in the future", () => {
    const latest = "2026-03-19T12:00:00Z"; // future
    expect(computeDataRecency(latest, base)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// detectBaselineMode
// ---------------------------------------------------------------------------

describe("detectBaselineMode", () => {
  it("returns cold_start for 0 days", () => {
    expect(detectBaselineMode(0)).toBe("cold_start");
  });

  it("returns cold_start for 6 days", () => {
    expect(detectBaselineMode(6)).toBe("cold_start");
  });

  it("returns building for 7 days", () => {
    expect(detectBaselineMode(7)).toBe("building");
  });

  it("returns building for 20 days", () => {
    expect(detectBaselineMode(20)).toBe("building");
  });

  it("returns mature for 21 days", () => {
    expect(detectBaselineMode(21)).toBe("mature");
  });

  it("returns mature for 100 days", () => {
    expect(detectBaselineMode(100)).toBe("mature");
  });
});

// ---------------------------------------------------------------------------
// computeCompositeConfidence
// ---------------------------------------------------------------------------

describe("computeCompositeConfidence", () => {
  const fullComponents = {
    data_availability: 1.0,
    signal_consistency: 1.0,
    data_recency: 1.0,
  };

  const emptyComponents = {
    data_availability: 0,
    signal_consistency: 0,
    data_recency: 0,
  };

  it("returns overall 1.0 for perfect inputs regardless of mode", () => {
    for (const mode of ["cold_start", "building", "mature"] as BaselineMode[]) {
      const result = computeCompositeConfidence(fullComponents, mode);
      expect(result.overall).toBe(1.0);
    }
  });

  it("returns overall 0 for zero inputs regardless of mode", () => {
    for (const mode of ["cold_start", "building", "mature"] as BaselineMode[]) {
      const result = computeCompositeConfidence(emptyComponents, mode);
      expect(result.overall).toBe(0);
    }
  });

  it("cold_start emphasizes data_availability", () => {
    const onlyAvail = {
      data_availability: 1.0,
      signal_consistency: 0,
      data_recency: 0,
    };
    const result = computeCompositeConfidence(onlyAvail, "cold_start");
    expect(result.overall).toBe(0.6);
  });

  it("mature emphasizes signal_consistency", () => {
    const onlyConsistency = {
      data_availability: 0,
      signal_consistency: 1.0,
      data_recency: 0,
    };
    const result = computeCompositeConfidence(onlyConsistency, "mature");
    expect(result.overall).toBe(0.4);
  });

  it("building uses balanced weights", () => {
    const onlyRecency = {
      data_availability: 0,
      signal_consistency: 0,
      data_recency: 1.0,
    };
    const result = computeCompositeConfidence(onlyRecency, "building");
    expect(result.overall).toBe(0.3);
  });

  it("preserves component values in breakdown", () => {
    const components = {
      data_availability: 0.75,
      signal_consistency: 0.5,
      data_recency: 0.9,
    };
    const result = computeCompositeConfidence(components, "mature");
    expect(result.data_availability).toBe(0.75);
    expect(result.signal_consistency).toBe(0.5);
    expect(result.data_recency).toBe(0.9);
  });

  it("clamps overall to [0, 1]", () => {
    const result = computeCompositeConfidence(fullComponents, "cold_start");
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(1);
  });

  it("overall has at most 3 decimal places", () => {
    const components = {
      data_availability: 0.333,
      signal_consistency: 0.666,
      data_recency: 0.777,
    };
    const result = computeCompositeConfidence(components, "building");
    const decimals = result.overall.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(3);
  });
});
