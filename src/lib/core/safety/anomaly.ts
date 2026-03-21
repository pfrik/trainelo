/**
 * Confidence-gated, multi-signal anomaly detector.
 * Pure function — no IO, no side effects.
 *
 * Sits between computeReadinessAndFatigue (step 3) and
 * generateDailyRecommendation (step 4) in the pipeline.
 *
 * Detects dangerous signal patterns the tier system misses:
 *  - HRV_DISSOCIATION: body stressed but readiness looks normal
 *  - OVERTRAINING_RISK: three-signal convergence
 *  - LOW_CONFIDENCE_ANOMALY: data unreliable in non-cold-start mode
 */

import type { ReadinessAndFatigueOutput } from "../recommendations/computeReadinessAndFatigue.js";
import type { ReasonCode, CautionLevel, Restriction } from "../contracts/index.js";
import type { TrendState } from "../recommendations/detectTrends.js";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface AnomalyResult {
  caution_level: CautionLevel;
  reason_codes: ReasonCode[];
  restrictions: Restriction[];
  question_key: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CAUTION_ORDER: CautionLevel[] = ["none", "low", "moderate", "high"];

function maxCaution(a: CautionLevel, b: CautionLevel): CautionLevel {
  return CAUTION_ORDER.indexOf(a) >= CAUTION_ORDER.indexOf(b) ? a : b;
}

function findTrend(
  trendStates: TrendState[] | undefined,
  metric: TrendState["metric"],
): TrendState | undefined {
  return trendStates?.find((t) => t.metric === metric);
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Readiness at or above which HRV_DISSOCIATION can fire (normal tier). */
const READINESS_NORMAL_THRESHOLD = 65;

/** Minimum confidence for confidence-gated rules (1, 2). */
const CONFIDENCE_GATE = 0.5;

/** Minimum HRV quality for Rule 1. */
const HRV_QUALITY_GATE = 0.6;

/** Form score below which OVERTRAINING_RISK can fire. */
const FORM_OVERTRAINING_THRESHOLD = -15;

/** Fatigue at or above which OVERTRAINING_RISK can fire. */
const FATIGUE_OVERTRAINING_THRESHOLD = 60;

/** Confidence below which LOW_CONFIDENCE_ANOMALY fires. */
const LOW_CONFIDENCE_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function detectAnomalies(
  input: ReadinessAndFatigueOutput,
): AnomalyResult {
  let caution: CautionLevel = "none";
  const reasonCodes: ReasonCode[] = [];
  const restrictions: Restriction[] = [];
  let questionKey: string | null = null;

  const confidence = input.confidence?.overall;
  const baselineMode = input.baseline_mode;
  const hrvTrend = findTrend(input.trend_states, "hrv");
  const hrvQuality = input.signal_validity?.hrv?.quality;

  // -----------------------------------------------------------------------
  // Rule 1: HRV_DISSOCIATION (caution: moderate)
  // HRV declining (confirmed) but readiness ≥ 65 — body stressed, scores mask it
  // -----------------------------------------------------------------------
  if (
    confidence != null &&
    confidence >= CONFIDENCE_GATE &&
    hrvQuality != null &&
    hrvQuality >= HRV_QUALITY_GATE &&
    hrvTrend?.direction === "declining" &&
    hrvTrend.confirmation === "confirmed" &&
    input.readiness_score >= READINESS_NORMAL_THRESHOLD
  ) {
    caution = maxCaution(caution, "moderate");
    reasonCodes.push("ANOMALY_HRV_DISSOCIATION");
    if (!restrictions.includes("cap_intensity")) {
      restrictions.push("cap_intensity");
    }
    questionKey = questionKey ?? "how_do_you_feel_today";
  }

  // -----------------------------------------------------------------------
  // Rule 2: OVERTRAINING_RISK (caution: high)
  // Three-signal convergence: HRV declining (confirmed) + form < -15 + fatigue ≥ 60
  // -----------------------------------------------------------------------
  if (
    confidence != null &&
    confidence >= CONFIDENCE_GATE &&
    hrvTrend?.direction === "declining" &&
    hrvTrend.confirmation === "confirmed" &&
    input.ewma != null &&
    input.ewma.form_score < FORM_OVERTRAINING_THRESHOLD &&
    input.fatigue_score >= FATIGUE_OVERTRAINING_THRESHOLD
  ) {
    caution = maxCaution(caution, "high");
    reasonCodes.push("ANOMALY_OVERTRAINING_RISK");
    if (!restrictions.includes("cap_intensity")) {
      restrictions.push("cap_intensity");
    }
    if (!restrictions.includes("suggest_rest")) {
      restrictions.push("suggest_rest");
    }
    // OVERTRAINING_RISK has no question_key (null) — don't overwrite existing
  }

  // -----------------------------------------------------------------------
  // Rule 3: LOW_CONFIDENCE_ANOMALY (caution: low)
  // Confidence < 0.3 in building/mature mode (not cold_start)
  // -----------------------------------------------------------------------
  if (
    confidence != null &&
    confidence < LOW_CONFIDENCE_THRESHOLD &&
    baselineMode != null &&
    (baselineMode === "building" || baselineMode === "mature") &&
    !input.reason_codes.includes("COLD_START")
  ) {
    caution = maxCaution(caution, "low");
    reasonCodes.push("ANOMALY_LOW_CONFIDENCE");
    if (!restrictions.includes("require_checkin")) {
      restrictions.push("require_checkin");
    }
    questionKey = questionKey ?? "data_seems_stale";
  }

  return {
    caution_level: caution,
    reason_codes: reasonCodes,
    restrictions,
    question_key: questionKey,
  };
}
