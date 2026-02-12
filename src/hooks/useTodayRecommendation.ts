import { useState, useEffect, useCallback } from "react";
import {
  TodayRecommendationResponseSchema,
  ChoiceRequestSchema,
  type TodayRecommendationResponse,
  type ChoiceRequest,
} from "@/lib/core/contracts";
import { useAuth } from "@/contexts/AuthContext";

interface UseTodayRecommendationResult {
  data: TodayRecommendationResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  submitChoice: (
    candidateId: ChoiceRequest["chosen_candidate_id"],
    action: ChoiceRequest["action"]
  ) => Promise<boolean>;
  /** The candidate_id currently being submitted, or null if idle. */
  submittingCandidateId: string | null;
  submitting: boolean;
  choiceError: string | null;
}

export function useTodayRecommendation(): UseTodayRecommendationResult {
  const [data, setData] = useState<TodayRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingCandidateId, setSubmittingCandidateId] = useState<string | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchRecommendation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/recommendation/today", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const json: unknown = await response.json();
      const parsed = TodayRecommendationResponseSchema.safeParse(json);

      if (!parsed.success) {
        console.error("Validation error:", parsed.error);
        throw new Error("Invalid response format from server");
      }

      setData(parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  const submitChoice = useCallback(
    async (
      candidateId: ChoiceRequest["chosen_candidate_id"],
      action: ChoiceRequest["action"]
    ): Promise<boolean> => {
      if (!data) return false;

      const payload: ChoiceRequest = {
        recommendation_id: data.recommendation_id,
        chosen_candidate_id: candidateId,
        action,
      };

      // Validate payload before sending
      const validation = ChoiceRequestSchema.safeParse(payload);
      if (!validation.success) {
        console.error("Choice payload validation failed:", validation.error);
        return false;
      }

      setSubmittingCandidateId(candidateId);
      setChoiceError(null);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const response = await fetch("/api/recommendation/choice", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Choice submission failed: ${response.status}`);
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save choice";
        setChoiceError(message);
        console.error("Failed to submit choice:", err);
        return false;
      } finally {
        setSubmittingCandidateId(null);
      }
    },
    [data, session?.access_token]
  );

  useEffect(() => {
    fetchRecommendation();
  }, [fetchRecommendation]);

  return {
    data,
    loading,
    error,
    refetch: fetchRecommendation,
    submitChoice,
    submittingCandidateId,
    submitting: submittingCandidateId !== null,
    choiceError,
  };
}
