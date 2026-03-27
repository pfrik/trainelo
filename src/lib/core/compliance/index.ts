/**
 * Compliance layer — matching actual workouts against training plans,
 * detecting load surplus, and computing cross-sport transfer.
 */

export type {
  NormalizedSport,
  MatchStatus,
  ComplianceMatchInput,
  ComplianceMatchResult,
  SourceAttribution,
  DailyLoadSurplusInput,
  LoadSurplusResult,
} from "./types.js";

export { normalizeSport, sportToDisplayKey } from "./normalizeSport.js";
export { matchWorkoutToPlanned, matchAllPlannedForDate } from "./matchWorkoutToPlanned.js";
export { computeLoadSurplus } from "./computeLoadSurplus.js";
export { getTransferCoefficient, computeTransferredTss, DEFAULT_TRANSFER_MATRIX } from "./sportTransfer.js";
