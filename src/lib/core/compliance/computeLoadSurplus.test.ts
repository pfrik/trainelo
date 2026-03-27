import { describe, it, expect } from "vitest";
import { computeLoadSurplus } from "./computeLoadSurplus";
import type { DailyLoadSurplusInput } from "./types";

function mkInput(overrides: Partial<DailyLoadSurplusInput> = {}): DailyLoadSurplusInput {
  return {
    planned_tss: 80,
    actual_tss: 80,
    planned_sport: "running",
    actual_workouts: [
      { id: "w1", sport: "running", tss: 80, source: "garmin" },
    ],
    matched_workout_ids: ["w1"],
    ...overrides,
  };
}

describe("computeLoadSurplus", () => {
  it("returns no surplus when actual matches planned", () => {
    const result = computeLoadSurplus(mkInput());
    expect(result.surplus_tss).toBe(0);
    expect(result.surplus_ratio).toBe(1);
    expect(result.has_unplanned_load).toBe(false);
    expect(result.cross_sport_tss).toBe(0);
    expect(result.transferred_tss).toBe(0);
  });

  it("detects surplus when actual >> planned", () => {
    const result = computeLoadSurplus(
      mkInput({
        planned_tss: 50,
        actual_tss: 150,
        actual_workouts: [
          { id: "w1", sport: "running", tss: 80, source: "garmin" },
          { id: "w2", sport: "running", tss: 70, source: "garmin" },
        ],
        matched_workout_ids: ["w1"],
      }),
    );
    expect(result.surplus_tss).toBe(100);
    expect(result.surplus_ratio).toBe(3);
    expect(result.has_unplanned_load).toBe(true);
  });

  it("returns Infinity surplus_ratio when no plan but activity exists", () => {
    const result = computeLoadSurplus(
      mkInput({
        planned_tss: 0,
        actual_tss: 100,
        actual_workouts: [
          { id: "w1", sport: "running", tss: 100, source: "garmin" },
        ],
        matched_workout_ids: [],
      }),
    );
    expect(result.surplus_ratio).toBe(Infinity);
    expect(result.has_unplanned_load).toBe(true);
  });

  it("returns ratio 1.0 when both planned and actual are 0", () => {
    const result = computeLoadSurplus(
      mkInput({
        planned_tss: 0,
        actual_tss: 0,
        actual_workouts: [],
        matched_workout_ids: [],
      }),
    );
    expect(result.surplus_ratio).toBe(1);
    expect(result.has_unplanned_load).toBe(false);
  });

  it("detects cross-sport TSS", () => {
    const result = computeLoadSurplus(
      mkInput({
        planned_tss: 60,
        actual_tss: 160,
        planned_sport: "running",
        actual_workouts: [
          { id: "w1", sport: "running", tss: 60, source: "garmin" },
          { id: "w2", sport: "cycling", tss: 100, source: "trainerroad" },
        ],
        matched_workout_ids: ["w1"],
      }),
    );
    expect(result.cross_sport_tss).toBe(100);
    // cycling → running transfer = 0.6
    expect(result.transferred_tss).toBe(60);
  });

  it("does not count matched workouts in cross-sport even if different sport", () => {
    // If a cycling workout was matched to a running plan (substituted),
    // cross_sport_tss comes from unmatched workouts
    const result = computeLoadSurplus(
      mkInput({
        planned_tss: 80,
        actual_tss: 180,
        planned_sport: "running",
        actual_workouts: [
          { id: "w1", sport: "cycling", tss: 80, source: "garmin" }, // matched (substituted)
          { id: "w2", sport: "cycling", tss: 100, source: "trainerroad" }, // unmatched
        ],
        matched_workout_ids: ["w1"],
      }),
    );
    // w2 is cross-sport and unmatched
    expect(result.cross_sport_tss).toBe(100);
    expect(result.transferred_tss).toBe(60); // 100 * 0.6
  });

  it("builds correct source attribution", () => {
    const result = computeLoadSurplus(
      mkInput({
        actual_workouts: [
          { id: "w1", sport: "running", tss: 60, source: "garmin" },
          { id: "w2", sport: "cycling", tss: 100, source: "trainerroad" },
        ],
        matched_workout_ids: ["w1"],
      }),
    );

    expect(result.source_attribution).toHaveLength(2);
    const w1 = result.source_attribution.find((a) => a.id === "w1")!;
    const w2 = result.source_attribution.find((a) => a.id === "w2")!;
    expect(w1.is_planned).toBe(true);
    expect(w2.is_planned).toBe(false);
    expect(w1.sport).toBe("running");
    expect(w2.sport).toBe("cycling");
  });

  it("handles negative surplus (under-delivered)", () => {
    const result = computeLoadSurplus(
      mkInput({
        planned_tss: 100,
        actual_tss: 40,
        actual_workouts: [
          { id: "w1", sport: "running", tss: 40, source: "garmin" },
        ],
        matched_workout_ids: ["w1"],
      }),
    );
    expect(result.surplus_tss).toBe(-60);
    expect(result.surplus_ratio).toBe(0.4);
    expect(result.has_unplanned_load).toBe(false);
  });

  it("has_unplanned_load is false at exactly 1.5x", () => {
    const result = computeLoadSurplus(
      mkInput({
        planned_tss: 100,
        actual_tss: 150,
        actual_workouts: [
          { id: "w1", sport: "running", tss: 150, source: "garmin" },
        ],
        matched_workout_ids: ["w1"],
      }),
    );
    // 1.5 is NOT > 1.5, so false
    expect(result.has_unplanned_load).toBe(false);
  });

  it("has_unplanned_load is true just above 1.5x", () => {
    const result = computeLoadSurplus(
      mkInput({
        planned_tss: 100,
        actual_tss: 151,
        actual_workouts: [
          { id: "w1", sport: "running", tss: 151, source: "garmin" },
        ],
        matched_workout_ids: ["w1"],
      }),
    );
    expect(result.has_unplanned_load).toBe(true);
  });
});
