import { describe, it, expect } from "vitest";
import {
  buildColdStartEvidence,
  buildDeterministicCandidates,
  buildDeterministicTodayResponse,
} from "./todayResponseBuilder";
import {
  TodayRecommendationResponseSchema,
  EvidenceSummarySchema,
  RecommendationCandidateSchema,
} from "../contracts";

describe("buildColdStartEvidence", () => {
  it("returns evidence with null data and low confidence", () => {
    const evidence = buildColdStartEvidence();

    expect(evidence.fatigue_score).toBeNull();
    expect(evidence.fitness_score).toBeNull();
    expect(evidence.hrv_trend).toBeNull();
    expect(evidence.sleep_quality).toBeNull();
    expect(evidence.days_since_rest).toBeNull();
    expect(evidence.confidence).toBe(0.3);
  });

  it("passes schema validation", () => {
    const evidence = buildColdStartEvidence();
    const result = EvidenceSummarySchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });
});

describe("buildDeterministicCandidates", () => {
  it("returns 4 candidates with expected IDs", () => {
    const candidates = buildDeterministicCandidates();

    expect(candidates).toHaveLength(4);
    expect(candidates.map((c) => c.candidate_id)).toEqual([
      "scheduled",
      "lite_alternative",
      "rest_day",
      "skip",
    ]);
  });

  it("each candidate has template_ref (scheduled/lite) or null (rest/skip)", () => {
    const candidates = buildDeterministicCandidates();

    const scheduled = candidates.find((c) => c.candidate_id === "scheduled");
    const lite = candidates.find((c) => c.candidate_id === "lite_alternative");
    const rest = candidates.find((c) => c.candidate_id === "rest_day");
    const skip = candidates.find((c) => c.candidate_id === "skip");

    expect(scheduled?.template_ref).toBe("easy-run-30min");
    expect(lite?.template_ref).toBe("recovery-jog-20min");
    expect(rest?.template_ref).toBeNull();
    expect(skip?.template_ref).toBeNull();
  });

  it("each candidate has at least one reason code", () => {
    const candidates = buildDeterministicCandidates();
    candidates.forEach((candidate) => {
      expect(candidate.reason_codes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("all candidates include COLD_START reason code", () => {
    const candidates = buildDeterministicCandidates();
    candidates.forEach((candidate) => {
      expect(candidate.reason_codes).toContain("COLD_START");
    });
  });

  it("each candidate passes schema validation", () => {
    const candidates = buildDeterministicCandidates();
    candidates.forEach((candidate) => {
      const result = RecommendationCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);
    });
  });
});

describe("buildDeterministicTodayResponse", () => {
  const input = {
    user_id: "user-123",
    date: "2025-01-15",
    generated_at: "2025-01-15T08:00:00.000Z",
  };

  it("returns response with correct metadata", () => {
    const response = buildDeterministicTodayResponse(input);

    expect(response.schema_version).toBe("v1");
    expect(response.user_id).toBe("user-123");
    expect(response.date).toBe("2025-01-15");
    expect(response.generated_at).toBe("2025-01-15T08:00:00.000Z");
    expect(response.llm_used).toBe(false);
  });

  it("includes 4 candidates", () => {
    const response = buildDeterministicTodayResponse(input);
    expect(response.candidates).toHaveLength(4);
  });

  it("includes evidence with low confidence", () => {
    const response = buildDeterministicTodayResponse(input);
    expect(response.evidence.confidence).toBe(0.3);
  });

  it("is deterministic (same input produces same output)", () => {
    const response1 = buildDeterministicTodayResponse(input);
    const response2 = buildDeterministicTodayResponse(input);
    expect(response1).toEqual(response2);
  });

  it("passes full schema validation", () => {
    const response = buildDeterministicTodayResponse(input);
    const result = TodayRecommendationResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("uses input values correctly", () => {
    const customInput = {
      user_id: "custom-user",
      date: "2025-06-20",
      generated_at: "2025-06-20T12:30:00.000Z",
    };
    const response = buildDeterministicTodayResponse(customInput);

    expect(response.user_id).toBe("custom-user");
    expect(response.date).toBe("2025-06-20");
    expect(response.generated_at).toBe("2025-06-20T12:30:00.000Z");
  });
});
