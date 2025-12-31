import { useMemo } from "react";
import { startOfWeek, endOfWeek, differenceInWeeks } from "date-fns";
import { Target, CalendarDays, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlannedWorkout } from "@/types/plannedWorkout";
import { Race } from "@/types/race";
import { getSportConfig, SportType } from "@/lib/sportConfig";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { formatDateRange } from "@/lib/dateUtils";

interface WeeklySummaryPanelProps {
  currentDate: Date;
  workouts: PlannedWorkout[];
  races: Race[];
}

const SPORT_ORDER: SportType[] = ["Bike", "Run", "Swim", "Strength", "Other"];

function formatDurationHHMM(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

function formatDurationLong(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = 0; // We don't have seconds, but keeping format consistent
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function WeeklySummaryPanel({
  currentDate,
  workouts,
  races,
}: WeeklySummaryPanelProps) {
  const [collapsed, setCollapsed] = useLocalStorage("summary-collapsed", false);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Filter workouts for current week
  const weekWorkouts = useMemo(() => {
    return workouts.filter((w) => w.date >= weekStart && w.date <= weekEnd);
  }, [workouts, weekStart, weekEnd]);

  // Calculate totals
  const totalMinutes = useMemo(() => {
    return weekWorkouts.reduce((sum, w) => sum + w.duration, 0);
  }, [weekWorkouts]);

  // Group by workout type
  const sportBreakdown = useMemo(() => {
    const breakdown: Record<string, { minutes: number; count: number }> = {};

    weekWorkouts.forEach((workout) => {
      const type = workout.workoutType || "Other";
      if (!breakdown[type]) {
        breakdown[type] = { minutes: 0, count: 0 };
      }
      breakdown[type].minutes += workout.duration;
      breakdown[type].count += 1;
    });

    // Return all workout types found
    return Object.entries(breakdown)
      .map(([type, data]) => ({
        sport: type,
        ...data,
      }))
      .sort((a, b) => b.minutes - a.minutes); // Sort by total minutes descending
  }, [weekWorkouts]);

  // Find next A-race
  const nextARace = useMemo(() => {
    const today = new Date();
    const aRaces = races
      .filter((r) => r.priority === "A" && r.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return aRaces[0] || null;
  }, [races]);

  const weeksToARace = nextARace
    ? differenceInWeeks(nextARace.date, new Date())
    : null;

  // If collapsed, show a minimal side tab
  if (collapsed) {
    return (
      <div 
        className="flex items-center justify-center bg-card border border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-all duration-300 p-2"
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span className="font-medium">Summary</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <Card className="h-fit transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Summary
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDateRange(weekStart, weekEnd)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(true)}
            className="h-6 px-2 text-xs text-muted-foreground"
          >
            Hide
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Duration */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Total Duration
            </span>
            <span className="text-lg font-semibold text-foreground">
              {formatDurationHHMM(totalMinutes)}
            </span>
          </div>
        </div>

        {/* TSS Placeholder */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Target className="h-3 w-3" />
            Training Stress
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            142 TSS
          </span>
        </div>

        {/* Sport Breakdown */}
        {sportBreakdown.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              By Type
            </span>
            <div className="space-y-2">
              {sportBreakdown.map(({ sport, minutes, count }) => {
                return (
                  <div
                    key={sport}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{sport}</span>
                      <span className="text-xs text-muted-foreground">
                        ({count})
                      </span>
                    </div>
                    <span className="font-mono text-xs">
                      {formatDurationLong(minutes)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {weekWorkouts.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No workouts scheduled
          </div>
        )}

        {/* Event Countdown */}
        {nextARace && weeksToARace !== null && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {nextARace.name}
              </span>
              <span className="text-xs font-medium text-primary">
                {weeksToARace} weeks
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
