/**
 * Core contracts - public API
 */

// Types
export {
  SchemaVersion,
  type CandidateId,
  type CautionLevel,
  type ReasonCode,
  type EvidenceSummary,
  type RecommendationCandidate,
  type TodayRecommendationResponse,
} from "./recommendation";

// Schemas
export {
  SchemaVersionSchema,
  CandidateIdSchema,
  CautionLevelSchema,
  ReasonCodeSchema,
  EvidenceSummarySchema,
  RecommendationCandidateSchema,
  TodayRecommendationResponseSchema,
} from "./schemas";
