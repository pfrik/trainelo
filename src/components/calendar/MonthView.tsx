import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  startOfDay,
} from "date-fns";
import { Lock, Check, Thermometer, AlertCircle, Plane } from "lucide-react";
import { PlannedWorkout } from "@/types/plannedWorkout";
import { DayStatus } from "@/types/dayStatus";
import { DraggableWorkout } from "./DraggableWorkout";
import { DroppableDay } from "./DroppableDay";
import { cn } from "@/lib/utils";
import { getSportConfig, formatDuration } from "@/lib/sportConfig";
import { toDateString, formatInTimezone } from "@/lib/dateUtils";

interface MonthViewProps {
  currentDate: Date;
  workouts: PlannedWorkout[];
  dayStatuses: DayStatus[];
  onEditWorkout: (workout: PlannedWorkout) => void;
  onWorkoutClick: (workout: PlannedWorkout) => void;
  onDayClick: (date: Date) => void;
  onAddWorkout: (date: Date) => void;
}

// TODO: Add workout status tracking when workout completion is implemented

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

export function MonthView({
  currentDate,
  workouts,
  dayStatuses,
  onEditWorkout,
  onWorkoutClick,
  onDayClick,
  onAddWorkout,
}: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getWorkoutsForDay = (d: Date) =>
    workouts.filter((workout) => isSameDay(workout.date, d));

  const getStatusForDay = (d: Date) => {
    const dateStr = toDateString(d);
    return dayStatuses.find((s) => s.date === dateStr);
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((wd) => (
          <div
            key={wd}
            className="text-center text-xs text-muted-foreground py-1"
          >
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dayWorkouts = getWorkoutsForDay(d);
          const dayStatus = getStatusForDay(d);
          const StatusIcon = dayStatus?.status ? statusIcons[dayStatus.status] : null;
          const dateStr = toDateString(d);
          
          const bgClass = dayStatus?.status && dayStatus.status !== "normal"
            ? statusColors[dayStatus.status]
            : "bg-card";
          const inMonth = isSameMonth(d, currentDate);

          return (
            <DroppableDay
              key={d.toISOString()}
              dateStr={dateStr}
              className={cn(
                "min-h-[80px] md:min-h-[100px] rounded border border-border p-1 cursor-pointer hover:bg-accent/50 transition-colors",
                bgClass,
                !inMonth && "opacity-40",
                isToday(d) && "ring-2 ring-primary"
              )}
            >
              <div
                className="h-full flex flex-col"
                onClick={() => onAddWorkout(d)}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onDayClick(d);
                  }}
                  className={cn(
                    "text-xs md:text-sm font-medium mb-1 flex items-center gap-1 cursor-pointer hover:text-primary",
                    isToday(d) && "text-primary"
                  )}
                >
                  {StatusIcon && <StatusIcon className="h-3 w-3" />}
                  <span>{formatInTimezone(d, "d")}</span>
                </div>

                <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                  {dayWorkouts.slice(0, 3).map((workout) => {
                    return (
                      <DraggableWorkout key={workout.id} workout={workout}>
                        <div
                          className={cn(
                            "text-[8px] md:text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5 cursor-pointer transition-all duration-200",
                            "bg-primary/10 text-primary border border-primary/20"
                          )}
                          title={`${workout.title} - Click to view details`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onWorkoutClick(workout);
                          }}
                        >
                          <span className="font-semibold capitalize">{workout.workoutType}</span>
                          <span className="text-muted-foreground">•</span>
                          <span>{workout.duration}m</span>
                          {workout.distance && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span>{workout.distance}km</span>
                            </>
                          )}
                        </div>
                      </DraggableWorkout>
                    );
                  })}
                  {dayWorkouts.length > 3 && (
                    <span className="text-[8px] text-muted-foreground">
                      +{dayWorkouts.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </DroppableDay>
          );
        })}
      </div>
    </div>
  );
}
