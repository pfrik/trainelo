import { describe, it, expect } from "vitest";
import { applyAnomalyRestrictions } from "./applyAnomalyRestrictions";
import type { RecommendationCandidate } from "../contracts/recommendation";
import type { AnomalyResult } from "./anomaly";

// ============================================================================
// Fixtures
// ============================================================================

function makeCandidates(): RecommendationCandidate[] {
  return [
    {
      candidate_id: "scheduled",
      template_ref: "easy-run-30min",
      label: "Scheduled Workout",
      rationale: "Recovery signals are strong.",
      reason_codes: ["RECOVERY_OPTIMAL"],
      caution_level: "none",
    },
    {
      candidate_id: "lite_alternative",
      template_ref: "recovery-jog-20min",
      label: "Recovery Jog",
      rationale: "A lighter option.",
      reason_codes: ["USER_PREFERENCE"],
      caution_level: "none",
    },
    {
      candidate_id: "rest_day",
      template_ref: null,
      label: "Rest Day",
      rationale: "Take a rest day.",
      reason_codes: ["USER_PREFERENCE"],
      caution_level: "none",
    },
    {
      candidate_id: "skip",
      template_ref: null,
      label: "Skip Today",
      rationale: "Skip today.",
      reason_codes: ["USER_PREFERENCE"],
      caution_level: "none",
    },
  ];
}

const noRestrictions: AnomalyResult = {
  caution_level: "none",
  reason_codes: [],
  restrictions: [],
  question_key: null,
};

// ============================================================================
// Tests
// ============================================================================

describe("applyAnomalyRestrictions", () => {
  it("returns candidates unchanged when no restrictions", () => {
    const result = applyAnomalyRestrictions(makeCandidates(), noRestrictions, false);
    expect(result.candidates[0].candidate_id).toBe("scheduled");
    expect(result.intensityCap).toBeNull();
    expect(result.checkinRequired).toBe(false);
  });

  it("cap_intensity escalates workout caution to moderate", () => {
    const anomaly: AnomalyResult = {
      caution_level: "moderate",
      reason_codes: ["ANOMALY_HRV_DISSOCIATION"],
      restrictions: ["cap_intensity"],
      question_key: "how_do_you_feel_today",
    };
    const result = applyAnomalyRestrictions(makeCandidates(), anomaly, false);
    expect(result.intensityCap).toBe(0.85);
    expect(result.candidates[0].caution_level).toBe("moderate");
    expect(result.candidates[1].caution_level).toBe("moderate");
    // Rest and skip should be unaffected
    expect(result.candidates[2].caution_level).toBe("none");
    expect(result.candidates[3].caution_level).toBe("none");
  });

  it("cap_intensity does not downgrade existing high caution", () => {
    const candidates = makeCandidates();
    candidates[0].caution_level = "high";
    const anomaly: AnomalyResult = {
      caution_level: "moderate",
      reason_codes: ["ANOMALY_HRV_DISSOCIATION"],
      restrictions: ["cap_intensity"],
      question_key: null,
    };
    const result = applyAnomalyRestrictions(candidates, anomaly, false);
    expect(result.candidates[0].caution_level).toBe("high");
  });

  it("suggest_rest promotes rest_day to primary", () => {
    const anomaly: AnomalyResult = {
      caution_level: "high",
      reason_codes: ["ANOMALY_OVERTRAINING_RISK"],
      restrictions: ["suggest_rest"],
      question_key: null,
    };
    const result = applyAnomalyRestrictions(makeCandidates(), anomaly, false);
    expect(result.candidates[0].candidate_id).toBe("rest_day");
    expect(result.candidates[0].rationale).toContain("strongly recommended");
  });

  it("require_checkin sets flag when no check-in submitted", () => {
    const anomaly: AnomalyResult = {
      caution_level: "low",
      reason_codes: ["ANOMALY_LOW_CONFIDENCE"],
      restrictions: ["require_checkin"],
      question_key: "data_seems_stale",
    };
    const result = applyAnomalyRestrictions(makeCandidates(), anomaly, false);
    expect(result.checkinRequired).toBe(true);
  });

  it("require_checkin is satisfied when check-in exists", () => {
    const anomaly: AnomalyResult = {
      caution_level: "low",
      reason_codes: ["ANOMALY_LOW_CONFIDENCE"],
      restrictions: ["require_checkin"],
      question_key: "data_seems_stale",
    };
    const result = applyAnomalyRestrictions(makeCandidates(), anomaly, true);
    expect(result.checkinRequired).toBe(false);
  });

  it("handles multiple restrictions simultaneously", () => {
    const anomaly: AnomalyResult = {
      caution_level: "high",
      reason_codes: ["ANOMALY_OVERTRAINING_RISK"],
      restrictions: ["cap_intensity", "suggest_rest"],
      question_key: null,
    };
    const result = applyAnomalyRestrictions(makeCandidates(), anomaly, false);
    // suggest_rest promotes rest_day to primary
    expect(result.candidates[0].candidate_id).toBe("rest_day");
    // cap_intensity applies
    expect(result.intensityCap).toBe(0.85);
  });

  it("does not mutate original candidates", () => {
    const original = makeCandidates();
    const originalFirst = original[0].caution_level;
    const anomaly: AnomalyResult = {
      caution_level: "moderate",
      reason_codes: ["ANOMALY_HRV_DISSOCIATION"],
      restrictions: ["cap_intensity"],
      question_key: null,
    };
    applyAnomalyRestrictions(original, anomaly, false);
    expect(original[0].caution_level).toBe(originalFirst);
  });
});
