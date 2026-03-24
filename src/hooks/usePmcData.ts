import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface PmcPoint {
  date: string;
  fitness: number;
  fatigue: number;
  form: number;
  tss: number;
}

export function usePmcData(days: number = 90) {
  const { session } = useAuth();
  const [data, setData] = useState<PmcPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPmc = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/goals?action=pmc&days=${days}`, { headers });
      const json = await res.json();

      if (json.ok) {
        setData(json.data);
      } else {
        setError(json.error ?? "Failed to fetch PMC data");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, days]);

  useEffect(() => {
    fetchPmc();
  }, [fetchPmc]);

  return { data, loading, error, refetch: fetchPmc };
}
