import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  format,
  startOfWeek,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { usePlannedWorkouts } from "@/hooks/usePlannedWorkouts";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";

type CalendarView = "week" | "month";

export default function Calendar() {
  const { workouts, loading } = usePlannedWorkouts();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("week");

  const handlePrev = () => {
    setCurrentDate(
      view === "week"
        ? subWeeks(currentDate, 1)
        : subMonths(currentDate, 1)
    );
  };

  const handleNext = () => {
    setCurrentDate(
      view === "week"
        ? addWeeks(currentDate, 1)
        : addMonths(currentDate, 1)
    );
  };

  const title =
    view === "week"
      ? format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMMM yyyy")
      : format(currentDate, "MMMM yyyy");

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse h-96 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold">{title}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Sport filter dots */}
        <div className="flex gap-2 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded cursor-pointer">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Swim
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded cursor-pointer">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Bike
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded cursor-pointer">
            <span className="w-2 h-2 rounded-full bg-orange-400" /> Run
          </div>
        </div>

        {/* View toggle */}
        <div className="flex bg-muted p-1 rounded-md">
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              view === "week"
                ? "bg-background shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              view === "month"
                ? "bg-background shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setView("month")}
          >
            Month
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {view === "week" ? (
        <WeekView currentDate={currentDate} workouts={workouts} />
      ) : (
        <MonthView currentDate={currentDate} workouts={workouts} />
      )}
    </div>
  );
}
