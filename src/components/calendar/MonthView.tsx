import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from "date-fns";
import { Timer, Bike, Waves, Dumbbell } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PlannedWorkout } from "@/types/plannedWorkout";
import { cn } from "@/lib/utils";

const SPORT: Record<
  string,
  { icon: LucideIcon; textColor: string; borderColor: string }
> = {
  run: {
    icon: Timer,
    textColor: "text-orange-400",
    borderColor: "border-l-orange-400",
  },
  bike: {
    icon: Bike,
    textColor: "text-green-500",
    borderColor: "border-l-green-500",
  },
  swim: {
    icon: Waves,
    textColor: "text-blue-400",
    borderColor: "border-l-blue-400",
  },
  strength: {
    icon: Dumbbell,
    textColor: "text-purple-400",
    borderColor: "border-l-purple-400",
  },
};

const DEFAULT_SPORT = {
  icon: Timer as LucideIcon,
  textColor: "text-muted-foreground",
  borderColor: "border-l-muted",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getSport(type: string) {
  return SPORT[type.toLowerCase()] || DEFAULT_SPORT;
}

interface MonthViewProps {
  currentDate: Date;
  workouts: PlannedWorkout[];
}

export function MonthView({ currentDate, workouts }: MonthViewProps) {
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const workoutsByDate = workouts.reduce(
    (acc, w) => {
      const key = format(w.date, "yyyy-MM-dd");
      if (!acc[key]) acc[key] = [];
      acc[key].push(w);
      return acc;
    },
    {} as Record<string, PlannedWorkout[]>
  );

  return (
    <div className="grid grid-cols-7 gap-1">
      {/* Day headers */}
      {DAYS.map((day) => (
        <div key={day} className="text-center py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            {day}
          </p>
        </div>
      ))}

      {/* Day cells */}
      {days.map((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const inMonth = isSameMonth(day, currentDate);
        const todayMatch = isSameDay(day, today);
        const dayWorkouts = inMonth ? workoutsByDate[dateKey] || [] : [];
        const shown = dayWorkouts.slice(0, 2);
        const overflow = dayWorkouts.length - 2;

        return (
          <div
            key={dateKey}
            className={cn(
              "border rounded-lg bg-card hover:bg-muted/50 p-2 min-h-[90px] flex flex-col gap-1 transition-colors",
              !inMonth && "opacity-30"
            )}
          >
            {/* Date number */}
            <div className="text-right">
              {todayMatch ? (
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {format(day, "d")}
                </span>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  {format(day, "d")}
                </span>
              )}
            </div>

            {/* Compact entries */}
            {shown.map((w) => {
              const sport = getSport(w.workoutType);
              const Icon = sport.icon;
              const planned =
                isBefore(today, w.date) && !isSameDay(today, w.date);

              return (
                <div
                  key={w.id}
                  className={cn(
                    "flex items-center gap-1.5 border-l-4 pl-1.5 rounded-r min-w-0",
                    sport.borderColor
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      sport.textColor,
                      planned && "opacity-50"
                    )}
                  />
                  <span className="text-xs truncate font-medium">
                    {w.title}
                  </span>
                </div>
              );
            })}

            {overflow > 0 && (
              <p className="text-xs text-muted-foreground pl-1">
                +{overflow} more
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
