/**
 * Zod schemas for recommendation contracts.
 * Used for validation at API boundaries.
 */

import { z } from "zod";
import {
  SchemaVersion,
  type TodayRecommendationResponse,
  type ChoiceRequest,
  type ChoiceResponse,
} from "./recommendation.js";

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
  "FORM_POSITIVE",
  "FORM_NEGATIVE",
  "LLM_UNAVAILABLE",
  "USER_PREFERENCE",
  "ANOMALY_HRV_DISSOCIATION",
  "ANOMALY_OVERTRAINING_RISK",
  "ANOMALY_LOW_CONFIDENCE",
  "RHR_ELEVATED",
]);

/** Evidence summary schema */
export const EvidenceSummarySchema = z.object({
  fatigue_score: z.number().min(0).max(100).nullable(),
  fitness_score: z.number().min(0).max(100).nullable(),
  hrv_trend: z.enum(["rising", "stable", "declining"]).nullable(),
  sleep_quality: z.number().min(0).max(100).nullable(),
  days_since_rest: z.number().int().min(0).nullable(),
  confidence: z.number().min(0).max(1),
  last_garmin_sync_at: z.string().nullable().optional(),
  checkin_mood: z.enum(["drained", "tired", "okay", "good", "great"]).nullable().optional(),
  checkin_rpe: z.number().int().min(1).max(10).nullable().optional(),
  checkin_soreness: z.number().int().min(0).max(10).nullable().optional(),
  checkin_pain_flag: z.boolean().nullable().optional(),
  checkin_illness_flag: z.boolean().nullable().optional(),
  checkin_readiness_delta: z.number().int().nullable().optional(),
  checkin_fatigue_delta: z.number().int().nullable().optional(),
  checkin_impact_note: z.string().nullable().optional(),
  calibration_level: z.enum(["red", "amber", "green", "upgrade"]).nullable().optional(),
  calibration_intensity_multiplier: z.number().min(0).max(2).nullable().optional(),
  calibration_duration_multiplier: z.number().min(0).max(2).nullable().optional(),
  calibration_applied_rules: z.array(z.string()).nullable().optional(),
  calibration_warnings: z.array(z.string()).nullable().optional(),
  calibration_headline: z.string().nullable().optional(),
  calibration_rationale: z.string().nullable().optional(),
  calibration_swap_to: z.string().nullable().optional(),
  calibration_safety_flags: z.array(z.string()).nullable().optional(),
  calibration_version: z.number().int().nullable().optional(),
  confidence_data_availability: z.number().min(0).max(1).nullable().optional(),
  confidence_signal_consistency: z.number().min(0).max(1).nullable().optional(),
  confidence_data_recency: z.number().min(0).max(1).nullable().optional(),
  baseline_mode: z.enum(["cold_start", "building", "mature"]).nullable().optional(),
  ewma_fitness_score: z.number().min(0).max(100).nullable().optional(),
  ewma_fatigue_score: z.number().min(0).max(100).nullable().optional(),
  ewma_form_score: z.number().min(-100).max(100).nullable().optional(),
  ewma_fitness_raw: z.number().nullable().optional(),
  ewma_fatigue_raw: z.number().nullable().optional(),
  ewma_cold_start_fatigue: z.boolean().nullable().optional(),
  ewma_cold_start_fitness: z.boolean().nullable().optional(),
  anomaly_caution_level: z.enum(["none", "low", "moderate", "high"]).nullable().optional(),
  anomaly_restrictions: z.array(z.enum(["cap_intensity", "suggest_rest", "require_checkin"])).nullable().optional(),
  anomaly_question_key: z.string().nullable().optional(),
});

/** Workout set schema */
const WorkoutSetSchema = z.object({
  duration_display: z.string(),
  intensity_label: z.string(),
  description: z.string(),
});

/** Calibrated segment schema */
const CalibratedSegmentSchema = z.object({
  type: z.enum(["warmup", "main", "cooldown"]),
  duration_minutes: z.number(),
  description: z.string(),
  target_intensity: z.number().nullable(),
  sets: z.array(WorkoutSetSchema),
});

/** Calibrated workout schema */
const CalibratedWorkoutSchema = z.object({
  template_ref: z.string(),
  label: z.string(),
  type: z.enum(["easy", "recovery", "tempo", "long", "interval", "strength", "mobility"]),
  total_duration_minutes: z.number(),
  segments: z.array(CalibratedSegmentSchema),
  target_km: z.number().nullable(),
  description: z.string(),
  rpe_target: z.number(),
  intensity_multiplier: z.number(),
  duration_multiplier: z.number(),
});

/** Recommendation candidate schema */
export const RecommendationCandidateSchema = z.object({
  candidate_id: CandidateIdSchema,
  template_ref: z.string().nullable(),
  label: z.string().min(1),
  rationale: z.string().min(1),
  reason_codes: z.array(ReasonCodeSchema).min(1),
  caution_level: CautionLevelSchema,
  workout: CalibratedWorkoutSchema.nullable().optional(),
});

/** Full response schema */
export const TodayRecommendationResponseSchema = z.object({
  schema_version: SchemaVersionSchema,
  recommendation_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  user_id: z.string().min(1),
  candidates: z.array(RecommendationCandidateSchema).min(1),
  evidence: EvidenceSummarySchema,
  llm_used: z.boolean(),
  generated_at: z.string().datetime(),
}) as z.ZodType<TodayRecommendationResponse>;

/** Choice action enum schema */
export const ChoiceActionSchema = z.enum(["accept", "reject"]);

/** Choice request schema */
export const ChoiceRequestSchema = z.object({
  recommendation_id: z.string().min(1),
  chosen_candidate_id: CandidateIdSchema,
  action: ChoiceActionSchema,
  note: z.string().optional(),
}) as z.ZodType<ChoiceRequest>;

/** Choice response schema */
export const ChoiceResponseSchema = z.object({
  schema_version: SchemaVersionSchema,
  recorded: z.boolean(),
  recorded_at: z.string().datetime(),
}) as z.ZodType<ChoiceResponse>;
