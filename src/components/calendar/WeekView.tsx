import { startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { Plus, Thermometer, AlertCircle, Plane } from "lucide-react";
import { PlannedWorkout } from "@/types/plannedWorkout";
import { DayStatus } from "@/types/dayStatus";
import { WorkoutCard } from "./WorkoutCard";
import { DraggableWorkout } from "./DraggableWorkout";
import { DroppableDay } from "./DroppableDay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toDateString, formatInTimezone } from "@/lib/dateUtils";

interface WeekViewProps {
  currentDate: Date;
  workouts: PlannedWorkout[];
  dayStatuses: DayStatus[];
  onEditWorkout: (workout: PlannedWorkout) => void;
  onDeleteWorkout: (id: string) => void;
  onWorkoutClick: (workout: PlannedWorkout) => void;
  onAddWorkout: (date: Date) => void;
  onDayStatusClick: (date: Date) => void;
}

const statusColors: Record<string, string> = {
  sick: "bg-red-500/20 border-red-500/50",
  injured: "bg-orange-500/20 border-orange-500/50",
  traveling: "bg-muted/50 border-muted-foreground/30",
};

const statusIcons: Record<string, typeof Thermometer> = {
  sick: Thermometer,
  injured: AlertCircle,
  traveling: Plane,
};

export function WeekView({
  currentDate,
  workouts,
  dayStatuses,
  onEditWorkout,
  onDeleteWorkout,
  onWorkoutClick,
  onAddWorkout,
  onDayStatusClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getWorkoutsForDay = (day: Date) =>
    workouts.filter((workout) => isSameDay(workout.date, day));

  const getStatusForDay = (day: Date) => {
    const dateStr = toDateString(day);
    return dayStatuses.find((s) => s.date === dateStr);
  };

  return (
    <div className="grid grid-cols-7 gap-1 md:gap-2">
      {weekDays.map((day) => {
        const dayWorkouts = getWorkoutsForDay(day);
        const dayStatus = getStatusForDay(day);
        const StatusIcon = dayStatus?.status ? statusIcons[dayStatus.status] : null;
        const dateStr = toDateString(day);
        
        // Status color takes priority, otherwise use neutral background
        const bgClass = dayStatus?.status && dayStatus.status !== "normal"
          ? statusColors[dayStatus.status]
          : "bg-card";

        return (
          <DroppableDay
            key={day.toISOString()}
            dateStr={dateStr}
            className={cn(
              "min-h-[140px] md:min-h-[180px] rounded-lg border border-border p-1.5 md:p-2 flex flex-col",
              bgClass,
              isToday(day) && "ring-2 ring-primary"
            )}
          >
            {/* Clickable area for adding workouts */}
            <div
              className="flex-1 flex flex-col cursor-pointer"
              onClick={() => onAddWorkout(day)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div
                  className="text-center cursor-pointer hover:opacity-70"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDayStatusClick(day);
                  }}
                  title="Set day status"
                >
                  <div className="text-[10px] md:text-xs text-muted-foreground uppercase flex items-center gap-1">
                    {formatInTimezone(day, "EEE")}
                    {StatusIcon && <StatusIcon className="h-2.5 w-2.5" />}
                  </div>
                  <div
                    className={cn(
                      "text-sm md:text-lg font-semibold",
                      isToday(day) && "text-primary"
                    )}
                  >
                    {formatInTimezone(day, "d")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddWorkout(day);
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Workouts */}
              <div className="flex-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                {dayWorkouts.map((workout) => (
                  <DraggableWorkout key={workout.id} workout={workout}>
                    <WorkoutCard
                      workout={workout}
                      onEdit={onEditWorkout}
                      onDelete={onDeleteWorkout}
                      onClick={onWorkoutClick}
                      compact
                    />
                  </DraggableWorkout>
                ))}
              </div>
            </div>
          </DroppableDay>
        );
      })}
    </div>
  );
}
