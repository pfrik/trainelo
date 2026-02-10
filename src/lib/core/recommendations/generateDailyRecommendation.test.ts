import { describe, it, expect } from "vitest";
import {
  generateDailyRecommendation,
  type DailyState,
  type DailyHistory,
  type DailyConstraints,
} from "./generateDailyRecommendation";
import type {
  ReasonCode,
  CandidateId,
  CautionLevel,
  RecommendationCandidate,
} from "../contracts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const normalState: DailyState = {
  readiness_score: 78,
  fatigue_score: 30,
  reason_codes: ["RECOVERY_OPTIMAL"],
};

const moderateState: DailyState = {
  readiness_score: 55,
  fatigue_score: 55,
  reason_codes: ["FATIGUE_ELEVATED", "SLEEP_POOR"],
};

const highFatigueState: DailyState = {
  readiness_score: 30,
  fatigue_score: 80,
  reason_codes: ["FATIGUE_HIGH", "HRV_LOW", "TRAINING_LOAD_HIGH"],
};

const insufficientDataState: DailyState = {
  readiness_score: 50,
  fatigue_score: 0,
  reason_codes: ["INSUFFICIENT_DATA"],
};

const coldStartState: DailyState = {
  readiness_score: 50,
  fatigue_score: 0,
  reason_codes: ["COLD_START"],
};

const freshHistory: DailyHistory = { consecutive_training_days: 2 };
const longStreakHistory: DailyHistory = { consecutive_training_days: 7 };

const scheduledConstraints: DailyConstraints = {
  has_scheduled_workout: true,
  scheduled_template_ref: "tempo-run-45min",
};

const noScheduleConstraints: DailyConstraints = {
  has_scheduled_workout: false,
  scheduled_template_ref: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CANDIDATE_IDS: CandidateId[] = [
  "scheduled",
  "lite_alternative",
  "rest_day",
  "skip",
];

const VALID_CAUTION_LEVELS: CautionLevel[] = [
  "none",
  "low",
  "moderate",
  "high",
];

function primaryId(
  candidates: RecommendationCandidate[],
): CandidateId {
  return candidates[0].candidate_id;
}

function candidateById(
  candidates: RecommendationCandidate[],
  id: CandidateId,
): RecommendationCandidate {
  return candidates.find((c) => c.candidate_id === id)!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateDailyRecommendation", () => {
  // ======= Invariants =====================================================

  describe("output invariants", () => {
    const cases: [string, DailyState][] = [
      ["normal", normalState],
      ["moderate", moderateState],
      ["high fatigue", highFatigueState],
      ["insufficient data", insufficientDataState],
      ["cold start", coldStartState],
    ];

    it.each(cases)("returns exactly 4 candidates for %s state", (_, state) => {
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(result).toHaveLength(4);
    });

    it.each(cases)(
      "includes all 4 candidate IDs for %s state",
      (_, state) => {
        const result = generateDailyRecommendation(
          state,
          freshHistory,
          noScheduleConstraints,
        );
        const ids = result.map((c) => c.candidate_id);
        expect(ids).toEqual(expect.arrayContaining(VALID_CANDIDATE_IDS));
      },
    );

    it.each(cases)(
      "every candidate has non-empty reason_codes for %s state",
      (_, state) => {
        const result = generateDailyRecommendation(
          state,
          freshHistory,
          noScheduleConstraints,
        );
        result.forEach((c) => {
          expect(
            c.reason_codes.length,
            `${c.candidate_id} should have non-empty reason_codes`,
          ).toBeGreaterThanOrEqual(1);
        });
      },
    );

    it.each(cases)(
      "every candidate has a valid caution_level for %s state",
      (_, state) => {
        const result = generateDailyRecommendation(
          state,
          freshHistory,
          noScheduleConstraints,
        );
        result.forEach((c) => {
          expect(VALID_CAUTION_LEVELS).toContain(c.caution_level);
        });
      },
    );

    it.each(cases)(
      "every candidate has non-empty label and rationale for %s state",
      (_, state) => {
        const result = generateDailyRecommendation(
          state,
          freshHistory,
          noScheduleConstraints,
        );
        result.forEach((c) => {
          expect(c.label.length).toBeGreaterThan(0);
          expect(c.rationale.length).toBeGreaterThan(0);
        });
      },
    );

    it("is deterministic (same input produces same output)", () => {
      const a = generateDailyRecommendation(
        normalState,
        freshHistory,
        scheduledConstraints,
      );
      const b = generateDailyRecommendation(
        normalState,
        freshHistory,
        scheduledConstraints,
      );
      expect(a).toEqual(b);
    });

    it("non-empty reason_codes for streak-triggered rest tier", () => {
      // normalState + longStreakHistory → rest tier via streak, not fatigue
      const result = generateDailyRecommendation(
        normalState,
        longStreakHistory,
        noScheduleConstraints,
      );
      result.forEach((c) => {
        expect(
          c.reason_codes.length,
          `${c.candidate_id} should have non-empty reason_codes in streak-triggered rest`,
        ).toBeGreaterThanOrEqual(1);
      });
    });

    it("non-empty reason_codes for low-readiness rest tier without fatigue evidence", () => {
      const state: DailyState = {
        readiness_score: 35,
        fatigue_score: 40,
        reason_codes: ["HRV_LOW"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      result.forEach((c) => {
        expect(
          c.reason_codes.length,
          `${c.candidate_id} should have non-empty reason_codes in low-readiness rest`,
        ).toBeGreaterThanOrEqual(1);
      });
    });

    it("skip is always last", () => {
      for (const state of [
        normalState,
        moderateState,
        highFatigueState,
        insufficientDataState,
      ]) {
        const result = generateDailyRecommendation(
          state,
          freshHistory,
          noScheduleConstraints,
        );
        expect(result[3].candidate_id).toBe("skip");
      }
    });
  });

  // ======= Normal scenario ================================================

  describe("normal scenario — scheduled primary", () => {
    it("puts scheduled first when readiness is high and fatigue is low", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("scheduled");
    });

    it("scheduled has caution none", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(candidateById(result, "scheduled").caution_level).toBe("none");
    });

    it("scheduled includes RECOVERY_OPTIMAL reason", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "scheduled").reason_codes,
      ).toContain("RECOVERY_OPTIMAL");
    });

    it("uses custom template_ref when scheduled workout exists", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        scheduledConstraints,
      );
      const sched = candidateById(result, "scheduled");
      expect(sched.template_ref).toBe("tempo-run-45min");
      expect(sched.reason_codes).toContain("SCHEDULED_WORKOUT_EXISTS");
    });

    it("uses default template_ref when no scheduled workout", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(candidateById(result, "scheduled").template_ref).toBe(
        "easy-run-30min",
      );
    });

    it("lite_alternative always uses recovery-jog-20min template", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(candidateById(result, "lite_alternative").template_ref).toBe(
        "recovery-jog-20min",
      );
    });

    it("rest_day and skip have null template_ref", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(candidateById(result, "rest_day").template_ref).toBeNull();
      expect(candidateById(result, "skip").template_ref).toBeNull();
    });
  });

  // ======= Moderate fatigue ===============================================

  describe("moderate fatigue — lite_alternative primary", () => {
    it("puts lite_alternative first", () => {
      const result = generateDailyRecommendation(
        moderateState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("lite_alternative");
    });

    it("scheduled drops to second with caution low", () => {
      const result = generateDailyRecommendation(
        moderateState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(result[1].candidate_id).toBe("scheduled");
      expect(result[1].caution_level).toBe("low");
    });

    it("scheduled carries forward state reason codes", () => {
      const result = generateDailyRecommendation(
        moderateState,
        freshHistory,
        noScheduleConstraints,
      );
      const sched = candidateById(result, "scheduled");
      expect(sched.reason_codes).toContain("SLEEP_POOR");
    });

    it("triggers at readiness < 65 even with low fatigue", () => {
      const state: DailyState = {
        readiness_score: 60,
        fatigue_score: 20,
        reason_codes: ["SLEEP_POOR"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("lite_alternative");
    });

    it("triggers at fatigue >= 50 even with decent readiness", () => {
      const state: DailyState = {
        readiness_score: 70,
        fatigue_score: 50,
        reason_codes: ["TRAINING_LOAD_HIGH"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("lite_alternative");
    });
  });

  // ======= High fatigue / poor recovery ===================================

  describe("high fatigue — rest_day primary", () => {
    it("puts rest_day first when fatigue >= 75", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("rest_day");
    });

    it("rest_day includes FATIGUE_HIGH reason", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "rest_day").reason_codes,
      ).toContain("FATIGUE_HIGH");
    });

    it("rest_day carries forward state reasons (HRV_LOW, etc.)", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      const rest = candidateById(result, "rest_day");
      expect(rest.reason_codes).toContain("HRV_LOW");
      expect(rest.reason_codes).toContain("TRAINING_LOAD_HIGH");
    });

    it("lite_alternative gets moderate caution", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(candidateById(result, "lite_alternative").caution_level).toBe(
        "moderate",
      );
    });

    it("scheduled gets high caution", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(candidateById(result, "scheduled").caution_level).toBe("high");
    });

    it("triggers at readiness < 40", () => {
      const state: DailyState = {
        readiness_score: 35,
        fatigue_score: 40,
        reason_codes: ["HRV_LOW"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("rest_day");
    });

    it("triggers when consecutive training days >= 7", () => {
      const result = generateDailyRecommendation(
        normalState, // would normally be "normal" tier
        longStreakHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("rest_day");
    });

    it("includes REST_DAY_DUE when streak is long", () => {
      const result = generateDailyRecommendation(
        normalState,
        longStreakHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "rest_day").reason_codes,
      ).toContain("REST_DAY_DUE");
    });
  });

  // ======= Insufficient data / cold start =================================

  describe("insufficient data — cautious scheduled primary", () => {
    it("keeps scheduled first (least intervention)", () => {
      const result = generateDailyRecommendation(
        insufficientDataState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("scheduled");
    });

    it("scheduled has low caution", () => {
      const result = generateDailyRecommendation(
        insufficientDataState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(candidateById(result, "scheduled").caution_level).toBe("low");
    });

    it("scheduled includes INSUFFICIENT_DATA reason", () => {
      const result = generateDailyRecommendation(
        insufficientDataState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "scheduled").reason_codes,
      ).toContain("INSUFFICIENT_DATA");
    });

    it("behaves the same for COLD_START", () => {
      const result = generateDailyRecommendation(
        coldStartState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("scheduled");
      expect(candidateById(result, "scheduled").caution_level).toBe("low");
    });

    it("rest tier overrides insufficient data when fatigue is extreme", () => {
      const state: DailyState = {
        readiness_score: 25,
        fatigue_score: 85,
        reason_codes: ["INSUFFICIENT_DATA", "TRAINING_LOAD_HIGH"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("rest_day");
    });
  });

  // ======= Mixed signals ==================================================

  describe("mixed signals", () => {
    it("good sleep + high load → moderate (lite first)", () => {
      const state: DailyState = {
        readiness_score: 58,
        fatigue_score: 60,
        reason_codes: ["TRAINING_LOAD_HIGH"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("lite_alternative");
    });

    it("poor sleep + low load → moderate (lite first)", () => {
      const state: DailyState = {
        readiness_score: 55,
        fatigue_score: 15,
        reason_codes: ["SLEEP_POOR"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("lite_alternative");
    });

    it("borderline readiness 65 + fatigue 49 → normal", () => {
      const state: DailyState = {
        readiness_score: 65,
        fatigue_score: 49,
        reason_codes: ["RECOVERY_OPTIMAL"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("scheduled");
    });

    it("borderline readiness 64 → moderate", () => {
      const state: DailyState = {
        readiness_score: 64,
        fatigue_score: 30,
        reason_codes: ["HRV_LOW"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("lite_alternative");
    });

    it("borderline readiness 40 → not rest (exactly at threshold)", () => {
      const state: DailyState = {
        readiness_score: 40,
        fatigue_score: 30,
        reason_codes: ["INSUFFICIENT_DATA"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      // readiness 40 >= 40 (not < 40), so not rest tier.
      // But INSUFFICIENT_DATA → insufficient_data tier → scheduled first.
      expect(primaryId(result)).not.toBe("rest_day");
    });

    it("borderline readiness 39 → rest", () => {
      const state: DailyState = {
        readiness_score: 39,
        fatigue_score: 30,
        reason_codes: ["HRV_LOW"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(primaryId(result)).toBe("rest_day");
    });
  });

  // ======= Reason-code semantics ==========================================

  describe("reason-code semantics", () => {
    it("scheduled in rest tier never includes RECOVERY_OPTIMAL", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "scheduled").reason_codes,
      ).not.toContain("RECOVERY_OPTIMAL");
    });

    it("scheduled in rest tier uses FATIGUE_HIGH fallback when state reasons are empty after filtering", () => {
      // State with only RECOVERY_OPTIMAL — gets filtered by appendStateReasons
      const state: DailyState = {
        readiness_score: 30,
        fatigue_score: 80,
        reason_codes: ["RECOVERY_OPTIMAL"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      const sched = candidateById(result, "scheduled");
      expect(sched.reason_codes).toContain("FATIGUE_HIGH");
      expect(sched.reason_codes).not.toContain("RECOVERY_OPTIMAL");
    });

    it("scheduled in moderate tier uses FATIGUE_ELEVATED fallback when state reasons are empty after filtering", () => {
      const state: DailyState = {
        readiness_score: 55,
        fatigue_score: 55,
        reason_codes: ["RECOVERY_OPTIMAL"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      const sched = candidateById(result, "scheduled");
      expect(sched.reason_codes).toContain("FATIGUE_ELEVATED");
      expect(sched.reason_codes).not.toContain("RECOVERY_OPTIMAL");
    });

    it("lite in normal tier does not include FATIGUE_ELEVATED", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "lite_alternative").reason_codes,
      ).not.toContain("FATIGUE_ELEVATED");
    });

    it("lite in normal tier includes USER_PREFERENCE", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "lite_alternative").reason_codes,
      ).toContain("USER_PREFERENCE");
    });

    it("lite in insufficient_data tier does not include FATIGUE_ELEVATED", () => {
      const result = generateDailyRecommendation(
        insufficientDataState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "lite_alternative").reason_codes,
      ).not.toContain("FATIGUE_ELEVATED");
    });

    it("lite in insufficient_data tier includes USER_PREFERENCE", () => {
      const result = generateDailyRecommendation(
        insufficientDataState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "lite_alternative").reason_codes,
      ).toContain("USER_PREFERENCE");
    });

    it("lite in moderate tier includes FATIGUE_ELEVATED", () => {
      const result = generateDailyRecommendation(
        moderateState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "lite_alternative").reason_codes,
      ).toContain("FATIGUE_ELEVATED");
    });

    it("lite in rest tier includes FATIGUE_ELEVATED", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "lite_alternative").reason_codes,
      ).toContain("FATIGUE_ELEVATED");
    });

    it("lite in rest tier carries forward state reasons", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      const lite = candidateById(result, "lite_alternative");
      expect(lite.reason_codes).toContain("HRV_LOW");
      expect(lite.reason_codes).toContain("TRAINING_LOAD_HIGH");
    });

    // --- rest_day reason-code refinement (FATIGUE_HIGH conditional) ---

    it("rest_day from long streak alone does not include FATIGUE_HIGH", () => {
      // normalState: fatigue:30 (well below 75), reason_codes: ["RECOVERY_OPTIMAL"]
      // longStreakHistory: consecutive_training_days:7 → rest tier via streak
      const result = generateDailyRecommendation(
        normalState,
        longStreakHistory,
        noScheduleConstraints,
      );
      const rest = candidateById(result, "rest_day");
      expect(rest.reason_codes).not.toContain("FATIGUE_HIGH");
      expect(rest.reason_codes).toContain("REST_DAY_DUE");
    });

    it("rest_day from low readiness without fatigue evidence does not include FATIGUE_HIGH", () => {
      const state: DailyState = {
        readiness_score: 35,
        fatigue_score: 40,
        reason_codes: ["HRV_LOW"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      const rest = candidateById(result, "rest_day");
      expect(rest.reason_codes).not.toContain("FATIGUE_HIGH");
      expect(rest.reason_codes).toContain("HRV_LOW");
    });

    it("rest_day from actual high fatigue score still includes FATIGUE_HIGH", () => {
      // fatigue:80 >= FATIGUE_HIGH(75) → evidence supports FATIGUE_HIGH
      const state: DailyState = {
        readiness_score: 35,
        fatigue_score: 80,
        reason_codes: ["SLEEP_POOR"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "rest_day").reason_codes,
      ).toContain("FATIGUE_HIGH");
    });

    it("rest_day includes FATIGUE_HIGH when state reasons contain TRAINING_LOAD_HIGH", () => {
      // TRAINING_LOAD_HIGH is fatigue/high-load evidence → FATIGUE_HIGH warranted
      const state: DailyState = {
        readiness_score: 35,
        fatigue_score: 40,
        reason_codes: ["TRAINING_LOAD_HIGH"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "rest_day").reason_codes,
      ).toContain("FATIGUE_HIGH");
    });

    it("rest_day includes FATIGUE_HIGH when state reasons contain explicit FATIGUE_HIGH", () => {
      const result = generateDailyRecommendation(
        highFatigueState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(result, "rest_day").reason_codes,
      ).toContain("FATIGUE_HIGH");
    });

    it("rest_day from low readiness with only RECOVERY_OPTIMAL has non-empty reasons without FATIGUE_HIGH", () => {
      // Edge case: rest tier via low readiness, no fatigue evidence,
      // and appendStateReasons filters out RECOVERY_OPTIMAL.
      // Must still have non-empty reason_codes with a valid fallback.
      const state: DailyState = {
        readiness_score: 35,
        fatigue_score: 40,
        reason_codes: ["RECOVERY_OPTIMAL"],
      };
      const result = generateDailyRecommendation(
        state,
        freshHistory,
        noScheduleConstraints,
      );
      const rest = candidateById(result, "rest_day");
      expect(rest.reason_codes.length).toBeGreaterThanOrEqual(1);
      expect(rest.reason_codes).not.toContain("FATIGUE_HIGH");
      expect(rest.reason_codes).not.toContain("RECOVERY_OPTIMAL");
    });

    it("rest_day ordering remains rest-first in rest tier after refinement", () => {
      // Streak-only rest: ordering should still be [rest, lite, scheduled, skip]
      const result = generateDailyRecommendation(
        normalState,
        longStreakHistory,
        noScheduleConstraints,
      );
      expect(result.map((c) => c.candidate_id)).toEqual([
        "rest_day",
        "lite_alternative",
        "scheduled",
        "skip",
      ]);
    });
  });

  // ======= Constraints ====================================================

  describe("scheduling constraints", () => {
    it("uses scheduled_template_ref when has_scheduled_workout is true", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        scheduledConstraints,
      );
      expect(candidateById(result, "scheduled").template_ref).toBe(
        "tempo-run-45min",
      );
    });

    it("falls back to easy-run-30min when has_scheduled_workout but no ref", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        { has_scheduled_workout: true, scheduled_template_ref: null },
      );
      expect(candidateById(result, "scheduled").template_ref).toBe(
        "easy-run-30min",
      );
    });

    it("uses easy-run-30min when no scheduled workout", () => {
      const result = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(candidateById(result, "scheduled").template_ref).toBe(
        "easy-run-30min",
      );
    });

    it("SCHEDULED_WORKOUT_EXISTS only present when has_scheduled_workout", () => {
      const withSched = generateDailyRecommendation(
        normalState,
        freshHistory,
        scheduledConstraints,
      );
      const withoutSched = generateDailyRecommendation(
        normalState,
        freshHistory,
        noScheduleConstraints,
      );
      expect(
        candidateById(withSched, "scheduled").reason_codes,
      ).toContain("SCHEDULED_WORKOUT_EXISTS");
      expect(
        candidateById(withoutSched, "scheduled").reason_codes,
      ).not.toContain("SCHEDULED_WORKOUT_EXISTS");
    });
  });
});
