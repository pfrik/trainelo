/**
 * Pure, deterministic candidate generation for daily recommendations.
 * No IO — all inputs arrive via parameters.
 *
 * Consumes readiness/fatigue state (compatible with computeReadinessAndFatigue
 * output) and produces an ordered list of recommendation candidates.
 */

import type {
  ReasonCode,
  CautionLevel,
  RecommendationCandidate,
} from "../contracts";

// ---------------------------------------------------------------------------
// Input types (local to this module)
// ---------------------------------------------------------------------------

/** Readiness/fatigue state — structurally compatible with ReadinessAndFatigueOutput. */
export interface DailyState {
  /** 0-100 overall readiness to train. */
  readiness_score: number;
  /** 0-100 accumulated fatigue from recent training load. */
  fatigue_score: number;
  /** Non-empty reason codes from the scoring step. */
  reason_codes: ReasonCode[];
}

/** Minimal recent history needed for decision logic. */
export interface DailyHistory {
  /** Consecutive days with at least one workout, up to today (0 = last day was rest). */
  consecutive_training_days: number;
}

/** User-side scheduling constraints. */
export interface DailyConstraints {
  /** Whether a workout is already scheduled for today. */
  has_scheduled_workout: boolean;
  /** Template ref for the scheduled workout (null = use default). */
  scheduled_template_ref: string | null;
}

// ---------------------------------------------------------------------------
// Thresholds (explicit, rule-based)
// ---------------------------------------------------------------------------

/** fatigue_score at/above which the rest tier triggers. */
const FATIGUE_HIGH = 75;
/** fatigue_score at/above which the moderate tier triggers. */
const FATIGUE_MODERATE = 50;
/** readiness_score below which the rest tier triggers. */
const READINESS_LOW = 40;
/** readiness_score below which the moderate tier triggers. */
const READINESS_MODERATE = 65;
/** Consecutive training days at/above which REST_DAY_DUE fires. */
const REST_DAY_DUE_DAYS = 7;

// ---------------------------------------------------------------------------
// Decision tiers
// ---------------------------------------------------------------------------

type Tier = "rest" | "insufficient_data" | "moderate" | "normal";

function classifyTier(state: DailyState, history: DailyHistory): Tier {
  // 1. Safety net — absolute fatigue/readiness or overdue rest
  if (
    state.fatigue_score >= FATIGUE_HIGH ||
    state.readiness_score < READINESS_LOW ||
    history.consecutive_training_days >= REST_DAY_DUE_DAYS
  ) {
    return "rest";
  }

  // 2. Insufficient data — conservative (least intervention)
  const hasInsufficientData =
    state.reason_codes.includes("INSUFFICIENT_DATA") ||
    state.reason_codes.includes("COLD_START");

  if (hasInsufficientData) {
    return "insufficient_data";
  }

  // 3. Moderate concern
  if (
    state.fatigue_score >= FATIGUE_MODERATE ||
    state.readiness_score < READINESS_MODERATE
  ) {
    return "moderate";
  }

  // 4. Normal — evidence supports full training
  return "normal";
}

// ---------------------------------------------------------------------------
// Candidate builders
// ---------------------------------------------------------------------------

function mkScheduled(
  state: DailyState,
  constraints: DailyConstraints,
  tier: Tier,
): RecommendationCandidate {
  const templateRef = constraints.has_scheduled_workout
    ? (constraints.scheduled_template_ref ?? "easy-run-30min")
    : "easy-run-30min";

  const reasons: ReasonCode[] = [];
  if (constraints.has_scheduled_workout) {
    reasons.push("SCHEDULED_WORKOUT_EXISTS");
  }

  let cautionLevel: CautionLevel;
  let rationale: string;

  switch (tier) {
    case "normal":
      cautionLevel = "none";
      reasons.push("RECOVERY_OPTIMAL");
      rationale = constraints.has_scheduled_workout
        ? "Your scheduled workout — recovery signals support completing it."
        : "Recovery signals are strong — you're ready for a full session.";
      break;

    case "insufficient_data":
      cautionLevel = "low";
      reasons.push("INSUFFICIENT_DATA");
      rationale = constraints.has_scheduled_workout
        ? "Your scheduled workout — limited data but no red flags detected."
        : "A standard session — limited data but no red flags detected.";
      break;

    case "moderate":
      cautionLevel = "low";
      appendStateReasons(reasons, state.reason_codes);
      rationale =
        "Your full workout is available, though a lighter session may be more beneficial.";
      break;

    case "rest":
      cautionLevel = "high";
      appendStateReasons(reasons, state.reason_codes);
      rationale =
        "Training today is possible but recovery signals suggest caution.";
      break;
  }

  // Guarantee non-empty — tier-aware fallback avoids contradictions
  // (e.g. RECOVERY_OPTIMAL on a rest-tier candidate).
  if (reasons.length === 0) {
    switch (tier) {
      case "normal":
        reasons.push("RECOVERY_OPTIMAL");
        break;
      case "insufficient_data":
        reasons.push("INSUFFICIENT_DATA");
        break;
      case "moderate":
        reasons.push("FATIGUE_ELEVATED");
        break;
      case "rest":
        reasons.push("FATIGUE_HIGH");
        break;
    }
  }

  return {
    candidate_id: "scheduled",
    template_ref: templateRef,
    label: "Scheduled Workout",
    rationale,
    reason_codes: reasons,
    caution_level: cautionLevel,
  };
}

function mkLite(state: DailyState, tier: Tier): RecommendationCandidate {
  const reasons: ReasonCode[] = [];
  let cautionLevel: CautionLevel = "none";
  let rationale: string;

  switch (tier) {
    case "normal":
    case "insufficient_data":
      reasons.push("USER_PREFERENCE");
      rationale = "A lighter option if you prefer to go easy today.";
      break;
    case "moderate":
      reasons.push("FATIGUE_ELEVATED");
      appendStateReasons(reasons, state.reason_codes);
      rationale = "A lighter session to stay active while managing fatigue.";
      break;
    case "rest":
      reasons.push("FATIGUE_ELEVATED");
      cautionLevel = "moderate";
      appendStateReasons(reasons, state.reason_codes);
      rationale =
        "Light movement is an option, but full rest may serve you better.";
      break;
  }

  return {
    candidate_id: "lite_alternative",
    template_ref: "recovery-jog-20min",
    label: "Recovery Jog (20 min)",
    rationale,
    reason_codes: reasons,
    caution_level: cautionLevel,
  };
}

function mkRest(
  state: DailyState,
  restDayDue: boolean,
  tier: Tier,
): RecommendationCandidate {
  const reasons: ReasonCode[] = [];
  let rationale: string;

  if (tier === "rest") {
    const hasFatigueEvidence =
      state.fatigue_score >= FATIGUE_HIGH ||
      state.reason_codes.includes("FATIGUE_HIGH") ||
      state.reason_codes.includes("TRAINING_LOAD_HIGH");
    if (hasFatigueEvidence) reasons.push("FATIGUE_HIGH");
    if (restDayDue) reasons.push("REST_DAY_DUE");
    appendStateReasons(reasons, state.reason_codes);
    if (reasons.length === 0) reasons.push("USER_PREFERENCE");
    rationale = "Recovery signals suggest a full rest day.";
  } else {
    if (restDayDue) {
      reasons.push("REST_DAY_DUE");
    } else {
      reasons.push("USER_PREFERENCE");
    }
    rationale = "Take a rest day if you need it.";
  }

  return {
    candidate_id: "rest_day",
    template_ref: null,
    label: "Rest Day",
    rationale,
    reason_codes: reasons,
    caution_level: "none",
  };
}

function mkSkip(): RecommendationCandidate {
  return {
    candidate_id: "skip",
    template_ref: null,
    label: "Skip Today",
    rationale: "Skip today's session if life gets in the way.",
    reason_codes: ["USER_PREFERENCE"],
    caution_level: "none",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Append state reason codes to an existing list, avoiding duplicates and RECOVERY_OPTIMAL. */
function appendStateReasons(
  target: ReasonCode[],
  stateReasons: ReasonCode[],
): void {
  for (const rc of stateReasons) {
    if (rc !== "RECOVERY_OPTIMAL" && !target.includes(rc)) {
      target.push(rc);
    }
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Generate an ordered list of recommendation candidates based on the
 * athlete's current readiness/fatigue state, recent history, and
 * scheduling constraints.
 *
 * The first candidate is the primary recommendation.
 * Always returns exactly 4 candidates (scheduled, lite, rest, skip)
 * ordered by suitability for the current tier.
 *
 * Least-intervention policy: prefers `scheduled` unless evidence
 * (fatigue, recovery, training streak) is strong enough to override.
 */
export function generateDailyRecommendation(
  state: DailyState,
  history: DailyHistory,
  constraints: DailyConstraints,
): RecommendationCandidate[] {
  const tier = classifyTier(state, history);
  const restDayDue = history.consecutive_training_days >= REST_DAY_DUE_DAYS;

  const scheduled = mkScheduled(state, constraints, tier);
  const lite = mkLite(state, tier);
  const rest = mkRest(state, restDayDue, tier);
  const skip = mkSkip();

  switch (tier) {
    case "normal":
    case "insufficient_data":
      return [scheduled, lite, rest, skip];

    case "moderate":
      return [lite, scheduled, rest, skip];

    case "rest":
      return [rest, lite, scheduled, skip];
  }
}
