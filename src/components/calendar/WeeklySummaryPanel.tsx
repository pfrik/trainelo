import { useMemo } from "react";
import { startOfWeek, endOfWeek, differenceInWeeks } from "date-fns";
import { Target, CalendarDays, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalBlock } from "@/types/block";
import { Race } from "@/types/race";
import { getSportConfig, SportType } from "@/lib/sportConfig";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { formatDateRange } from "@/lib/dateUtils";

interface WeeklySummaryPanelProps {
  currentDate: Date;
  blocks: ExternalBlock[];
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
  blocks,
  races,
}: WeeklySummaryPanelProps) {
  const [collapsed, setCollapsed] = useLocalStorage("summary-collapsed", false);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Filter blocks for current week
  const weekBlocks = useMemo(() => {
    return blocks.filter((b) => b.date >= weekStart && b.date <= weekEnd);
  }, [blocks, weekStart, weekEnd]);

  // Calculate totals
  const totalMinutes = useMemo(() => {
    return weekBlocks.reduce((sum, b) => sum + b.duration, 0);
  }, [weekBlocks]);

  // Group by sport
  const sportBreakdown = useMemo(() => {
    const breakdown: Record<string, { minutes: number; count: number }> = {};
    
    weekBlocks.forEach((block) => {
      const sport = block.discipline || "Other";
      if (!breakdown[sport]) {
        breakdown[sport] = { minutes: 0, count: 0 };
      }
      breakdown[sport].minutes += block.duration;
      breakdown[sport].count += 1;
    });

    // Sort by SPORT_ORDER
    return SPORT_ORDER
      .filter((sport) => breakdown[sport])
      .map((sport) => ({
        sport,
        ...breakdown[sport],
      }));
  }, [weekBlocks]);

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
              By Sport
            </span>
            <div className="space-y-2">
              {sportBreakdown.map(({ sport, minutes, count }) => {
                const config = getSportConfig(sport);
                const Icon = config.icon;
                return (
                  <div
                    key={sport}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className={cn("flex items-center gap-2", config.textClass)}>
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{sport}</span>
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

        {weekBlocks.length === 0 && (
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
