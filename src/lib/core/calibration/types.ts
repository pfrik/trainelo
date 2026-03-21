/**
 * Type definitions for passive calibration (auto-detection of personal thresholds).
 */

// ============================================================================
// Threshold Types
// ============================================================================

/** Threshold types that can be auto-detected from wearable data. */
export type ThresholdType = "hr_max" | "resting_hr" | "hrv_baseline";

// ============================================================================
// Detection Inputs
// ============================================================================

/** A single workout max HR sample for HR Max detection. */
export interface WorkoutHRSample {
  date: string;
  max_heart_rate: number;
  duration_seconds: number;
}

/** A single resting HR sample for Resting HR detection. */
export interface RestingHRSample {
  date: string;
  resting_heart_rate: number;
}

/** A single HRV sample for HRV Baseline detection. */
export interface HRVSample {
  date: string;
  hrv_rmssd: number;
}

// ============================================================================
// Confidence Scoring
// ============================================================================

/** Confidence level derived from numeric score. */
export type ConfidenceLevel = "low" | "medium" | "high";

/** Confidence output from a detector. */
export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
}

// ============================================================================
// Detection Outputs
// ============================================================================

/** Result from a single threshold detection. Null means insufficient data. */
export interface DetectionResult {
  value: number;
  confidence: ConfidenceResult;
  dataPoints: number;
  method: string;
}

// ============================================================================
// Orchestrator Types
// ============================================================================

/** Reason a threshold was skipped during orchestration. */
export type SkipReason =
  | "insufficient_data"
  | "low_confidence"
  | "locked"
  | "cooldown"
  | "no_change";

/** Outcome for a single threshold type during calibration. */
export interface ThresholdDecision {
  thresholdType: ThresholdType;
  action: "applied" | "skipped";
  skipReason?: SkipReason;
  detectedValue?: number;
  previousValue?: number | null;
  confidence?: ConfidenceResult;
}

/** Overall result of passive calibration for one user. */
export interface CalibrationRunResult {
  userId: string;
  targetDate: string;
  applied: number;
  skipped: number;
  decisions: ThresholdDecision[];
}

// ============================================================================
// Configuration
// ============================================================================

/** Minimum confidence score to auto-apply a threshold. */
export const CONFIDENCE_GATES: Record<ThresholdType, number> = {
  hr_max: 0.6,
  resting_hr: 0.5,
  hrv_baseline: 0.5,
};

/** Minimum change required to trigger an update. */
export const SIGNIFICANT_CHANGE: Record<ThresholdType, number> = {
  hr_max: 2,       // bpm
  resting_hr: 2,   // bpm
  hrv_baseline: 3, // ms
};

/** Cooldown duration for undo window (days). */
export const UNDO_DEADLINE_DAYS = 7;
