import { describe, it, expect } from "vitest";
import {
  TodayRecommendationResponseSchema,
  CandidateIdSchema,
} from "./schemas";
import type { TodayRecommendationResponse } from "./recommendation";

describe("TodayRecommendationResponseSchema", () => {
  const validResponse: TodayRecommendationResponse = {
    schema_version: "v1",
    recommendation_id: "user-123:2025-01-15",
    date: "2025-01-15",
    user_id: "user-123",
    candidates: [
      {
        candidate_id: "scheduled",
        template_ref: "tempo-run-30min",
        label: "Scheduled Tempo Run",
        rationale: "You have a tempo run scheduled for today.",
        reason_codes: ["SCHEDULED_WORKOUT_EXISTS"],
        caution_level: "none",
      },
      {
        candidate_id: "lite_alternative",
        template_ref: "easy-jog-20min",
        label: "Easy Jog",
        rationale: "A lighter alternative if you need it.",
        reason_codes: ["FATIGUE_ELEVATED"],
        caution_level: "low",
      },
    ],
    evidence: {
      fatigue_score: 45,
      fitness_score: 62,
      hrv_trend: "stable",
      sleep_quality: 78,
      days_since_rest: 2,
      confidence: 0.85,
    },
    llm_used: false,
    generated_at: "2025-01-15T08:30:00.000Z",
  };

  it("parses a valid TodayRecommendationResponse", () => {
    const result = TodayRecommendationResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schema_version).toBe("v1");
      expect(result.data.candidates).toHaveLength(2);
      expect(result.data.evidence.confidence).toBe(0.85);
    }
  });

  it("rejects response with invalid candidate_id", () => {
    const invalidResponse = {
      ...validResponse,
      candidates: [
        {
          ...validResponse.candidates[0],
          candidate_id: "invalid_candidate",
        },
      ],
    };
    const result = TodayRecommendationResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it("rejects response with invalid schema_version", () => {
    const invalidResponse = {
      ...validResponse,
      schema_version: "v2",
    };
    const result = TodayRecommendationResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it("rejects response with empty candidates array", () => {
    const invalidResponse = {
      ...validResponse,
      candidates: [],
    };
    const result = TodayRecommendationResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it("rejects candidate with empty reason_codes", () => {
    const invalidResponse = {
      ...validResponse,
      candidates: [
        {
          ...validResponse.candidates[0],
          reason_codes: [],
        },
      ],
    };
    const result = TodayRecommendationResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });
});

describe("CandidateIdSchema", () => {
  it("accepts valid candidate IDs", () => {
    expect(CandidateIdSchema.safeParse("scheduled").success).toBe(true);
    expect(CandidateIdSchema.safeParse("lite_alternative").success).toBe(true);
    expect(CandidateIdSchema.safeParse("rest_day").success).toBe(true);
    expect(CandidateIdSchema.safeParse("skip").success).toBe(true);
  });

  it("rejects invalid candidate_id", () => {
    const result = CandidateIdSchema.safeParse("invalid_id");
    expect(result.success).toBe(false);
  });
});
