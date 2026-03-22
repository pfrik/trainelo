import {
  startOfWeek,
  addDays,
  format,
  isSameDay,
  isBefore,
  startOfDay,
} from "date-fns";
import {
  Timer,
  Bike,
  Waves,
  Dumbbell,
  Coffee,
  CheckCircle2,
  Circle,
} from "lucide-react";
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

interface WeekViewProps {
  currentDate: Date;
  workouts: PlannedWorkout[];
}

export function WeekView({ currentDate, workouts }: WeekViewProps) {
  const monday = startOfWeek(currentDate, { weekStartsOn: 1 });
  const today = startOfDay(new Date());

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
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i);
        const dateKey = format(day, "yyyy-MM-dd");
        const dayWorkouts = workoutsByDate[dateKey] || [];
        const todayMatch = isSameDay(day, today);

        return (
          <div
            key={dateKey}
            className={cn(
              "flex flex-col gap-3",
              i === 0 && "min-h-[300px] md:min-h-0"
            )}
          >
            {/* Day header */}
            <div className="text-center pb-2 border-b">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                {DAYS[i]}
              </p>
              {todayMatch ? (
                <p className="text-lg font-bold">
                  <span className="inline-flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground">
                    {format(day, "d")}
                  </span>
                </p>
              ) : (
                <p className="text-lg font-bold">{format(day, "d")}</p>
              )}
            </div>

            {/* Cards */}
            {dayWorkouts.length === 0 ? (
              <RestCard />
            ) : (
              dayWorkouts.map((w) => (
                <WorkoutCard key={w.id} workout={w} today={today} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function RestCard() {
  return (
    <div className="group relative p-3 rounded-lg bg-muted/50 border border-transparent hover:border-border transition-all cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <Coffee className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-bold text-muted-foreground">Rest Day</p>
      <p className="text-xs text-muted-foreground mt-1">
        Active recovery or total rest.
      </p>
    </div>
  );
}

function WorkoutCard({
  workout,
  today,
}: {
  workout: PlannedWorkout;
  today: Date;
}) {
  const sport = getSport(workout.workoutType);
  const Icon = sport.icon;
  const completed =
    isBefore(workout.date, today) || isSameDay(workout.date, today);

  return (
    <div
      className={cn(
        "group relative p-3 rounded-lg bg-card border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer",
        sport.borderColor
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={cn("h-5 w-5", sport.textColor)} />
        {completed ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <p className="text-sm font-bold">{workout.title}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {workout.duration}min
        {workout.distance ? ` \u2022 ${workout.distance}km` : ""}
      </p>
    </div>
  );
}
