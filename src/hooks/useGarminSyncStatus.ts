import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface SyncType {
  data_type: string;
  last_synced_at: string | null;
  record_count: number | null;
  status: string | null;
}

export interface GarminSyncStatus {
  connected: boolean;
  provider: "garmin";
  last_synced_at: string | null;
  sync_types: SyncType[];
  data_freshness_hours: number | null;
}

interface UseGarminSyncStatusResult {
  data: GarminSyncStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGarminSyncStatus(): UseGarminSyncStatusResult {
  const [data, setData] = useState<GarminSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {};

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/garmin/sync-status", {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const json = await response.json();
      setData(json as GarminSyncStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { data, loading, error, refetch: fetchStatus };
}
