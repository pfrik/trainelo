import { Calendar, MapPin, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "./PriorityBadge";
import { cn } from "@/lib/utils";
import type { Race } from "@/types/race";
import { formatDisplayDate } from "@/lib/dateUtils";

interface RaceCardProps {
  race: Race;
  onEdit: (race: Race) => void;
  onDelete: (id: string) => void;
}

const sportIcons: Record<string, string> = {
  Run: "🏃",
  Bike: "🚴",
  Swim: "🏊",
  Triathlon: "🏆",
  Other: "🎯",
};

export function RaceCard({ race, onEdit, onDelete }: RaceCardProps) {
  const isArace = race.priority === "A";

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        isArace && "border-primary border-2 shadow-lg"
      )}
    >
      <CardHeader className={cn("pb-2", isArace && "pb-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{sportIcons[race.sport]}</span>
            <div>
              <h3 className={cn("font-semibold text-foreground", isArace ? "text-lg" : "text-base")}>
                {race.name}
              </h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDisplayDate(race.date)}
              </div>
            </div>
          </div>
          <PriorityBadge priority={race.priority} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>
              {race.distance} {race.distanceUnit}
            </span>
          </div>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{race.sport}</span>
        </div>

        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-xs text-muted-foreground mb-1">Goal: {race.goalType}</p>
          <p className={cn("font-medium", isArace ? "text-primary" : "text-foreground")}>
            {race.goalValue}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(race)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(race.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
