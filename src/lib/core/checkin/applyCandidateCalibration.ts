/**
 * Pure function: applies calibration results to recommendation candidates.
 * Re-orders candidates based on swap suggestion, adjusts caution levels,
 * and appends calibration context to rationale.
 *
 * No IO — deterministic given inputs.
 */

import type {
  RecommendationCandidate,
  CautionLevel,
  CandidateId,
} from "../contracts/recommendation.js";
import type { CalibrationResult, SwapSuggestion } from "./calibrator.js";

// ---------------------------------------------------------------------------
// Swap → preferred candidate mapping
// ---------------------------------------------------------------------------

/** Which candidate_id the swap suggestion wants promoted to primary. */
const SWAP_TO_CANDIDATE: Record<SwapSuggestion, CandidateId | null> = {
  rest: "rest_day",
  recovery: "lite_alternative",
  easy: "lite_alternative",
  mobility: "rest_day",
  cross_train: "lite_alternative",
  injury_safe: "lite_alternative",
  as_planned: null, // no re-order
  harder_variant: null, // keep scheduled
};

// ---------------------------------------------------------------------------
// Caution level escalation
// ---------------------------------------------------------------------------

const CAUTION_RANK: Record<CautionLevel, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

/** Return the stricter of two caution levels. */
function maxCaution(a: CautionLevel, b: CautionLevel): CautionLevel {
  return CAUTION_RANK[a] >= CAUTION_RANK[b] ? a : b;
}

/** Minimum caution the primary candidate should have based on calibration level. */
function cautionForCalibrationLevel(level: CalibrationResult["level"]): CautionLevel {
  switch (level) {
    case "red":
      return "high";
    case "amber":
      return "moderate";
    case "green":
    case "upgrade":
      return "none";
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Apply calibration to an ordered list of recommendation candidates.
 *
 * Effects:
 * 1. Re-orders candidates if calibrator suggests a swap (rest, recovery, etc.)
 * 2. Escalates caution level on the primary candidate based on calibration level
 * 3. Appends calibration headline to the primary candidate's rationale
 *
 * Returns a new array (does not mutate the input).
 * If calibration is null, returns a shallow copy unchanged.
 */
export function applyCandidateCalibration(
  candidates: RecommendationCandidate[],
  calibration: CalibrationResult | null,
): RecommendationCandidate[] {
  if (!calibration || candidates.length === 0) {
    return [...candidates];
  }

  let result = candidates.map((c) => ({ ...c }));

  // --- Step 1: Re-order based on swap suggestion ---
  const preferredId = SWAP_TO_CANDIDATE[calibration.swap_to];
  if (preferredId) {
    const preferredIndex = result.findIndex((c) => c.candidate_id === preferredId);
    if (preferredIndex > 0) {
      const [promoted] = result.splice(preferredIndex, 1);
      result = [promoted, ...result];
    }
  }

  // --- Step 2: Escalate caution on primary candidate ---
  const minCaution = cautionForCalibrationLevel(calibration.level);
  result[0] = {
    ...result[0],
    caution_level: maxCaution(result[0].caution_level, minCaution),
  };

  // --- Step 3: Append calibration headline to primary rationale ---
  if (calibration.headline) {
    const existing = result[0].rationale;
    const alreadyContains = existing.includes(calibration.headline);
    if (!alreadyContains) {
      result[0] = {
        ...result[0],
        rationale: `${calibration.headline}. ${existing}`,
      };
    }
  }

  return result;
}
