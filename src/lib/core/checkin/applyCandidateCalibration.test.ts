/**
 * Tests for applyCandidateCalibration — pure candidate re-ordering and adjustment.
 */

import { describe, it, expect } from "vitest";
import { applyCandidateCalibration } from "./applyCandidateCalibration";
import type { CalibrationResult } from "./calibrator";
import type { RecommendationCandidate } from "../contracts/recommendation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidates(): RecommendationCandidate[] {
  return [
    {
      candidate_id: "scheduled",
      template_ref: "easy-run-30min",
      label: "Scheduled Workout",
      rationale: "Recovery signals are strong — you're ready for a full session.",
      reason_codes: ["RECOVERY_OPTIMAL"],
      caution_level: "none",
    },
    {
      candidate_id: "lite_alternative",
      template_ref: "recovery-jog-20min",
      label: "Recovery Jog (20 min)",
      rationale: "A lighter option if you prefer to go easy today.",
      reason_codes: ["USER_PREFERENCE"],
      caution_level: "none",
    },
    {
      candidate_id: "rest_day",
      template_ref: null,
      label: "Rest Day",
      rationale: "Take a rest day if you need it.",
      reason_codes: ["USER_PREFERENCE"],
      caution_level: "none",
    },
    {
      candidate_id: "skip",
      template_ref: null,
      label: "Skip Today",
      rationale: "Skip today's session if life gets in the way.",
      reason_codes: ["USER_PREFERENCE"],
      caution_level: "none",
    },
  ];
}

function makeCalibration(overrides: Partial<CalibrationResult> = {}): CalibrationResult {
  return {
    level: "green",
    intensity_multiplier: 1.0,
    duration_multiplier: 1.0,
    swap_to: "as_planned",
    headline: "All clear — train as planned",
    rationale: "You feel good and there are no flags.",
    applied_rules: ["MOOD_GOOD"],
    warnings: [],
    checkin_readiness_delta: 5,
    checkin_fatigue_delta: -5,
    signal_contribution: {
      objective_score: null,
      objective_fatigue: null,
      subjective_delta: 5,
      subjective_delta_raw: 5,
      subjective_fatigue_delta: -5,
      subjective_fatigue_delta_raw: -5,
      final_score: null,
      final_fatigue: null,
      conflict_flag: false,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyCandidateCalibration", () => {
  it("returns a copy unchanged when calibration is null", () => {
    const candidates = makeCandidates();
    const result = applyCandidateCalibration(candidates, null);

    expect(result).toHaveLength(4);
    expect(result[0].candidate_id).toBe("scheduled");
    expect(result[0].rationale).toBe(candidates[0].rationale);
    // Verify the array is a new reference
    expect(result).not.toBe(candidates);
  });

  it("returns empty array when given empty candidates", () => {
    const result = applyCandidateCalibration([], makeCalibration());
    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Re-ordering based on swap_to
  // -------------------------------------------------------------------------

  it("promotes rest_day to primary when swap_to is 'rest'", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ swap_to: "rest", level: "red", headline: "Rest recommended — illness detected" }),
    );

    expect(result[0].candidate_id).toBe("rest_day");
    expect(result).toHaveLength(4);
    // Other candidates follow in original relative order
    expect(result.map((c) => c.candidate_id)).toEqual([
      "rest_day",
      "scheduled",
      "lite_alternative",
      "skip",
    ]);
  });

  it("promotes lite_alternative to primary when swap_to is 'recovery'", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ swap_to: "recovery", level: "red", headline: "Take it easy" }),
    );

    expect(result[0].candidate_id).toBe("lite_alternative");
  });

  it("promotes lite_alternative to primary when swap_to is 'easy'", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ swap_to: "easy", level: "amber", headline: "Modified session" }),
    );

    expect(result[0].candidate_id).toBe("lite_alternative");
  });

  it("promotes rest_day to primary when swap_to is 'mobility'", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ swap_to: "mobility", level: "red", headline: "Recovery day" }),
    );

    expect(result[0].candidate_id).toBe("rest_day");
  });

  it("promotes lite_alternative when swap_to is 'injury_safe'", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ swap_to: "injury_safe", level: "red", headline: "Injury protocol" }),
    );

    expect(result[0].candidate_id).toBe("lite_alternative");
  });

  it("keeps original order when swap_to is 'as_planned'", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ swap_to: "as_planned" }),
    );

    expect(result[0].candidate_id).toBe("scheduled");
    expect(result[1].candidate_id).toBe("lite_alternative");
  });

  it("keeps original order when swap_to is 'harder_variant'", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ swap_to: "harder_variant", level: "upgrade" }),
    );

    expect(result[0].candidate_id).toBe("scheduled");
  });

  // -------------------------------------------------------------------------
  // Caution level escalation
  // -------------------------------------------------------------------------

  it("escalates primary caution to 'high' for red calibration level", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ level: "red", swap_to: "rest", headline: "Rest recommended" }),
    );

    expect(result[0].caution_level).toBe("high");
  });

  it("escalates primary caution to 'moderate' for amber calibration level", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ level: "amber", swap_to: "easy", headline: "Modified session" }),
    );

    expect(result[0].caution_level).toBe("moderate");
  });

  it("does not downgrade existing high caution for green calibration", () => {
    const candidates = makeCandidates();
    candidates[0].caution_level = "high";

    const result = applyCandidateCalibration(
      candidates,
      makeCalibration({ level: "green", swap_to: "as_planned" }),
    );

    expect(result[0].caution_level).toBe("high");
  });

  it("does not change caution for green calibration on none caution", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({ level: "green", swap_to: "as_planned" }),
    );

    expect(result[0].caution_level).toBe("none");
  });

  // -------------------------------------------------------------------------
  // Rationale prepending
  // -------------------------------------------------------------------------

  it("prepends calibration headline to primary rationale", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        swap_to: "as_planned",
        headline: "All clear — train as planned",
      }),
    );

    expect(result[0].rationale).toMatch(/^All clear — train as planned\./);
    expect(result[0].rationale).toContain("Recovery signals are strong");
  });

  it("does not duplicate headline if already present in rationale", () => {
    const candidates = makeCandidates();
    candidates[0].rationale = "All clear — train as planned. Some extra text.";

    const result = applyCandidateCalibration(
      candidates,
      makeCalibration({ headline: "All clear — train as planned" }),
    );

    // Should NOT have the headline twice
    const count = (result[0].rationale.match(/All clear/g) ?? []).length;
    expect(count).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Does not mutate input
  // -------------------------------------------------------------------------

  it("does not mutate the original candidates array", () => {
    const candidates = makeCandidates();
    const originalFirstId = candidates[0].candidate_id;

    applyCandidateCalibration(
      candidates,
      makeCalibration({ swap_to: "rest", level: "red", headline: "Rest" }),
    );

    expect(candidates[0].candidate_id).toBe(originalFirstId);
    expect(candidates[0].caution_level).toBe("none");
  });

  // -------------------------------------------------------------------------
  // Combined scenario
  // -------------------------------------------------------------------------

  it("illness hard-stop: promotes rest, sets high caution, prepends headline", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "red",
        swap_to: "rest",
        headline: "Rest recommended — illness detected",
        warnings: ["Safety override: ILLNESS_FLAG"],
        applied_rules: ["HARD_STOP:ILLNESS_FLAG"],
      }),
    );

    expect(result[0].candidate_id).toBe("rest_day");
    expect(result[0].caution_level).toBe("high");
    expect(result[0].rationale).toMatch(/^Rest recommended — illness detected\./);
  });

  it("drained + fried: promotes lite, sets high caution", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "red",
        swap_to: "easy",
        headline: "Take it easy — you're feeling drained",
        applied_rules: ["MOOD_DRAINED", "REASON_FRIED"],
      }),
    );

    expect(result[0].candidate_id).toBe("lite_alternative");
    expect(result[0].caution_level).toBe("high");
    expect(result[0].rationale).toContain("Take it easy");
  });

  it("tired mood: promotes lite, sets moderate caution", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "amber",
        swap_to: "easy",
        headline: "Modified session — fatigue noted",
        applied_rules: ["MOOD_TIRED"],
      }),
    );

    expect(result[0].candidate_id).toBe("lite_alternative");
    expect(result[0].caution_level).toBe("moderate");
  });

  it("great mood + green wearable: keeps scheduled, no caution escalation", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "upgrade",
        swap_to: "harder_variant",
        headline: "Green light — push today",
        applied_rules: ["MOOD_GREAT", "WEARABLE_GREEN_UPGRADE"],
      }),
    );

    expect(result[0].candidate_id).toBe("scheduled");
    expect(result[0].caution_level).toBe("none");
    expect(result[0].rationale).toContain("Green light");
  });

  // -------------------------------------------------------------------------
  // Recovery type override
  // -------------------------------------------------------------------------

  it("recovery_type=full_rest overrides lite_alternative to rest_day", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "red",
        swap_to: "recovery", // normally promotes lite_alternative
        headline: "Take it easy",
      }),
      { recovery_type: "full_rest" },
    );

    expect(result[0].candidate_id).toBe("rest_day");
  });

  it("recovery_type=full_rest overrides easy swap to rest_day", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "red",
        swap_to: "easy", // normally promotes lite_alternative
        headline: "Take it easy",
      }),
      { recovery_type: "full_rest" },
    );

    expect(result[0].candidate_id).toBe("rest_day");
  });

  it("recovery_type=active_recovery keeps lite_alternative (no override)", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "red",
        swap_to: "recovery",
        headline: "Take it easy",
      }),
      { recovery_type: "active_recovery" },
    );

    expect(result[0].candidate_id).toBe("lite_alternative");
  });

  it("recovery_type=full_rest does not affect rest swap (already rest_day)", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "red",
        swap_to: "rest", // already maps to rest_day
        headline: "Rest",
      }),
      { recovery_type: "full_rest" },
    );

    expect(result[0].candidate_id).toBe("rest_day");
  });

  it("recovery_type=null has no effect", () => {
    const result = applyCandidateCalibration(
      makeCandidates(),
      makeCalibration({
        level: "red",
        swap_to: "recovery",
        headline: "Take it easy",
      }),
      { recovery_type: null },
    );

    expect(result[0].candidate_id).toBe("lite_alternative");
  });
});
