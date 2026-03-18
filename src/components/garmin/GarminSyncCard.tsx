import { useGarminSyncStatus } from "@/hooks/useGarminSyncStatus";

/** Friendly labels for Garmin data types */
const DATA_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  activities: { label: "Activities", icon: "directions_run" },
  daily_summary: { label: "Daily Metrics", icon: "monitoring" },
  sleep: { label: "Sleep", icon: "dark_mode" },
  hrv: { label: "HRV", icon: "favorite" },
};

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function freshnessColor(hours: number | null): { dot: string; text: string } {
  if (hours === null) return { dot: "bg-slate-400", text: "text-slate-400" };
  if (hours <= 7) return { dot: "bg-green-500", text: "text-green-400" };
  if (hours <= 24) return { dot: "bg-amber-500", text: "text-amber-400" };
  return { dot: "bg-red-500", text: "text-red-400" };
}

export function GarminSyncCard() {
  const { data, loading, error } = useGarminSyncStatus();

  if (loading) {
    return (
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-dark-surface-lighter animate-pulse" />
          <div className="h-4 w-32 bg-slate-100 dark:bg-dark-surface-lighter rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center space-x-3 mb-2">
          <span className="material-symbols-outlined text-slate-400" style={{ fontVariationSettings: '"FILL" 1' }}>watch</span>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Garmin Connect</h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Unable to load sync status</p>
      </div>
    );
  }

  if (!data || !data.connected) {
    return (
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center space-x-3 mb-2">
          <span className="material-symbols-outlined text-slate-400" style={{ fontVariationSettings: '"FILL" 1' }}>watch</span>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Garmin Connect</h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">No sync data yet. Waiting for first sync to complete.</p>
      </div>
    );
  }

  const freshness = freshnessColor(data.data_freshness_hours);

  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>watch</span>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Garmin Connect</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${freshness.dot}`} />
          <span className={`text-xs font-medium ${freshness.text}`}>
            {data.last_synced_at ? formatRelativeTime(data.last_synced_at) : "Never"}
          </span>
        </div>
      </div>

      {/* Data type rows */}
      <div className="space-y-2">
        {data.sync_types.map((st) => {
          const meta = DATA_TYPE_LABELS[st.data_type] || { label: st.data_type, icon: "database" };
          const synced = st.last_synced_at !== null;

          return (
            <div
              key={st.data_type}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-dark-surface-lighter"
            >
              <div className="flex items-center space-x-2">
                <span
                  className={`material-symbols-outlined text-sm ${synced ? "text-slate-600 dark:text-slate-300" : "text-slate-400"}`}
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  {meta.icon}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {meta.label}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {st.record_count != null && (
                  <span className="text-xs text-slate-400">{st.record_count} records</span>
                )}
                {synced ? (
                  <span className="material-symbols-outlined text-green-500 text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                ) : (
                  <span className="material-symbols-outlined text-slate-400 text-sm">pending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Freshness note */}
      {data.data_freshness_hours !== null && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          Data refreshes every 6 hours automatically
        </p>
      )}
    </div>
  );
}
