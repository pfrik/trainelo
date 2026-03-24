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
import { AppSidebar } from "@/components/navigation/AppSidebar";

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

  return (
    <div className="dark h-screen flex overflow-hidden bg-light-base dark:bg-dark-base text-slate-800 dark:text-slate-200 font-sans antialiased transition-colors duration-200">
      <AppSidebar />

      <main className="flex-1 overflow-y-auto bg-light-base dark:bg-dark-base relative">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <header className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">Calendar</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your training schedule and completed activities</p>
          </header>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
              <p className="text-slate-400">Loading calendar...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Header bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-light-surface dark:bg-dark-surface p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
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
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{title}</span>
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
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg cursor-pointer text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-blue-400" /> Swim
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg cursor-pointer text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-green-500" /> Bike
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg cursor-pointer text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-orange-400" /> Run
                  </div>
                </div>

                {/* View toggle */}
                <div className="flex bg-slate-800/50 p-1 rounded-lg">
                  <button
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      view === "week"
                        ? "bg-dark-surface-lighter text-white shadow-sm font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                    onClick={() => setView("week")}
                  >
                    Week
                  </button>
                  <button
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      view === "month"
                        ? "bg-dark-surface-lighter text-white shadow-sm font-bold"
                        : "text-slate-400 hover:text-white"
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
          )}
        </div>
      </main>
    </div>
  );
}
