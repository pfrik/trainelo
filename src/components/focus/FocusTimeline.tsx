import { format, differenceInDays, eachMonthOfInterval, startOfMonth, isSameMonth } from "date-fns";
import { Pencil, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FocusPeriod } from "@/types/focus";
import type { Race } from "@/types/race";

interface FocusTimelineProps {
  periods: FocusPeriod[];
  races: Race[];
  onEdit: (period: FocusPeriod) => void;
  onDelete: (id: string) => void;
}

const disciplineColors: Record<string, string> = {
  Run: "bg-primary",
  Bike: "bg-chart-2",
  Swim: "bg-chart-3",
  Balanced: "bg-chart-4",
};

export function FocusTimeline({ periods, races, onEdit, onDelete }: FocusTimelineProps) {
  if (periods.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No focus periods yet. Add your first period to get started!</p>
      </div>
    );
  }

  // Calculate timeline range
  const allDates = periods.flatMap((p) => [new Date(p.startDate), new Date(p.endDate)]);
  races.forEach((r) => allDates.push(new Date(r.date)));
  
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  
  const timelineStart = startOfMonth(minDate);
  const timelineEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
  
  const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd });

  const getPosition = (date: Date) => {
    const days = differenceInDays(new Date(date), timelineStart);
    return (days / totalDays) * 100;
  };

  const getWidth = (start: Date, end: Date) => {
    const days = differenceInDays(new Date(end), new Date(start)) + 1;
    return (days / totalDays) * 100;
  };

  // Sort periods by start date
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Timeline visualization */}
      <div className="relative">
        {/* Month labels */}
        <div className="flex border-b border-border mb-2 pb-1">
          {months.map((month, i) => {
            const monthStart = startOfMonth(month);
            const monthDays = differenceInDays(
              i < months.length - 1 ? months[i + 1] : timelineEnd,
              monthStart
            );
            const width = (monthDays / totalDays) * 100;

            return (
              <div
                key={month.toISOString()}
                className="text-xs text-muted-foreground truncate"
                style={{ width: `${width}%` }}
              >
                {format(month, "MMM yy")}
              </div>
            );
          })}
        </div>

        {/* Focus period bars */}
        <div className="relative h-16 bg-muted/30 rounded-lg mb-4">
          {sortedPeriods.map((period) => (
            <div
              key={period.id}
              className={cn(
                "absolute h-10 top-3 rounded-md flex items-center px-2 overflow-hidden cursor-pointer transition-opacity hover:opacity-90",
                disciplineColors[period.primaryDiscipline]
              )}
              style={{
                left: `${getPosition(period.startDate)}%`,
                width: `${getWidth(period.startDate, period.endDate)}%`,
              }}
              title={`${period.name}: ${format(new Date(period.startDate), "MMM d")} - ${format(new Date(period.endDate), "MMM d, yyyy")}`}
            >
              <span className="text-xs font-medium text-primary-foreground truncate">
                {period.name}
              </span>
            </div>
          ))}

          {/* Race markers */}
          {races.map((race) => (
            <div
              key={race.id}
              className="absolute top-0 h-full flex flex-col items-center"
              style={{ left: `${getPosition(race.date)}%` }}
            >
              <div
                className={cn(
                  "w-0.5 h-full",
                  race.priority === "A" ? "bg-primary" : "bg-muted-foreground/50"
                )}
              />
              <div
                className={cn(
                  "absolute -top-1 p-1 rounded-full",
                  race.priority === "A" ? "bg-primary" : "bg-muted"
                )}
              >
                <Trophy className={cn(
                  "h-3 w-3",
                  race.priority === "A" ? "text-primary-foreground" : "text-muted-foreground"
                )} />
              </div>
            </div>
          ))}
        </div>

        {/* Race labels */}
        <div className="relative h-8 mb-4">
          {races.map((race) => (
            <div
              key={race.id}
              className="absolute text-xs whitespace-nowrap"
              style={{
                left: `${getPosition(race.date)}%`,
                transform: "translateX(-50%)",
              }}
            >
              <span className={cn(
                "font-medium",
                race.priority === "A" ? "text-primary" : "text-muted-foreground"
              )}>
                {race.name.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Period cards */}
      <div className="space-y-3">
        {sortedPeriods.map((period) => (
          <div
            key={period.id}
            className="p-4 rounded-lg border bg-card"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn("w-3 h-3 rounded-full", disciplineColors[period.primaryDiscipline])} />
                  <h3 className="font-medium text-foreground">{period.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(period.startDate), "MMM d, yyyy")} — {format(new Date(period.endDate), "MMM d, yyyy")}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => onEdit(period)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(period.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Distribution bar */}
            <div className="space-y-2">
              <div className="h-3 rounded-full overflow-hidden flex bg-muted">
                {period.distribution.run > 0 && (
                  <div className="bg-primary" style={{ width: `${period.distribution.run}%` }} />
                )}
                {period.distribution.bike > 0 && (
                  <div className="bg-chart-2" style={{ width: `${period.distribution.bike}%` }} />
                )}
                {period.distribution.swim > 0 && (
                  <div className="bg-chart-3" style={{ width: `${period.distribution.swim}%` }} />
                )}
                {period.distribution.strength > 0 && (
                  <div className="bg-chart-4" style={{ width: `${period.distribution.strength}%` }} />
                )}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Run {period.distribution.run}%</span>
                <span>Bike {period.distribution.bike}%</span>
                <span>Swim {period.distribution.swim}%</span>
                <span>Strength {period.distribution.strength}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
