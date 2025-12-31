import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, Activity, Clock, TrendingUp, Route } from "lucide-react";
import { PlannedWorkout } from "@/types/plannedWorkout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WorkoutCardProps {
  workout: PlannedWorkout;
  onEdit: (workout: PlannedWorkout) => void;
  onDelete: (id: string) => void;
  onClick?: (workout: PlannedWorkout) => void;
  compact?: boolean;
  className?: string;
}

const workoutTypeColors: Record<string, string> = {
  run: "bg-blue-500",
  bike: "bg-green-500",
  swim: "bg-cyan-500",
  strength: "bg-purple-500",
};

const getWorkoutTypeColor = (type: string) => {
  return workoutTypeColors[type.toLowerCase()] || "bg-gray-500";
};

const getIntensityColor = (intensity: number) => {
  if (intensity <= 3) return "text-green-600";
  if (intensity <= 6) return "text-yellow-600";
  if (intensity <= 8) return "text-orange-600";
  return "text-red-600";
};

export function WorkoutCard({
  workout,
  onEdit,
  onDelete,
  onClick,
  compact = false,
  className,
}: WorkoutCardProps) {
  const handleCardClick = () => {
    if (onClick) {
      onClick(workout);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const intensityColor = getIntensityColor(workout.intensityLevel);

  return (
    <Card
      className={cn(
        "relative transition-all hover:shadow-md cursor-pointer",
        compact ? "p-2" : "p-3",
        className
      )}
      onClick={handleCardClick}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l", getWorkoutTypeColor(workout.workoutType))} />

      <CardContent className={cn("p-0 pl-3", compact && "space-y-1")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={cn("font-medium truncate", compact ? "text-sm" : "text-base")}>
              {workout.title}
            </h3>

            <div className={cn("flex items-center gap-3 mt-1", compact ? "text-xs" : "text-sm", "text-muted-foreground")}>
              <div className="flex items-center gap-1">
                <Activity className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                <span className="capitalize">{workout.workoutType}</span>
              </div>

              {workout.distance && (
                <div className="flex items-center gap-1">
                  <Route className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                  <span>{workout.distance} km</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Clock className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                <span>{workout.duration} min</span>
              </div>

              <div className={cn("flex items-center gap-1", intensityColor)}>
                <TrendingUp className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                <span className="font-medium">{workout.intensityLevel}/10</span>
              </div>
            </div>

            {workout.trainingPhase && !compact && (
              <Badge variant="secondary" className="mt-2 capitalize">
                {workout.trainingPhase} phase
              </Badge>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={handleMenuClick}>
              <Button
                variant="ghost"
                size="icon"
                className={cn("flex-shrink-0", compact ? "h-6 w-6" : "h-8 w-8")}
              >
                <MoreVertical className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(workout)}>
                Edit workout
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(workout.id)}
                className="text-destructive"
              >
                Delete workout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}