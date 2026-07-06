import type { SyncFreshness } from "@/hooks/useSyncOnOpen";

interface DataFreshnessProps {
  syncing: boolean;
  freshness: SyncFreshness | null;
}

function formatSyncTime(iso: string): string {
  const synced = new Date(iso);
  const now = new Date();
  const sameDay =
    synced.getFullYear() === now.getFullYear() &&
    synced.getMonth() === now.getMonth() &&
    synced.getDate() === now.getDate();
  if (sameDay) {
    return synced.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return synced.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Calm one-line indicator of how fresh today's wearable data is.
 * Icon + text pairing (color is never the only signal).
 */
export function DataFreshness({ syncing, freshness }: DataFreshnessProps) {
  if (!syncing && !freshness) return null;

  if (syncing) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined text-sm animate-spin" aria-hidden>progress_activity</span>
        <span>Checking for new data…</span>
      </span>
    );
  }

  const isFresh = freshness!.has_sleep && freshness!.has_hrv;
  const syncedAt = freshness!.last_sync_completed_at;

  if (isFresh) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span
          className="material-symbols-outlined text-sm text-primary"
          style={{ fontVariationSettings: '"FILL" 1' }}
          aria-hidden
        >
          check_circle
        </span>
        <span>Data up to date{syncedAt ? ` · synced ${formatSyncTime(syncedAt)}` : ""}</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400">
      <span className="material-symbols-outlined text-sm" aria-hidden>schedule</span>
      <span>Waiting for watch sync — showing latest available data</span>
    </span>
  );
}
