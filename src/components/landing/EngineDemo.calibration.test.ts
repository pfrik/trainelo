import { describe, it, expect } from "vitest";
import {
  calibrateSession,
  type CalibratorInput,
  type Mood5,
} from "../../lib/core/checkin/calibrator";

/**
 * Guards the EngineDemo's reserved output height. The demo reserves fixed
 * vertical space for the headline and rationale so the dark card doesn't jump
 * between states. That only holds if the copy stays within budget across every
 * reachable demo state (5 moods x 11 soreness levels x illness on/off). If
 * someone lengthens calibrator copy past these budgets, fail here instead of
 * shipping a card that resizes as the visitor plays with it.
 */
const DEMO_WEARABLE = {
  readiness: "green" as const,
  readiness_score: 72,
  fatigue_score: 38,
};

const MOODS: Mood5[] = ["drained", "tired", "okay", "good", "great"];

const HEADLINE_BUDGET = 60;
const RATIONALE_BUDGET = 190;

describe("EngineDemo calibrator copy budget", () => {
  it("keeps headline and rationale within the demo's reserved height across all states", () => {
    for (const mood of MOODS) {
      for (let soreness = 0; soreness <= 10; soreness++) {
        for (const illness of [false, true]) {
          const input: CalibratorInput = {
            morning_checkin: {
              mood,
              soreness,
              illness_flag: illness,
              rpe: null,
              pain_flag: false,
            },
            wearable_signals: DEMO_WEARABLE,
            planned_session: {
              planned_duration_minutes: 42,
              planned_intensity: null,
            },
          };
          const r = calibrateSession(input);
          const where = `${mood}/soreness=${soreness}/illness=${illness}`;
          expect(
            r.headline.length,
            `headline too long (${where}): "${r.headline}"`,
          ).toBeLessThanOrEqual(HEADLINE_BUDGET);
          expect(
            r.rationale.length,
            `rationale too long (${where}): "${r.rationale}"`,
          ).toBeLessThanOrEqual(RATIONALE_BUDGET);
        }
      }
    }
  });
});
