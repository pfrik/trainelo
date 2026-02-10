/**
 * Core recommendation contracts - pure types only.
 * No IO, no Supabase, no React dependencies.
 */

/** Schema version for forward compatibility */
export const SchemaVersion = "v1" as const;
export type SchemaVersion = typeof SchemaVersion;

/** Candidate ID union - workout identifiers for today's recommendation */
export type CandidateId =
  | "scheduled"
  | "lite_alternative"
  | "rest_day"
  | "skip";

/** Caution level for recommendation */
export type CautionLevel = "none" | "low" | "moderate" | "high";

/** Reason codes explaining recommendation decisions */
export type ReasonCode =
  | "SCHEDULED_WORKOUT_EXISTS"
  | "RECOVERY_OPTIMAL"
  | "FATIGUE_ELEVATED"
  | "FATIGUE_HIGH"
  | "SLEEP_POOR"
  | "HRV_LOW"
  | "HRV_DECLINING"
  | "TRAINING_LOAD_HIGH"
  | "TRAINING_LOAD_LOW"
  | "REST_DAY_DUE"
  | "STREAK_RISK"
  | "ADAPTATION_PHASE"
  | "INSUFFICIENT_DATA"
  | "COLD_START"
  | "LLM_UNAVAILABLE"
  | "USER_PREFERENCE";

/** Evidence summary - data points supporting the recommendation */
export interface EvidenceSummary {
  /** Current fatigue estimate (0-100) */
  fatigue_score: number | null;
  /** Current fitness estimate (0-100) */
  fitness_score: number | null;
  /** Recent HRV trend indicator */
  hrv_trend: "rising" | "stable" | "declining" | null;
  /** Sleep quality from last night (0-100) */
  sleep_quality: number | null;
  /** Days since last rest day */
  days_since_rest: number | null;
  /** Confidence in the recommendation (0-1) */
  confidence: number;
  /** Last Garmin sync timestamp (ISO 8601), if available */
  last_garmin_sync_at?: string | null;
}

/** A single recommendation candidate */
export interface RecommendationCandidate {
  /** Unique candidate identifier */
  candidate_id: CandidateId;
  /** Reference to workout template (if applicable) */
  template_ref: string | null;
  /** Human-readable label */
  label: string;
  /** Short explanation for the user */
  rationale: string;
  /** Reason codes supporting this candidate */
  reason_codes: ReasonCode[];
  /** Caution level for this option */
  caution_level: CautionLevel;
}

/** Full response for today's recommendation endpoint */
export interface TodayRecommendationResponse {
  /** Schema version for client compatibility */
  schema_version: SchemaVersion;
  /** Unique recommendation ID for choice tracking (format: userId:date) */
  recommendation_id: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** User ID */
  user_id: string;
  /** Ordered list of candidates (first is primary recommendation) */
  candidates: RecommendationCandidate[];
  /** Evidence supporting the recommendation */
  evidence: EvidenceSummary;
  /** Whether LLM was used for selection */
  llm_used: boolean;
  /** Processing timestamp (ISO 8601) */
  generated_at: string;
}

/** Action taken on a recommendation */
export type ChoiceAction = "accept" | "reject";

/** Request payload for choice endpoint */
export interface ChoiceRequest {
  /** Recommendation ID (for audit trail) */
  recommendation_id: string;
  /** Chosen candidate ID */
  chosen_candidate_id: CandidateId;
  /** Action taken */
  action: ChoiceAction;
  /** Optional user note */
  note?: string;
}

/** Response from choice endpoint */
export interface ChoiceResponse {
  /** Schema version for client compatibility */
  schema_version: SchemaVersion;
  /** Whether the choice was recorded */
  recorded: boolean;
  /** Timestamp of the choice (ISO 8601) */
  recorded_at: string;
}
