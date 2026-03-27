import { describe, it, expect } from "vitest";
import { matchWorkoutToPlanned, matchAllPlannedForDate } from "./matchWorkoutToPlanned";
import type { ComplianceMatchInput } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkPlanned(
  overrides: Partial<ComplianceMatchInput["planned"]> = {},
): ComplianceMatchInput["planned"] {
  return {
    sport: "running",
    template_ref: "tempo-run-45min",
    duration_minutes: 45,
    intensity_level: 7,
    target_tss: 80,
    ...overrides,
  };
}

function mkActual(
  id: string,
  overrides: Partial<ComplianceMatchInput["actuals"][number]> = {},
): ComplianceMatchInput["actuals"][number] {
  return {
    id,
    activity_type: "RUNNING",
    activity_subtype: null,
    duration_seconds: 45 * 60, // 45 min
    training_stress_score: 80,
    intensity_factor: 0.85,
    source: "garmin",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// matchWorkoutToPlanned
// ---------------------------------------------------------------------------

describe("matchWorkoutToPlanned", () => {
  it("returns missed when no actuals", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned(),
      actuals: [],
    });

    expect(result.match_status).toBe("missed");
    expect(result.match_score).toBe(0);
    expect(result.best_match_id).toBeNull();
    expect(result.unmatched_workout_ids).toEqual([]);
  });

  it("returns completed for exact match (same sport, duration, TSS)", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned(),
      actuals: [mkActual("w1")],
    });

    expect(result.match_status).toBe("completed");
    expect(result.match_score).toBeGreaterThanOrEqual(0.7);
    expect(result.best_match_id).toBe("w1");
    expect(result.sport_match).toBe(true);
  });

  it("returns partial for same sport, half duration and proportionally lower TSS", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned({ duration_minutes: 60, target_tss: 100 }),
      actuals: [
        mkActual("w1", {
          duration_seconds: 30 * 60, // 30 min vs 60 planned
          training_stress_score: 35, // Much lower TSS too
        }),
      ],
    });

    expect(result.match_status).toBe("partial");
    expect(result.match_score).toBeGreaterThanOrEqual(0.3);
    expect(result.match_score).toBeLessThan(0.7);
    expect(result.sport_match).toBe(true);
    expect(result.duration_ratio).toBeCloseTo(0.5, 1);
  });

  it("returns substituted for wrong sport", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned({ sport: "running" }),
      actuals: [
        mkActual("w1", {
          activity_type: "CYCLING",
          duration_seconds: 45 * 60,
          training_stress_score: 80,
        }),
      ],
    });

    // Without sport match, score is lower
    expect(result.sport_match).toBe(false);
    // Could be partial or substituted depending on other factors
    expect(["partial", "substituted"]).toContain(result.match_status);
  });

  it("recovery jog does NOT fulfill tempo run (the key bug fix)", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned({
        sport: "running",
        template_ref: "tempo-run-45min",
        duration_minutes: 45,
        target_tss: 80,
      }),
      actuals: [
        mkActual("w1", {
          activity_type: "RUNNING",
          duration_seconds: 20 * 60, // 20 min recovery jog
          training_stress_score: 15, // Very low TSS
        }),
      ],
    });

    // This was the original bug: any workout = completed
    // Now it should NOT be completed
    expect(result.match_status).not.toBe("completed");
    expect(result.match_score).toBeLessThan(0.7);
  });

  it("picks best match from multiple actuals", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned({ sport: "running", duration_minutes: 45, target_tss: 80 }),
      actuals: [
        mkActual("w-strength", {
          activity_type: "STRENGTH_TRAINING",
          duration_seconds: 30 * 60,
          training_stress_score: 40,
        }),
        mkActual("w-run", {
          activity_type: "RUNNING",
          duration_seconds: 42 * 60,
          training_stress_score: 75,
        }),
      ],
    });

    expect(result.best_match_id).toBe("w-run");
    expect(result.sport_match).toBe(true);
    expect(result.unmatched_workout_ids).toEqual(["w-strength"]);
  });

  it("handles null planned fields gracefully", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned({
        sport: null,
        template_ref: null,
        duration_minutes: null,
        intensity_level: null,
        target_tss: null,
      }),
      actuals: [mkActual("w1")],
    });

    // Should still produce a result without crashing
    expect(result.match_score).toBeGreaterThan(0);
    expect(result.best_match_id).toBe("w1");
  });

  it("handles null TSS on actual gracefully", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned(),
      actuals: [
        mkActual("w1", {
          training_stress_score: null,
          intensity_factor: null,
        }),
      ],
    });

    expect(result.match_score).toBeGreaterThan(0);
    expect(result.best_match_id).toBe("w1");
  });

  it("excludes IDs when provided", () => {
    const result = matchWorkoutToPlanned(
      {
        planned: mkPlanned(),
        actuals: [mkActual("w1"), mkActual("w2")],
      },
      new Set(["w1"]),
    );

    expect(result.best_match_id).toBe("w2");
  });

  it("returns missed when all actuals are excluded", () => {
    const result = matchWorkoutToPlanned(
      {
        planned: mkPlanned(),
        actuals: [mkActual("w1")],
      },
      new Set(["w1"]),
    );

    expect(result.match_status).toBe("missed");
  });

  it("gives subtype bonus for template keyword match", () => {
    const withBonus = matchWorkoutToPlanned({
      planned: mkPlanned({ template_ref: "tempo-run-45min" }),
      actuals: [mkActual("w1", { activity_subtype: "tempo" })],
    });

    const withoutBonus = matchWorkoutToPlanned({
      planned: mkPlanned({ template_ref: "tempo-run-45min" }),
      actuals: [mkActual("w1", { activity_subtype: "easy" })],
    });

    expect(withBonus.match_score).toBeGreaterThan(withoutBonus.match_score);
  });

  it("score is between 0 and 1", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned(),
      actuals: [mkActual("w1", { training_stress_score: 500, duration_seconds: 300 * 60 })],
    });

    expect(result.match_score).toBeGreaterThanOrEqual(0);
    expect(result.match_score).toBeLessThanOrEqual(1);
  });

  it("duration_ratio reflects actual/planned", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned({ duration_minutes: 60 }),
      actuals: [mkActual("w1", { duration_seconds: 90 * 60 })],
    });

    expect(result.duration_ratio).toBeCloseTo(1.5, 1);
  });

  it("tss_ratio reflects actual/planned", () => {
    const result = matchWorkoutToPlanned({
      planned: mkPlanned({ target_tss: 100 }),
      actuals: [mkActual("w1", { training_stress_score: 150 })],
    });

    expect(result.tss_ratio).toBeCloseTo(1.5, 1);
  });
});

// ---------------------------------------------------------------------------
// matchAllPlannedForDate
// ---------------------------------------------------------------------------

describe("matchAllPlannedForDate", () => {
  it("matches multiple plans to different actuals (greedy)", () => {
    const plans = [
      mkPlanned({ sport: "running", duration_minutes: 30, target_tss: 40 }),
      mkPlanned({ sport: "strength", template_ref: "strength-30min", duration_minutes: 30, target_tss: 30 }),
    ];

    const actuals = [
      mkActual("w-run", { activity_type: "RUNNING", duration_seconds: 32 * 60, training_stress_score: 42 }),
      mkActual("w-str", { activity_type: "STRENGTH_TRAINING", duration_seconds: 28 * 60, training_stress_score: 25 }),
    ];

    const results = matchAllPlannedForDate(plans, actuals);

    expect(results).toHaveLength(2);
    expect(results[0].best_match_id).toBe("w-run");
    expect(results[1].best_match_id).toBe("w-str");
  });

  it("handles more plans than actuals (some missed)", () => {
    const plans = [
      mkPlanned({ sport: "running" }),
      mkPlanned({ sport: "strength", template_ref: "strength-30min" }),
    ];

    const actuals = [
      mkActual("w-run", { activity_type: "RUNNING" }),
    ];

    const results = matchAllPlannedForDate(plans, actuals);

    expect(results).toHaveLength(2);
    // One should match, one should be missed
    const matched = results.filter((r) => r.match_status !== "missed");
    const missed = results.filter((r) => r.match_status === "missed");
    expect(matched.length).toBe(1);
    expect(missed.length).toBe(1);
  });

  it("handles more actuals than plans (unmatched = unplanned)", () => {
    const plans = [mkPlanned({ sport: "running" })];
    const actuals = [
      mkActual("w1", { activity_type: "RUNNING" }),
      mkActual("w2", { activity_type: "CYCLING" }),
    ];

    const results = matchAllPlannedForDate(plans, actuals);

    expect(results).toHaveLength(1);
    expect(results[0].best_match_id).toBe("w1");
  });

  it("returns empty array for empty plans", () => {
    const results = matchAllPlannedForDate([], [mkActual("w1")]);
    expect(results).toHaveLength(0);
  });

  it("does not double-assign the same actual to multiple plans", () => {
    const plans = [
      mkPlanned({ sport: "running", duration_minutes: 30 }),
      mkPlanned({ sport: "running", duration_minutes: 45 }),
    ];

    const actuals = [
      mkActual("w1", { activity_type: "RUNNING", duration_seconds: 40 * 60 }),
    ];

    const results = matchAllPlannedForDate(plans, actuals);

    const matchedIds = results.map((r) => r.best_match_id).filter(Boolean);
    // Only one plan gets the actual; the other is missed
    expect(matchedIds.length).toBe(1);
    expect(matchedIds[0]).toBe("w1");
  });
});
