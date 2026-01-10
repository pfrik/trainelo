/**
 * Pure response builder for today's recommendation endpoint.
 * No IO, no Supabase, deterministic, unit-testable.
 */

import {
  SchemaVersion,
  type TodayRecommendationResponse,
  type RecommendationCandidate,
  type EvidenceSummary,
} from "../contracts/index.js";

/** Input for building a deterministic today response */
export interface TodayResponseInput {
  /** User ID */
  user_id: string;
  /** Date (YYYY-MM-DD) */
  date: string;
  /** ISO timestamp for generated_at */
  generated_at: string;
}

/**
 * Build deterministic evidence summary for cold-start/stub scenarios.
 * Returns null values with low confidence indicating insufficient data.
 */
export function buildColdStartEvidence(): EvidenceSummary {
  return {
    fatigue_score: null,
    fitness_score: null,
    hrv_trend: null,
    sleep_quality: null,
    days_since_rest: null,
    confidence: 0.3,
  };
}

/**
 * Build deterministic candidates for cold-start/stub scenarios.
 * Returns 4 candidates covering scheduled, lite alternative, rest day, and skip options.
 */
export function buildDeterministicCandidates(): RecommendationCandidate[] {
  return [
    {
      candidate_id: "scheduled",
      template_ref: "easy-run-30min",
      label: "Easy Run (30 min)",
      rationale: "A scheduled easy run to maintain your base fitness.",
      reason_codes: ["COLD_START", "SCHEDULED_WORKOUT_EXISTS"],
      caution_level: "low",
    },
    {
      candidate_id: "lite_alternative",
      template_ref: "recovery-jog-20min",
      label: "Recovery Jog (20 min)",
      rationale: "A lighter alternative if you're feeling fatigued.",
      reason_codes: ["COLD_START", "INSUFFICIENT_DATA"],
      caution_level: "none",
    },
    {
      candidate_id: "rest_day",
      template_ref: null,
      label: "Rest Day",
      rationale: "Take a rest day to recover and prepare for future sessions.",
      reason_codes: ["COLD_START", "REST_DAY_DUE"],
      caution_level: "none",
    },
    {
      candidate_id: "skip",
      template_ref: null,
      label: "Skip Today",
      rationale: "Skip today's workout if life gets in the way.",
      reason_codes: ["COLD_START", "USER_PREFERENCE"],
      caution_level: "none",
    },
  ];
}

/**
 * Build a deterministic TodayRecommendationResponse.
 * Used for cold-start scenarios, stubs, and when LLM is unavailable.
 * Pure function: no IO, fully deterministic given inputs.
 */
export function buildDeterministicTodayResponse(
  input: TodayResponseInput
): TodayRecommendationResponse {
  return {
    schema_version: SchemaVersion,
    recommendation_id: `${input.user_id}:${input.date}`,
    date: input.date,
    user_id: input.user_id,
    candidates: buildDeterministicCandidates(),
    evidence: buildColdStartEvidence(),
    llm_used: false,
    generated_at: input.generated_at,
  };
}
