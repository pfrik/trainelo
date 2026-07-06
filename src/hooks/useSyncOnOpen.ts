import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface SyncFreshness {
  date: string;
  has_sleep: boolean;
  has_hrv: boolean;
  last_sync_completed_at: string | null;
}

interface SyncRefreshResponse {
  ok: boolean;
  synced: boolean;
  skipped_reason: "fresh" | "recently_synced" | null;
  freshness: SyncFreshness;
}

interface UseSyncOnOpenResult {
  /** True while the staleness check / pull is in flight. */
  syncing: boolean;
  freshness: SyncFreshness | null;
}

/** Local calendar date as YYYY-MM-DD (the athlete's "today"). */
function localDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Sync-on-open: when the dashboard mounts, asks the backend to pull today's
 * wellness from intervals.icu if it's missing (the 4:00 UTC cron often runs
 * before the watch has synced). Calls `onFreshData` when new data arrived so
 * the caller can refetch the recommendation.
 */
export function useSyncOnOpen(onFreshData?: () => void): UseSyncOnOpenResult {
  const [syncing, setSyncing] = useState(false);
  const [freshness, setFreshness] = useState<SyncFreshness | null>(null);
  const { session } = useAuth();
  const startedRef = useRef(false);
  const onFreshDataRef = useRef(onFreshData);
  onFreshDataRef.current = onFreshData;

  useEffect(() => {
    if (!session?.access_token || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    (async () => {
      setSyncing(true);
      try {
        const response = await fetch("/api/sync/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ date: localDate() }),
        });
        if (!response.ok) return; // 403 for non-configured users, etc. — stay quiet

        const json = (await response.json()) as SyncRefreshResponse;
        if (cancelled) return;

        setFreshness(json.freshness);
        if (json.synced) {
          onFreshDataRef.current?.();
        }
      } catch (err) {
        console.warn("sync-on-open failed:", err);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  return { syncing, freshness };
}
