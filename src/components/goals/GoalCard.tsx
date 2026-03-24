import type { Goal } from "@/hooks/useGoals";

const SPORT_ICONS: Record<string, string> = {
  running: "directions_run",
  cycling: "pedal_bike",
  triathlon: "pool",
  swimming: "pool",
};

const PHASE_COLORS: Record<string, string> = {
  base: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  build: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  peak: "bg-red-500/20 text-red-400 border-red-500/30",
  taper: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  recovery: "bg-slate-700/50 text-slate-400 border-slate-600/30",
};

interface GoalCardProps {
  goal: Goal;
  onDelete: (id: string) => void;
}

export function GoalCard({ goal, onDelete }: GoalCardProps) {
  const daysUntilRace = goal.target_date
    ? Math.max(
        0,
        Math.ceil(
          (new Date(goal.target_date + "T00:00:00").getTime() - Date.now()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  const weeksUntilRace = daysUntilRace != null ? Math.ceil(daysUntilRace / 7) : null;
  const isPlanActive = goal.plan_status === "active";

  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>
              {SPORT_ICONS[goal.sport ?? ""] ?? "flag"}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{goal.title}</h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
              {goal.sport && <span className="capitalize">{goal.sport}</span>}
              {goal.race_distance_km && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                  <span>{goal.race_distance_km}km</span>
                </>
              )}
              {goal.priority && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                  goal.priority === "A"
                    ? "bg-primary/20 text-primary border-primary/30"
                    : goal.priority === "B"
                      ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                      : "bg-slate-700/50 text-slate-400 border-slate-600"
                }`}>
                  {goal.priority}-Race
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => onDelete(goal.id)}
          className="p-2 text-slate-500 dark:text-slate-500 hover:text-red-400 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-surface-lighter transition-colors"
        >
          <span className="material-symbols-outlined text-xl">delete</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {goal.target_date && (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">Race Date</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {new Date(goal.target_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        )}
        {daysUntilRace != null && (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">Countdown</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {daysUntilRace === 0 ? "Race day!" : `${daysUntilRace}d (${weeksUntilRace}w)`}
            </div>
          </div>
        )}
        {goal.target_time_minutes && (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">Target</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {Math.floor(goal.target_time_minutes / 60)}h {goal.target_time_minutes % 60}m
            </div>
          </div>
        )}
        {isPlanActive && goal.peak_weekly_volume_km && (
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1">Peak Volume</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {goal.peak_weekly_volume_km}km/wk
            </div>
          </div>
        )}
      </div>

      {/* Plan status */}
      {isPlanActive && goal.plan_weeks && (
        <div className="flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent rounded-xl p-4 border border-primary/20">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>trending_up</span>
            <div>
              <div className="text-sm font-bold text-white">Training Plan Active</div>
              <div className="text-xs text-slate-400">
                {goal.plan_weeks} weeks
                {goal.current_weekly_volume_km
                  ? ` · Started at ${goal.current_weekly_volume_km}km/wk`
                  : ""}
              </div>
            </div>
          </div>
          <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded border border-green-500/20">
            Active
          </span>
        </div>
      )}

      {goal.plan_status === "draft" && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500">
          <span className="material-symbols-outlined text-base">hourglass_empty</span>
          Plan not yet generated
        </div>
      )}
    </div>
  );
}
