import { differenceInDays } from "date-fns";
import { Target, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Race } from "@/types/race";
import { FocusPeriod } from "@/types/focus";

interface HeroSectionProps {
  races: Race[];
  focusPeriods: FocusPeriod[];
}

export function HeroSection({ races, focusPeriods }: HeroSectionProps) {
  const today = new Date();
  
  // Find next A-race
  const nextARace = races
    .filter((r) => r.priority === "A" && r.date > today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const daysUntil = nextARace ? differenceInDays(nextARace.date, today) : null;

  // Find current focus period
  const currentFocus = focusPeriods.find(
    (fp) => today >= fp.startDate && today <= fp.endDate
  );

  return (
    <div className="rounded-xl bg-gradient-to-br from-primary/10 via-background to-background border border-border p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          {nextARace && daysUntil !== null ? (
            <>
              <div className="text-4xl md:text-5xl font-bold text-foreground">
                {daysUntil} <span className="text-2xl md:text-3xl font-normal text-muted-foreground">days</span>
              </div>
              <div className="text-lg text-muted-foreground">
                until <span className="text-foreground font-medium">{nextARace.name}</span>
              </div>
            </>
          ) : (
            <div className="text-lg text-muted-foreground">No upcoming A-race scheduled</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-sm py-1.5 px-3">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Base Phase
          </Badge>
          {currentFocus && (
            <Badge variant="outline" className="text-sm py-1.5 px-3">
              <Target className="h-3.5 w-3.5 mr-1.5" />
              {currentFocus.primaryDiscipline} Focus
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
