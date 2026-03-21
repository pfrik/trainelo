/**
 * Passive calibration module — auto-detection of personal thresholds.
 */

export {
  detectHRMax,
  detectRestingHR,
  detectHRVBaseline,
  hasSignificantChange,
  computeConfidenceScore,
} from "./detectThresholds.js";

export { runPassiveCalibration } from "./orchestrate.js";

export type {
  ThresholdType,
  WorkoutHRSample,
  RestingHRSample,
  HRVSample,
  ConfidenceLevel,
  ConfidenceResult,
  DetectionResult,
  SkipReason,
  ThresholdDecision,
  CalibrationRunResult,
} from "./types.js";

export { CONFIDENCE_GATES, SIGNIFICANT_CHANGE, UNDO_DEADLINE_DAYS } from "./types.js";
