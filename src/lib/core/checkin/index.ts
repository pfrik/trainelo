/**
 * Check-in module — pure calibration logic.
 */

export {
  calibrateSession,
  computeCheckinDeltas,
  blendSubjectiveSignal,
  type SignalContribution,
  type Mood5,
  type WearableReadiness,
  type ReasonBucket,
  type CalibrationLevel,
  type SwapSuggestion,
  type UpgradeType,
  type CheckinInput,
  type PlannedSessionInput,
  type WearableSignalsInput,
  type CalibratorInput,
  type CalibrationResult,
  type CheckinDeltas,
} from "./calibrator.js";

export { applyCandidateCalibration, type ApplyCalibrationOptions } from "./applyCandidateCalibration.js";
