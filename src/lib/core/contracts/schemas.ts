/**
 * Zod schemas for recommendation contracts.
 * Used for validation at API boundaries.
 */

import { z } from "zod";
import { SchemaVersion } from "./recommendation";

/** Schema version literal */
export const SchemaVersionSchema = z.literal(SchemaVersion);

/** Candidate ID enum schema */
export const CandidateIdSchema = z.enum([
  "scheduled",
  "lite_alternative",
  "rest_day",
  "skip",
]);

/** Caution level enum schema */
export const CautionLevelSchema = z.enum(["none", "low", "moderate", "high"]);

/** Reason code enum schema */
export const ReasonCodeSchema = z.enum([
  "SCHEDULED_WORKOUT_EXISTS",
  "RECOVERY_OPTIMAL",
  "FATIGUE_ELEVATED",
  "FATIGUE_HIGH",
  "SLEEP_POOR",
  "HRV_LOW",
  "HRV_DECLINING",
  "TRAINING_LOAD_HIGH",
  "TRAINING_LOAD_LOW",
  "REST_DAY_DUE",
  "STREAK_RISK",
  "ADAPTATION_PHASE",
  "INSUFFICIENT_DATA",
  "COLD_START",
  "LLM_UNAVAILABLE",
  "USER_PREFERENCE",
]);

/** Evidence summary schema */
export const EvidenceSummarySchema = z.object({
  fatigue_score: z.number().min(0).max(100).nullable(),
  fitness_score: z.number().min(0).max(100).nullable(),
  hrv_trend: z.enum(["rising", "stable", "declining"]).nullable(),
  sleep_quality: z.number().min(0).max(100).nullable(),
  days_since_rest: z.number().int().min(0).nullable(),
  confidence: z.number().min(0).max(1),
});

/** Recommendation candidate schema */
export const RecommendationCandidateSchema = z.object({
  candidate_id: CandidateIdSchema,
  template_ref: z.string().nullable(),
  label: z.string().min(1),
  rationale: z.string().min(1),
  reason_codes: z.array(ReasonCodeSchema).min(1),
  caution_level: CautionLevelSchema,
});

/** Full response schema */
export const TodayRecommendationResponseSchema = z.object({
  schema_version: SchemaVersionSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  user_id: z.string().min(1),
  candidates: z.array(RecommendationCandidateSchema).min(1),
  evidence: EvidenceSummarySchema,
  llm_used: z.boolean(),
  generated_at: z.string().datetime(),
});

/** Choice action enum schema */
export const ChoiceActionSchema = z.enum(["accept", "reject"]);

/** Choice request schema */
export const ChoiceRequestSchema = z.object({
  recommendation_id: z.string().min(1),
  chosen_candidate_id: CandidateIdSchema,
  action: ChoiceActionSchema,
  note: z.string().optional(),
});

/** Choice response schema */
export const ChoiceResponseSchema = z.object({
  schema_version: SchemaVersionSchema,
  recorded: z.boolean(),
  recorded_at: z.string().datetime(),
});
