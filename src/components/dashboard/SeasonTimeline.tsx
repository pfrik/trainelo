import { useRef } from "react";
import { format, differenceInDays, addMonths, startOfMonth } from "date-fns";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Race } from "@/types/race";
import { FocusPeriod } from "@/types/focus";
import { Phase, phaseColors, phaseLabels } from "@/types/phase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SeasonTimelineProps {
  races: Race[];
  focusPeriods: FocusPeriod[];
  phases: Phase[];
  onRaceClick?: (race: Race) => void;
}

const focusColors: Record<string, string> = {
  Run: "bg-green-500/20",
  Bike: "bg-blue-500/20",
  Swim: "bg-cyan-500/20",
  Balanced: "bg-purple-500/20",
};

export function SeasonTimeline({ races, focusPeriods, phases, onRaceClick }: SeasonTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  
  // Calculate timeline range (6 months back to 12 months forward)
  const timelineStart = startOfMonth(addMonths(today, -2));
  const timelineEnd = addMonths(today, 14);
  const totalDays = differenceInDays(timelineEnd, timelineStart);

  const getPosition = (date: Date) => {
    const days = differenceInDays(date, timelineStart);
    return Math.max(0, Math.min(100, (days / totalDays) * 100));
  };

  const getWidth = (start: Date, end: Date) => {
    const startPos = getPosition(start);
    const endPos = getPosition(end);
    return Math.max(0, endPos - startPos);
  };

  // Generate month labels
  const months: Date[] = [];
  let current = startOfMonth(timelineStart);
  while (current <= timelineEnd) {
    months.push(current);
    current = addMonths(current, 1);
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = direction === "left" ? -200 : 200;
      scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const todayPosition = getPosition(today);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-foreground">Season Timeline</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scroll("left")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scroll("right")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-thin scrollbar-thumb-border"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="relative min-w-[800px] h-32">
          {/* Month labels */}
          <div className="absolute top-0 left-0 right-0 h-6 flex">
            {months.map((month, i) => (
              <div
                key={i}
                className="text-[10px] text-muted-foreground border-l border-border pl-1"
                style={{ width: `${100 / months.length}%` }}
              >
                {format(month, "MMM yy")}
              </div>
            ))}
          </div>

          {/* Focus periods as background */}
          <div className="absolute top-6 left-0 right-0 h-8">
            {focusPeriods.map((fp) => (
              <div
                key={fp.id}
                className={cn("absolute h-full rounded-sm", focusColors[fp.primaryDiscipline] || "bg-muted")}
                style={{
                  left: `${getPosition(fp.startDate)}%`,
                  width: `${getWidth(fp.startDate, fp.endDate)}%`,
                }}
                title={fp.name}
              />
            ))}
          </div>

          {/* Training phases */}
          <div className="absolute top-14 left-0 right-0 h-4">
            {phases.map((phase) => (
              <div
                key={phase.id}
                className={cn(
                  "absolute h-full rounded-sm text-[9px] flex items-center px-1 text-foreground/70",
                  phaseColors[phase.type]
                )}
                style={{
                  left: `${getPosition(phase.startDate)}%`,
                  width: `${getWidth(phase.startDate, phase.endDate)}%`,
                }}
                title={`${phase.name}: ${format(phase.startDate, "MMM d")} - ${format(phase.endDate, "MMM d")}`}
              >
                {getWidth(phase.startDate, phase.endDate) > 5 && phaseLabels[phase.type]}
              </div>
            ))}
          </div>

          {/* Race markers */}
          <div className="absolute top-20 left-0 right-0 h-10">
            {races.map((race) => (
              <div
                key={race.id}
                className={cn(
                  "absolute flex flex-col items-center cursor-pointer hover:scale-110 transition-transform",
                  race.priority === "A" ? "-top-1" : "top-0"
                )}
                style={{ left: `${getPosition(race.date)}%`, transform: "translateX(-50%)" }}
                onClick={() => onRaceClick?.(race)}
                title={`${race.name} - ${format(race.date, "MMM d, yyyy")}`}
              >
                <div
                  className={cn(
                    "rounded-full p-1",
                    race.priority === "A"
                      ? "bg-primary text-primary-foreground"
                      : race.priority === "B"
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  <Trophy className={cn("h-3 w-3", race.priority === "A" && "h-4 w-4")} />
                </div>
                <span
                  className={cn(
                    "text-[8px] mt-0.5 whitespace-nowrap max-w-[60px] truncate",
                    race.priority === "A" ? "text-primary font-medium" : "text-muted-foreground"
                  )}
                >
                  {race.name}
                </span>
              </div>
            ))}
          </div>

          {/* Today marker */}
          <div
            className="absolute top-6 h-24 w-0.5 bg-primary z-10"
            style={{ left: `${todayPosition}%` }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-primary font-medium bg-background px-1 rounded">
              Today
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
