/**
 * Enforce anomaly restrictions on recommendation candidates.
 * Pure function — no IO.
 *
 * Sits after detectAnomalies + applyCandidateCalibration in the pipeline.
 * Applies restrictions that the anomaly detector flagged.
 */

import type { RecommendationCandidate, CautionLevel } from "../contracts/recommendation.js";
import type { AnomalyResult } from "./anomaly.js";

// ============================================================================
// Helpers
// ============================================================================

const CAUTION_ORDER: CautionLevel[] = ["none", "low", "moderate", "high"];

function escalateCaution(current: CautionLevel, minimum: CautionLevel): CautionLevel {
  return CAUTION_ORDER.indexOf(current) >= CAUTION_ORDER.indexOf(minimum)
    ? current
    : minimum;
}

// ============================================================================
// Main function
// ============================================================================

export interface AnomalyRestrictionResult {
  /** Candidates after restriction enforcement (may be reordered). */
  candidates: RecommendationCandidate[];
  /** Intensity cap applied (null if no cap). */
  intensityCap: number | null;
  /** Whether a check-in is required before training. */
  checkinRequired: boolean;
}

/**
 * Apply anomaly restrictions to candidates.
 *
 * - `cap_intensity`: Escalates caution on workout candidates to at least "moderate".
 *   Returns an intensity cap of 0.85 for the calibrator.
 * - `suggest_rest`: Promotes rest_day to primary candidate.
 * - `require_checkin`: Sets checkinRequired flag for the frontend.
 */
export function applyAnomalyRestrictions(
  candidates: RecommendationCandidate[],
  anomalyResult: AnomalyResult,
  hasCheckin: boolean,
): AnomalyRestrictionResult {
  const { restrictions } = anomalyResult;

  if (restrictions.length === 0) {
    return { candidates, intensityCap: null, checkinRequired: false };
  }

  let adjusted = candidates.map((c) => ({ ...c }));
  let intensityCap: number | null = null;
  let checkinRequired = false;

  // --- cap_intensity ---
  if (restrictions.includes("cap_intensity")) {
    intensityCap = 0.85;
    adjusted = adjusted.map((c) => {
      if (c.candidate_id === "scheduled" || c.candidate_id === "lite_alternative") {
        return {
          ...c,
          caution_level: escalateCaution(c.caution_level, "moderate"),
          rationale: c.rationale + " Intensity is capped due to anomaly detection.",
        };
      }
      return c;
    });
  }

  // --- suggest_rest ---
  if (restrictions.includes("suggest_rest")) {
    const restIdx = adjusted.findIndex((c) => c.candidate_id === "rest_day");
    if (restIdx > 0) {
      const rest = adjusted.splice(restIdx, 1)[0];
      rest.rationale = "Recovery signals indicate elevated risk — rest is strongly recommended.";
      adjusted.unshift(rest);
    }
  }

  // --- require_checkin ---
  if (restrictions.includes("require_checkin") && !hasCheckin) {
    checkinRequired = true;
  }

  return { candidates: adjusted, intensityCap, checkinRequired };
}
