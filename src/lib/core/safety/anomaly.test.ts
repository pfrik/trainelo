import { describe, it, expect } from "vitest";
import { detectAnomalies, type AnomalyResult } from "./anomaly";
import type { ReadinessAndFatigueOutput } from "../recommendations/computeReadinessAndFatigue";
import type { TrendState } from "../recommendations/detectTrends";
import type { ConfidenceBreakdown } from "../recommendations/computeConfidence";
import type { NormalizedEwmaResult } from "../recommendations/computeEwma";
import type { SignalValidityReport } from "../recommendations/computeSignalValidity";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeConfidence(overall: number): ConfidenceBreakdown {
  return {
    overall,
    data_availability: overall,
    signal_consistency: overall,
    data_recency: overall,
  };
}

function makeHrvTrend(
  direction: TrendState["direction"],
  confirmation: TrendState["confirmation"],
): TrendState {
  return {
    metric: "hrv",
    direction,
    confirmation,
    persistence_detail: "test",
    reason_code: direction === "declining" && confirmation === "confirmed" ? "HRV_DECLINING" : null,
  };
}

function makeValidity(hrvQuality: number): SignalValidityReport {
  return {
    sleep: null,
    hrv: { valid: true, quality: hrvQuality },
    metrics: null,
    load: null,
  };
}

function makeEwma(formScore: number): NormalizedEwmaResult {
  return {
    fitness_score: 50,
    fatigue_score: 50,
    form_score: formScore,
    fitness_raw: 50,
    fatigue_raw: 50,
    form_raw: 0,
    data_days: 30,
    cold_start_fatigue: false,
    cold_start_fitness: false,
  };
}

/** Healthy baseline: no anomalies should fire. */
function healthyInput(): ReadinessAndFatigueOutput {
  return {
    readiness_score: 75,
    fatigue_score: 30,
    reason_codes: ["RECOVERY_OPTIMAL"],
    confidence: makeConfidence(0.7),
    baseline_mode: "mature",
    ewma: makeEwma(10),
    signal_validity: makeValidity(1.0),
    trend_states: [makeHrvTrend("stable", "confirmed")],
  };
}

/** Input that fires Rule 1 (HRV_DISSOCIATION). */
function dissociationInput(): ReadinessAndFatigueOutput {
  return {
    readiness_score: 70,
    fatigue_score: 30,
    reason_codes: ["RECOVERY_OPTIMAL"],
    confidence: makeConfidence(0.6),
    baseline_mode: "mature",
    ewma: makeEwma(10),
    signal_validity: makeValidity(0.8),
    trend_states: [makeHrvTrend("declining", "confirmed")],
  };
}

/** Input that fires Rule 2 (OVERTRAINING_RISK). */
function overtrainingInput(): ReadinessAndFatigueOutput {
  return {
    readiness_score: 50,
    fatigue_score: 65,
    reason_codes: ["FATIGUE_ELEVATED"],
    confidence: makeConfidence(0.6),
    baseline_mode: "mature",
    ewma: makeEwma(-20),
    signal_validity: makeValidity(0.8),
    trend_states: [makeHrvTrend("declining", "confirmed")],
  };
}

/** Input that fires Rule 3 (LOW_CONFIDENCE). */
function lowConfidenceInput(): ReadinessAndFatigueOutput {
  return {
    readiness_score: 60,
    fatigue_score: 40,
    reason_codes: ["RECOVERY_OPTIMAL"],
    confidence: makeConfidence(0.2),
    baseline_mode: "building",
    ewma: makeEwma(5),
    signal_validity: makeValidity(0.5),
    trend_states: [makeHrvTrend("stable", "tentative")],
  };
}

const NONE_RESULT: AnomalyResult = {
  caution_level: "none",
  reason_codes: [],
  restrictions: [],
  question_key: null,
};

// =========================================================================
// FALSE-POSITIVE PREVENTION
// =========================================================================
describe("detectAnomalies — false-positive prevention", () => {
  it("returns none for healthy input", () => {
    expect(detectAnomalies(healthyInput())).toEqual(NONE_RESULT);
  });

  it("does not fire HRV_DISSOCIATION when HRV trend is tentative", () => {
    const input = dissociationInput();
    input.trend_states = [makeHrvTrend("declining", "tentative")];
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });

  it("does not fire HRV_DISSOCIATION when readiness < 65", () => {
    const input = dissociationInput();
    input.readiness_score = 64;
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });

  it("does not fire HRV_DISSOCIATION when confidence < 0.5", () => {
    const input = dissociationInput();
    input.confidence = makeConfidence(0.49);
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });

  it("does not fire HRV_DISSOCIATION when HRV quality < 0.6", () => {
    const input = dissociationInput();
    input.signal_validity = makeValidity(0.59);
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });

  it("does not fire OVERTRAINING_RISK when confidence < 0.5", () => {
    const input = overtrainingInput();
    input.confidence = makeConfidence(0.49);
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });

  it("does not fire LOW_CONFIDENCE in cold_start mode", () => {
    const input = lowConfidenceInput();
    input.baseline_mode = "cold_start";
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });

  it("does not fire LOW_CONFIDENCE when COLD_START reason code is present", () => {
    const input = lowConfidenceInput();
    input.reason_codes = ["COLD_START"];
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });

  it("gracefully returns none when optional fields are missing", () => {
    const input: ReadinessAndFatigueOutput = {
      readiness_score: 75,
      fatigue_score: 30,
      reason_codes: ["RECOVERY_OPTIMAL"],
    };
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });

  it("returns none when trend_states is empty array", () => {
    const input = healthyInput();
    input.trend_states = [];
    expect(detectAnomalies(input)).toEqual(NONE_RESULT);
  });
});

// =========================================================================
// FIRES CORRECTLY
// =========================================================================
describe("detectAnomalies — fires correctly", () => {
  it("fires HRV_DISSOCIATION with correct output", () => {
    const result = detectAnomalies(dissociationInput());
    expect(result.caution_level).toBe("moderate");
    expect(result.reason_codes).toEqual(["ANOMALY_HRV_DISSOCIATION"]);
    expect(result.restrictions).toEqual(["cap_intensity"]);
    expect(result.question_key).toBe("how_do_you_feel_today");
  });

  it("fires OVERTRAINING_RISK with correct output", () => {
    const result = detectAnomalies(overtrainingInput());
    expect(result.caution_level).toBe("high");
    expect(result.reason_codes).toEqual(["ANOMALY_OVERTRAINING_RISK"]);
    expect(result.restrictions).toEqual(["cap_intensity", "suggest_rest"]);
    expect(result.question_key).toBeNull();
  });

  it("fires LOW_CONFIDENCE_ANOMALY with correct output", () => {
    const result = detectAnomalies(lowConfidenceInput());
    expect(result.caution_level).toBe("low");
    expect(result.reason_codes).toEqual(["ANOMALY_LOW_CONFIDENCE"]);
    expect(result.restrictions).toEqual(["require_checkin"]);
    expect(result.question_key).toBe("data_seems_stale");
  });

  it("fires LOW_CONFIDENCE_ANOMALY in mature mode", () => {
    const input = lowConfidenceInput();
    input.baseline_mode = "mature";
    const result = detectAnomalies(input);
    expect(result.reason_codes).toContain("ANOMALY_LOW_CONFIDENCE");
  });

  it("fires HRV_DISSOCIATION at exact readiness=65 threshold", () => {
    const input = dissociationInput();
    input.readiness_score = 65;
    const result = detectAnomalies(input);
    expect(result.reason_codes).toContain("ANOMALY_HRV_DISSOCIATION");
  });

  it("fires OVERTRAINING_RISK at exact form=-16 (below -15)", () => {
    const input = overtrainingInput();
    input.ewma = makeEwma(-16);
    const result = detectAnomalies(input);
    expect(result.reason_codes).toContain("ANOMALY_OVERTRAINING_RISK");
  });
});

// =========================================================================
// BOUNDARY TESTS
// =========================================================================
describe("detectAnomalies — boundary tests", () => {
  it("readiness 65 fires, 64 does not (HRV_DISSOCIATION)", () => {
    const at65 = dissociationInput();
    at65.readiness_score = 65;
    expect(detectAnomalies(at65).reason_codes).toContain("ANOMALY_HRV_DISSOCIATION");

    const at64 = dissociationInput();
    at64.readiness_score = 64;
    expect(detectAnomalies(at64).reason_codes).not.toContain("ANOMALY_HRV_DISSOCIATION");
  });

  it("confidence 0.5 fires, 0.49 does not (HRV_DISSOCIATION)", () => {
    const at50 = dissociationInput();
    at50.confidence = makeConfidence(0.5);
    expect(detectAnomalies(at50).reason_codes).toContain("ANOMALY_HRV_DISSOCIATION");

    const at49 = dissociationInput();
    at49.confidence = makeConfidence(0.49);
    expect(detectAnomalies(at49).reason_codes).not.toContain("ANOMALY_HRV_DISSOCIATION");
  });

  it("HRV quality 0.6 fires, 0.59 does not (HRV_DISSOCIATION)", () => {
    const at60 = dissociationInput();
    at60.signal_validity = makeValidity(0.6);
    expect(detectAnomalies(at60).reason_codes).toContain("ANOMALY_HRV_DISSOCIATION");

    const at59 = dissociationInput();
    at59.signal_validity = makeValidity(0.59);
    expect(detectAnomalies(at59).reason_codes).not.toContain("ANOMALY_HRV_DISSOCIATION");
  });

  it("form -15 does not fire, -16 fires (OVERTRAINING_RISK)", () => {
    const atMinus15 = overtrainingInput();
    atMinus15.ewma = makeEwma(-15);
    expect(detectAnomalies(atMinus15).reason_codes).not.toContain("ANOMALY_OVERTRAINING_RISK");

    const atMinus16 = overtrainingInput();
    atMinus16.ewma = makeEwma(-16);
    expect(detectAnomalies(atMinus16).reason_codes).toContain("ANOMALY_OVERTRAINING_RISK");
  });

  it("fatigue 60 fires, 59 does not (OVERTRAINING_RISK)", () => {
    const at60 = overtrainingInput();
    at60.fatigue_score = 60;
    expect(detectAnomalies(at60).reason_codes).toContain("ANOMALY_OVERTRAINING_RISK");

    const at59 = overtrainingInput();
    at59.fatigue_score = 59;
    expect(detectAnomalies(at59).reason_codes).not.toContain("ANOMALY_OVERTRAINING_RISK");
  });

  it("confidence 0.29 fires, 0.3 does not (LOW_CONFIDENCE_ANOMALY)", () => {
    const at29 = lowConfidenceInput();
    at29.confidence = makeConfidence(0.29);
    expect(detectAnomalies(at29).reason_codes).toContain("ANOMALY_LOW_CONFIDENCE");

    const at30 = lowConfidenceInput();
    at30.confidence = makeConfidence(0.3);
    expect(detectAnomalies(at30).reason_codes).not.toContain("ANOMALY_LOW_CONFIDENCE");
  });
});

// =========================================================================
// MULTI-RULE MERGING
// =========================================================================
describe("detectAnomalies — multi-rule merging", () => {
  it("HRV_DISSOCIATION + OVERTRAINING_RISK: caution high, both codes, union restrictions", () => {
    // Needs: readiness ≥ 65, HRV declining confirmed, confidence ≥ 0.5,
    // HRV quality ≥ 0.6, form < -15, fatigue ≥ 60
    const input: ReadinessAndFatigueOutput = {
      readiness_score: 65,
      fatigue_score: 65,
      reason_codes: ["FATIGUE_ELEVATED"],
      confidence: makeConfidence(0.7),
      baseline_mode: "mature",
      ewma: makeEwma(-20),
      signal_validity: makeValidity(0.8),
      trend_states: [makeHrvTrend("declining", "confirmed")],
    };

    const result = detectAnomalies(input);
    expect(result.caution_level).toBe("high");
    expect(result.reason_codes).toContain("ANOMALY_HRV_DISSOCIATION");
    expect(result.reason_codes).toContain("ANOMALY_OVERTRAINING_RISK");
    expect(result.restrictions).toContain("cap_intensity");
    expect(result.restrictions).toContain("suggest_rest");
    // cap_intensity should appear only once (no duplicates)
    expect(result.restrictions.filter((r) => r === "cap_intensity")).toHaveLength(1);
  });

  it("HRV_DISSOCIATION and LOW_CONFIDENCE cannot co-fire (mutually exclusive confidence)", () => {
    // HRV_DISSOCIATION needs confidence ≥ 0.5
    // LOW_CONFIDENCE needs confidence < 0.3
    // These are mutually exclusive
    const input = dissociationInput();
    input.confidence = makeConfidence(0.2); // < 0.3 → LOW_CONFIDENCE could fire, but < 0.5 → HRV_DISSOCIATION won't
    input.baseline_mode = "building";
    const result = detectAnomalies(input);
    expect(result.reason_codes).not.toContain("ANOMALY_HRV_DISSOCIATION");
    // LOW_CONFIDENCE should fire
    expect(result.reason_codes).toContain("ANOMALY_LOW_CONFIDENCE");
  });

  it("is deterministic across multiple calls", () => {
    const input = dissociationInput();
    const r1 = detectAnomalies(input);
    const r2 = detectAnomalies(input);
    const r3 = detectAnomalies(input);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });
});
