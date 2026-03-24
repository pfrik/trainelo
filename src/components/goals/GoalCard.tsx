import { Target, Calendar, Timer, TrendingUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Goal } from "@/hooks/useGoals";

const PHASE_COLORS: Record<string, string> = {
  base: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  build: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  peak: "bg-red-500/20 text-red-400 border-red-500/30",
  taper: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  recovery: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const SPORT_ICONS: Record<string, string> = {
  running: "directions_run",
  cycling: "pedal_bike",
  triathlon: "pool",
  swimming: "pool",
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
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg text-primary">
              {SPORT_ICONS[goal.sport ?? ""] ?? "flag"}
            </span>
          </div>
          <div>
            <div className="font-semibold leading-tight">{goal.title}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              {goal.sport && (
                <span className="capitalize">{goal.sport}</span>
              )}
              {goal.race_distance_km && (
                <>
                  <span className="text-border">·</span>
                  <span>{goal.race_distance_km}km</span>
                </>
              )}
              {goal.priority && (
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-1 text-xs px-1.5 py-0",
                    goal.priority === "A" && "border-primary text-primary",
                    goal.priority === "B" && "border-orange-400 text-orange-400",
                    goal.priority === "C" && "border-muted-foreground",
                  )}
                >
                  {goal.priority}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(goal.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        {goal.target_date && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {new Date(goal.target_date + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              )}
            </span>
          </div>
        )}
        {daysUntilRace != null && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Timer className="h-3.5 w-3.5" />
            <span>
              {daysUntilRace === 0
                ? "Race day!"
                : `${daysUntilRace}d (${weeksUntilRace}w)`}
            </span>
          </div>
        )}
        {goal.target_time_minutes && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            <span>
              {Math.floor(goal.target_time_minutes / 60)}h{" "}
              {goal.target_time_minutes % 60}m
            </span>
          </div>
        )}
      </div>

      {/* Plan status */}
      {isPlanActive && goal.plan_weeks && (
        <div className="rounded-md bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Training Plan Active</span>
            </div>
            <span className="text-muted-foreground">
              {goal.plan_weeks} weeks
            </span>
          </div>
          {goal.peak_weekly_volume_km && (
            <div className="text-xs text-muted-foreground">
              Peak volume: {goal.peak_weekly_volume_km}km/week
              {goal.current_weekly_volume_km
                ? ` (started at ${goal.current_weekly_volume_km}km/week)`
                : ""}
            </div>
          )}
        </div>
      )}

      {goal.plan_status === "draft" && (
        <div className="text-xs text-muted-foreground">
          Plan not yet generated
        </div>
      )}
    </div>
  );
}
