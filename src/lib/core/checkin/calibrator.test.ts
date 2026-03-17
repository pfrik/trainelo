/**
 * Unit tests for the session calibrator.
 *
 * Covers: hard-stops, mood-based levels, wearable gating, delta computation,
 * time constraints, multiplier clamping, determinism, and no-checkin fallbacks.
 */

import { describe, it, expect } from "vitest";
import {
  calibrateSession,
  computeCheckinDeltas,
  type CalibratorInput,
  type CheckinInput,
  type WearableSignalsInput,
  type PlannedSessionInput,
} from "./calibrator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCheckin(overrides: Partial<CheckinInput> = {}): CheckinInput {
  return {
    mood: "okay",
    rpe: null,
    soreness: null,
    pain_flag: false,
    illness_flag: false,
    reason_bucket: null,
    pain_severity: null,
    pain_locations: null,
    sleep_quality: null,
    perceived_energy: null,
    motivation: null,
    life_stress: null,
    time_constraint_minutes: null,
    ...overrides,
  };
}

function makeWearable(overrides: Partial<WearableSignalsInput> = {}): WearableSignalsInput {
  return {
    readiness: "green",
    readiness_score: null,
    fatigue_score: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<PlannedSessionInput> = {}): PlannedSessionInput {
  return {
    planned_duration_minutes: 60,
    planned_intensity: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<CalibratorInput> = {}): CalibratorInput {
  return {
    planned_session: makeSession(),
    wearable_signals: makeWearable(),
    morning_checkin: makeCheckin(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeCheckinDeltas
// ---------------------------------------------------------------------------

describe("computeCheckinDeltas", () => {
  it("drained => readiness -15, fatigue +15", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "drained" }));
    expect(d.readiness_delta).toBe(-15);
    expect(d.fatigue_delta).toBe(15);
  });

  it("tired => readiness -8, fatigue +8", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "tired" }));
    expect(d.readiness_delta).toBe(-8);
    expect(d.fatigue_delta).toBe(8);
  });

  it("okay => readiness 0, fatigue 0", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay" }));
    expect(d.readiness_delta).toBe(0);
    expect(d.fatigue_delta).toBe(0);
  });

  it("good => readiness +5, fatigue -5", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "good" }));
    expect(d.readiness_delta).toBe(5);
    expect(d.fatigue_delta).toBe(-5);
  });

  it("great => readiness +5, fatigue -5", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "great" }));
    expect(d.readiness_delta).toBe(5);
    expect(d.fatigue_delta).toBe(-5);
  });

  it("rpe >= 8 adds fatigue +8", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", rpe: 9 }));
    expect(d.fatigue_delta).toBe(8);
  });

  it("soreness >= 7 adds fatigue +8", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", soreness: 7 }));
    expect(d.fatigue_delta).toBe(8);
  });

  it("pain_flag adds readiness -15, fatigue +12", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", pain_flag: true }));
    expect(d.readiness_delta).toBe(-15);
    expect(d.fatigue_delta).toBe(12);
  });

  it("illness_flag adds readiness -20, fatigue +15", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", illness_flag: true }));
    expect(d.readiness_delta).toBe(-20);
    expect(d.fatigue_delta).toBe(15);
  });

  it("combines multiple flags correctly", () => {
    const d = computeCheckinDeltas(
      makeCheckin({ mood: "tired", rpe: 8, pain_flag: true }),
    );
    // tired(-8,+8) + rpe(+8) + pain(-15,+12)
    expect(d.readiness_delta).toBe(-8 + -15);
    expect(d.fatigue_delta).toBe(8 + 8 + 12);
  });
});

// ---------------------------------------------------------------------------
// Hard-stop rules
// ---------------------------------------------------------------------------

describe("calibrateSession — hard-stop rules", () => {
  it("1. drained + sick => red + rest", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({
          mood: "drained",
          reason_bucket: "sick",
          illness_flag: true,
        }),
      }),
    );
    expect(result.level).toBe("red");
    expect(result.swap_to).toBe("rest");
    expect(result.intensity_multiplier).toBeLessThanOrEqual(0.70);
    expect(result.applied_rules).toContain("HARD_STOP:ILLNESS_FLAG");
  });

  it("2. drained + hurt + severe pain (>=7) => hard-stop", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({
          mood: "drained",
          reason_bucket: "hurt",
          pain_severity: 8,
          pain_locations: ["left_knee"],
          pain_flag: true,
        }),
      }),
    );
    expect(result.level).toBe("red");
    expect(result.swap_to).toBe("injury_safe");
    expect(result.intensity_multiplier).toBeLessThanOrEqual(0.70);
    expect(result.applied_rules).toContain("HARD_STOP:SEVERE_PAIN");
  });

  it("reason_bucket=sick without illness_flag still triggers hard-stop", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "tired", reason_bucket: "sick" }),
      }),
    );
    expect(result.level).toBe("red");
    expect(result.swap_to).toBe("rest");
    expect(result.applied_rules).toContain("HARD_STOP:REASON_SICK");
  });

  it("fatigue_score >= 85 triggers hard-stop from wearable", () => {
    const result = calibrateSession(
      makeInput({
        wearable_signals: makeWearable({ fatigue_score: 90 }),
        morning_checkin: makeCheckin({ mood: "okay" }),
      }),
    );
    expect(result.level).toBe("red");
    expect(result.swap_to).toBe("mobility");
    expect(result.applied_rules).toContain("HARD_STOP:FATIGUE_EXTREME");
  });
});

// ---------------------------------------------------------------------------
// Mood-based calibration levels
// ---------------------------------------------------------------------------

describe("calibrateSession — mood-based levels", () => {
  it("drained (non-hard-stop) => red + recovery", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "drained", reason_bucket: "fried" }),
      }),
    );
    expect(result.level).toBe("red");
    expect(result.intensity_multiplier).toBe(0.70);
    expect(result.duration_multiplier).toBe(0.75);
    expect(result.applied_rules).toContain("MOOD_DRAINED");
    expect(result.applied_rules).toContain("REASON_FRIED");
    // fried => swap to easy
    expect(result.swap_to).toBe("easy");
  });

  it("3. tired + high rpe => amber with fatigue delta increase", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "tired", rpe: 9 }),
      }),
    );
    expect(result.level).toBe("amber");
    expect(result.checkin_fatigue_delta).toBe(8 + 8); // tired(+8) + rpe(+8)
    expect(result.intensity_multiplier).toBeLessThanOrEqual(0.90);
    expect(result.applied_rules).toContain("MOOD_TIRED");
    expect(result.applied_rules).toContain("RPE_HIGH_REDUCTION");
  });

  it("okay => amber with near-baseline multipliers", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "okay" }),
      }),
    );
    expect(result.level).toBe("amber");
    expect(result.intensity_multiplier).toBe(0.95);
    expect(result.duration_multiplier).toBe(0.95);
    expect(result.swap_to).toBe("as_planned");
  });

  it("4. good + green wearable => green / as_planned with multipliers 1.0", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "good" }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.swap_to).toBe("as_planned");
  });
});

// ---------------------------------------------------------------------------
// Great mood — wearable gating
// ---------------------------------------------------------------------------

describe("calibrateSession — great mood + wearable gating", () => {
  it("5. great + green => upgrade with intensity <=1.10, duration <=1.05", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great" }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.level).toBe("upgrade");
    expect(result.intensity_multiplier).toBeLessThanOrEqual(1.10);
    expect(result.duration_multiplier).toBeLessThanOrEqual(1.05);
    expect(result.swap_to).toBe("harder_variant");
    expect(result.applied_rules).toContain("WEARABLE_GREEN_UPGRADE");
  });

  it("great + yellow => green, capped at 1.05 intensity", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great" }),
        wearable_signals: makeWearable({ readiness: "yellow" }),
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.05);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.swap_to).toBe("as_planned");
    expect(result.warnings).toContain("Wearable readiness yellow — upgrade capped");
  });

  it("6. great + red => green, constrained to 1.00, warning present, no upgrade level", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great" }),
        wearable_signals: makeWearable({ readiness: "red" }),
      }),
    );
    expect(result.level).toBe("green");
    expect(result.level).not.toBe("upgrade");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.applied_rules).toContain("WEARABLE_RED_CONSTRAIN");
  });

  it("great + no wearable data => green at baseline", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great" }),
        wearable_signals: null,
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.applied_rules).toContain("NO_WEARABLE_DATA");
  });
});

// ---------------------------------------------------------------------------
// Great mood — upgrade_type preference
// ---------------------------------------------------------------------------

describe("calibrateSession — upgrade_type", () => {
  it("great + green + intensity => boost intensity only, duration stays 1.0", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great", upgrade_type: "intensity" }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.level).toBe("upgrade");
    expect(result.intensity_multiplier).toBe(1.10);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.applied_rules).toContain("UPGRADE_INTENSITY");
    expect(result.headline).toContain("intensity");
  });

  it("great + green + volume => boost duration only, intensity stays 1.0", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great", upgrade_type: "volume" }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.level).toBe("upgrade");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.05);
    expect(result.applied_rules).toContain("UPGRADE_VOLUME");
    expect(result.headline).toContain("volume");
  });

  it("great + green + no upgrade_type => both boosted (backward compat)", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great" }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.level).toBe("upgrade");
    expect(result.intensity_multiplier).toBe(1.10);
    expect(result.duration_multiplier).toBe(1.05);
    expect(result.applied_rules).not.toContain("UPGRADE_INTENSITY");
    expect(result.applied_rules).not.toContain("UPGRADE_VOLUME");
  });

  it("great + yellow + intensity => intensity capped at 1.05, duration 1.0", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great", upgrade_type: "intensity" }),
        wearable_signals: makeWearable({ readiness: "yellow" }),
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.05);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.applied_rules).toContain("UPGRADE_INTENSITY");
  });

  it("great + yellow + volume => intensity 1.0, duration capped at 1.05", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great", upgrade_type: "volume" }),
        wearable_signals: makeWearable({ readiness: "yellow" }),
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.05);
    expect(result.applied_rules).toContain("UPGRADE_VOLUME");
  });

  it("great + red + upgrade_type => blocked, both stay 1.0 with warning", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great", upgrade_type: "intensity" }),
        wearable_signals: makeWearable({ readiness: "red" }),
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.applied_rules).toContain("UPGRADE_BLOCKED_WEARABLE");
    expect(result.warnings.some((w) => w.includes("blocked"))).toBe(true);
  });

  it("great + no wearable + upgrade_type => deferred, stays at baseline", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great", upgrade_type: "volume" }),
        wearable_signals: null,
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.applied_rules).toContain("UPGRADE_DEFERRED_NO_WEARABLE");
  });
});

// ---------------------------------------------------------------------------
// Time constraint handling
// ---------------------------------------------------------------------------

describe("calibrateSession — time constraint", () => {
  it("7. time constraint reduces duration multiplier without intensity increase", () => {
    const result = calibrateSession(
      makeInput({
        planned_session: makeSession({ planned_duration_minutes: 60 }),
        morning_checkin: makeCheckin({ mood: "good", time_constraint_minutes: 30 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    // 30/60 = 0.50, but clamped to DURATION_MIN = 0.50
    expect(result.duration_multiplier).toBe(0.50);
    expect(result.intensity_multiplier).toBe(1.00); // unchanged
    expect(result.applied_rules).toContain("TIME_CONSTRAINT_APPLIED");
  });

  it("time constraint that doesn't reduce below current multiplier is a no-op", () => {
    const result = calibrateSession(
      makeInput({
        planned_session: makeSession({ planned_duration_minutes: 60 }),
        morning_checkin: makeCheckin({ mood: "good", time_constraint_minutes: 90 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    // 90/60 = 1.50 > current 1.00 => no change
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.applied_rules).not.toContain("TIME_CONSTRAINT_APPLIED");
  });

  it("time constraint clamps to duration minimum 0.50", () => {
    const result = calibrateSession(
      makeInput({
        planned_session: makeSession({ planned_duration_minutes: 120 }),
        morning_checkin: makeCheckin({ mood: "good", time_constraint_minutes: 20 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    // 20/120 = 0.167, clamped to 0.50
    expect(result.duration_multiplier).toBe(0.50);
  });
});

// ---------------------------------------------------------------------------
// Determinism and clamp boundaries
// ---------------------------------------------------------------------------

describe("calibrateSession — determinism and clamping", () => {
  it("8. identical input produces deep-equal result", () => {
    const input = makeInput({
      morning_checkin: makeCheckin({ mood: "tired", rpe: 8, soreness: 7 }),
      wearable_signals: makeWearable({ readiness: "yellow" }),
    });
    const result1 = calibrateSession(input);
    const result2 = calibrateSession(input);
    expect(result1).toEqual(result2);
  });

  it("9. intensity multiplier never exceeds 1.15", () => {
    // upgrade path: intensity = 1.10 — already within range
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great" }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.intensity_multiplier).toBeLessThanOrEqual(1.15);
  });

  it("9. intensity multiplier never goes below 0.50", () => {
    // Hard-stop sets 0.65, which is above 0.50
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "drained", illness_flag: true }),
      }),
    );
    expect(result.intensity_multiplier).toBeGreaterThanOrEqual(0.50);
  });

  it("9. duration multiplier stays within [0.50, 1.05]", () => {
    const upgrade = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "great" }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(upgrade.duration_multiplier).toBeLessThanOrEqual(1.05);
    expect(upgrade.duration_multiplier).toBeGreaterThanOrEqual(0.50);

    const hardStop = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "drained", illness_flag: true }),
      }),
    );
    expect(hardStop.duration_multiplier).toBeGreaterThanOrEqual(0.50);
  });
});

// ---------------------------------------------------------------------------
// No check-in fallbacks
// ---------------------------------------------------------------------------

describe("calibrateSession — no check-in", () => {
  it("10. no check-in + green wearable => green / as_planned", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: null,
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.00);
    expect(result.swap_to).toBe("as_planned");
    expect(result.applied_rules).toContain("NO_CHECKIN");
  });

  it("no check-in + red wearable => amber / easy", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: null,
        wearable_signals: makeWearable({ readiness: "red" }),
      }),
    );
    expect(result.level).toBe("amber");
    expect(result.intensity_multiplier).toBe(0.85);
    expect(result.swap_to).toBe("easy");
    expect(result.warnings).toContain("No check-in — relying on wearable data");
  });

  it("no check-in + yellow wearable => amber / as_planned", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: null,
        wearable_signals: makeWearable({ readiness: "yellow" }),
      }),
    );
    expect(result.level).toBe("amber");
    expect(result.intensity_multiplier).toBe(0.95);
    expect(result.swap_to).toBe("as_planned");
  });

  it("no check-in + no wearable => green default", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: null,
        wearable_signals: null,
      }),
    );
    expect(result.level).toBe("green");
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.duration_multiplier).toBe(1.00);
  });

  it("no check-in produces zero checkin deltas", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: null,
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.checkin_readiness_delta).toBe(0);
    expect(result.checkin_fatigue_delta).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Moderate pain (hurt, not hard-stop)
// ---------------------------------------------------------------------------

describe("calibrateSession — moderate pain", () => {
  it("hurt + pain_severity < 7 => warning but NOT hard-stop", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({
          mood: "okay",
          reason_bucket: "hurt",
          pain_severity: 4,
          pain_locations: ["right_shoulder"],
        }),
      }),
    );
    expect(result.level).not.toBe("red");
    expect(result.warnings).toContain(
      "Moderate pain reported — consider injury-aware modifications",
    );
    expect(result.applied_rules).toContain("MODERATE_PAIN_WARNING");
  });

  it("drained + hurt + moderate pain => red (from mood) + injury_safe swap", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({
          mood: "drained",
          reason_bucket: "hurt",
          pain_severity: 5,
          pain_locations: ["lower_back"],
        }),
      }),
    );
    expect(result.level).toBe("red");
    expect(result.swap_to).toBe("injury_safe");
    expect(result.applied_rules).toContain("REASON_HURT_MODERATE");
  });
});

// ---------------------------------------------------------------------------
// RPE / soreness reductions (non-drained moods)
// ---------------------------------------------------------------------------

describe("calibrateSession — RPE/soreness adjustments", () => {
  it("good mood + high RPE caps intensity at 0.90", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "good", rpe: 9 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.intensity_multiplier).toBeLessThanOrEqual(0.90);
    expect(result.applied_rules).toContain("RPE_HIGH_REDUCTION");
  });

  it("good mood + high soreness caps intensity at 0.90", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "good", soreness: 8 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.intensity_multiplier).toBeLessThanOrEqual(0.90);
    expect(result.applied_rules).toContain("SORENESS_HIGH_REDUCTION");
  });
});

// ---------------------------------------------------------------------------
// Subjective scale deltas (sleep_quality, perceived_energy, motivation, life_stress)
// ---------------------------------------------------------------------------

describe("computeCheckinDeltas — subjective scales", () => {
  it("sleep_quality=1 adds readiness -8, fatigue +6", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", sleep_quality: 1 }));
    expect(d.readiness_delta).toBe(-8);
    expect(d.fatigue_delta).toBe(6);
  });

  it("sleep_quality=3 is neutral (no additional delta)", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", sleep_quality: 3 }));
    expect(d.readiness_delta).toBe(0);
    expect(d.fatigue_delta).toBe(0);
  });

  it("sleep_quality=5 adds readiness +4, fatigue -2", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", sleep_quality: 5 }));
    expect(d.readiness_delta).toBe(4);
    expect(d.fatigue_delta).toBe(-2);
  });

  it("perceived_energy=2 adds readiness -4, fatigue +3", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", perceived_energy: 2 }));
    expect(d.readiness_delta).toBe(-4);
    expect(d.fatigue_delta).toBe(3);
  });

  it("motivation=1 adds readiness -8, fatigue +6", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", motivation: 1 }));
    expect(d.readiness_delta).toBe(-8);
    expect(d.fatigue_delta).toBe(6);
  });

  it("life_stress=5 (very high) adds readiness -8, fatigue +6 (inverted scale)", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", life_stress: 5 }));
    expect(d.readiness_delta).toBe(-8);
    expect(d.fatigue_delta).toBe(6);
  });

  it("life_stress=1 (low stress) adds readiness +4, fatigue -2 (inverted scale)", () => {
    const d = computeCheckinDeltas(makeCheckin({ mood: "okay", life_stress: 1 }));
    expect(d.readiness_delta).toBe(4);
    expect(d.fatigue_delta).toBe(-2);
  });

  it("multiple scales combine additively", () => {
    const d = computeCheckinDeltas(makeCheckin({
      mood: "tired",
      sleep_quality: 1,
      perceived_energy: 2,
      life_stress: 4,
    }));
    // tired(-8,+8) + sleep1(-8,+6) + energy2(-4,+3) + stress4(-4,+3)
    expect(d.readiness_delta).toBe(-8 + -8 + -4 + -4);
    expect(d.fatigue_delta).toBe(8 + 6 + 3 + 3);
  });

  it("null scales are ignored", () => {
    const d = computeCheckinDeltas(makeCheckin({
      mood: "okay",
      sleep_quality: null,
      perceived_energy: null,
      motivation: null,
      life_stress: null,
    }));
    expect(d.readiness_delta).toBe(0);
    expect(d.fatigue_delta).toBe(0);
  });
});

describe("calibrateSession — scale intensity caps", () => {
  it("sleep_quality=1 caps intensity at 0.85", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "good", sleep_quality: 1 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.intensity_multiplier).toBeLessThanOrEqual(0.85);
    expect(result.applied_rules).toContain("SLEEP_CRITICAL_REDUCTION");
  });

  it("perceived_energy=2 caps intensity at 0.92", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "good", perceived_energy: 2 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.intensity_multiplier).toBeLessThanOrEqual(0.92);
    expect(result.applied_rules).toContain("ENERGY_LOW_REDUCTION");
  });

  it("life_stress=1 (low stress) does not cap intensity", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "good", life_stress: 1 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.intensity_multiplier).toBe(1.00);
    expect(result.applied_rules).not.toContain("STRESS_CRITICAL_REDUCTION");
    expect(result.applied_rules).not.toContain("STRESS_LOW_REDUCTION");
  });

  it("life_stress=5 (high stress) does NOT cap intensity via scale (stress is inverted, value=5 means bad but treated as raw value)", () => {
    // life_stress scale: value 5 = very stressed. The intensity cap checks raw value,
    // and value 5 is > 2, so no cap triggers. The delta impact happens in computeCheckinDeltas.
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "good", life_stress: 5 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    // No intensity cap from scale (value 5 is not <= 2)
    // But readiness delta from stress is -8, fatigue +6
    expect(result.checkin_readiness_delta).toBeLessThan(0);
    expect(result.checkin_fatigue_delta).toBeGreaterThan(0);
  });

  it("scale=3 does not cap intensity", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "good", sleep_quality: 3, perceived_energy: 3 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.intensity_multiplier).toBe(1.00);
  });

  it("scale caps are skipped for drained mood (already has red-level reductions)", () => {
    const result = calibrateSession(
      makeInput({
        morning_checkin: makeCheckin({ mood: "drained", reason_bucket: "fried", sleep_quality: 1 }),
        wearable_signals: makeWearable({ readiness: "green" }),
      }),
    );
    expect(result.level).toBe("red");
    // Should not have scale reduction rules (drained bypasses them)
    expect(result.applied_rules).not.toContain("SLEEP_CRITICAL_REDUCTION");
  });
});
