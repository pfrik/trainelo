import { useState } from "react";
import {
  useCalendarSchedule,
  type CalendarDay,
  type CalendarWorkout,
} from "@/hooks/useCalendarSchedule";
import { ActivityDetailDrawer } from "@/components/calendar/ActivityDetailDrawer";
import { normalizeSport, sportToDisplayKey } from "@/lib/core/compliance/normalizeSport";

type CalendarView = "week" | "month";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Sport detection & styling (matching HTML prototype colors) ──

function detectSport(type: string): string {
  const t = type.toLowerCase();
  if (t === "rest" || t === "recovery" || t.includes("rest")) return "rest";
  return sportToDisplayKey(normalizeSport(type));
}

const SPORT_STYLES: Record<string, { icon: string; textColor: string; borderColor: string }> = {
  run:      { icon: "directions_run",  textColor: "text-orange-400",  borderColor: "border-l-orange-400" },
  bike:     { icon: "directions_bike", textColor: "text-primary",     borderColor: "border-l-primary" },
  swim:     { icon: "pool",            textColor: "text-blue-400",    borderColor: "border-l-blue-400" },
  strength: { icon: "fitness_center",  textColor: "text-purple-400",  borderColor: "border-l-purple-400" },
  rest:     { icon: "spa",             textColor: "text-slate-400",   borderColor: "" },
  other:    { icon: "fitness_center",  textColor: "text-slate-400",   borderColor: "border-l-slate-600" },
};

function getSportStyle(type: string) {
  return SPORT_STYLES[detectSport(type)] || SPORT_STYLES.other;
}

// ── Main widget ──

export function CalendarWidget() {
  const [view, setView] = useState<CalendarView>("week");
  const [refDate, setRefDate] = useState(new Date());
  const { days, loading } = useCalendarSchedule(view, refDate);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleWorkoutClick = (workoutId: string | undefined) => {
    if (!workoutId) return;
    setSelectedWorkoutId(workoutId);
    setDrawerOpen(true);
  };

  const handlePrev = () => {
    const d = new Date(refDate);
    if (view === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setRefDate(d);
  };

  const handleNext = () => {
    const d = new Date(refDate);
    if (view === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setRefDate(d);
  };

  let title: string;
  if (view === "week" && days.length > 0) {
    const first = new Date(days[0].dateStr + "T12:00:00");
    title = MONTHS[first.getMonth()] + " " + first.getFullYear();
  } else {
    title = MONTHS[refDate.getMonth()] + " " + refDate.getFullYear();
  }

  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-dark-surface-lighter rounded text-slate-500 dark:text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </span>
          <button
            onClick={handleNext}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-dark-surface-lighter rounded text-slate-500 dark:text-slate-400 transition-colors"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        {/* Sport dots */}
        <div className="flex gap-2 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-dark-surface-lighter rounded">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Swim
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-dark-surface-lighter rounded">
            <span className="w-2 h-2 rounded-full bg-primary" /> Bike
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-dark-surface-lighter rounded">
            <span className="w-2 h-2 rounded-full bg-orange-400" /> Run
          </div>
        </div>

        {/* View toggle */}
        <div className="bg-slate-100 dark:bg-dark-surface-lighter p-1 rounded-lg flex">
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              view === "week"
                ? "bg-white dark:bg-dark-surface shadow-sm font-bold text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              view === "month"
                ? "bg-white dark:bg-dark-surface shadow-sm font-bold text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            onClick={() => setView("month")}
          >
            Month
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : view === "week" ? (
        <WeekGrid days={days} onWorkoutClick={handleWorkoutClick} />
      ) : (
        <MonthGrid days={days} refDate={refDate} onWorkoutClick={handleWorkoutClick} />
      )}

      <ActivityDetailDrawer
        workoutId={selectedWorkoutId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}

// ── Status icon ──

function StatusIcon({ status }: { status: CalendarDay["status"] }) {
  if (status === "completed") {
    return (
      <span
        className="material-symbols-outlined text-primary text-sm"
        style={{ fontVariationSettings: '"FILL" 1' }}
      >
        check_circle
      </span>
    );
  }
  if (status === "missed") {
    return (
      <span
        className="material-symbols-outlined text-red-400 text-sm"
        style={{ fontVariationSettings: '"FILL" 1' }}
      >
        cancel
      </span>
    );
  }
  return (
    <span className="material-symbols-outlined text-slate-600 dark:text-slate-500 text-sm">
      circle
    </span>
  );
}

// ── Week grid ──

function WeekGrid({ days, onWorkoutClick }: { days: CalendarDay[]; onWorkoutClick: (id: string | undefined) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
      {days.map((day) => {
        const isToday = day.status === "today";
        const isRest =
          day.status === "rest" ||
          (day.workouts.length === 1 && detectSport(day.workouts[0].type) === "rest");
        const hasWorkouts = day.workouts.length > 0;

        return (
          <div key={day.dateStr} className="flex flex-col gap-3">
            {/* Day header */}
            <div className="text-center pb-2 border-b border-gray-200 dark:border-white/10">
              <p
                className={`text-xs font-medium uppercase ${
                  isToday
                    ? "text-primary font-bold"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {day.day}
              </p>
              {isToday ? (
                <p className="text-lg font-bold">
                  <span className="inline-flex items-center justify-center size-8 rounded-full bg-primary text-black">
                    {day.dateNum}
                  </span>
                </p>
              ) : (
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {day.dateNum}
                </p>
              )}
            </div>

            {/* Cards */}
            {!hasWorkouts && !isRest ? (
              <div className="group relative p-3 rounded-lg bg-gray-100 dark:bg-white/5 border border-transparent cursor-pointer">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No data
                </p>
              </div>
            ) : isRest ? (
              <div className="group relative p-3 rounded-lg bg-gray-100 dark:bg-white/5 border border-transparent hover:border-gray-300 dark:hover:border-white/20 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="material-symbols-outlined text-slate-400">
                    spa
                  </span>
                  <StatusIcon status={day.status} />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Rest Day
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Active recovery or total rest.
                </p>
              </div>
            ) : (
              /* Render each workout as a separate card */
              day.workouts.map((w, i) => (
                <WorkoutCard key={i} workout={w} status={day.status} onClick={() => onWorkoutClick(w.id)} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Single workout card ──

function WorkoutCard({
  workout,
  status,
  onClick,
}: {
  workout: CalendarWorkout;
  status: CalendarDay["status"];
  onClick?: () => void;
}) {
  const sport = getSportStyle(workout.type);
  const clickable = !!workout.id;

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`group relative p-3 rounded-lg bg-white dark:bg-dark-surface-lighter border-l-4 ${sport.borderColor} shadow-sm hover:shadow-md transition-all ${clickable ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`material-symbols-outlined ${sport.textColor}`}>
          {sport.icon}
        </span>
        <StatusIcon status={status} />
      </div>
      <p className="text-sm font-bold text-slate-900 dark:text-white">
        {workout.type}
      </p>
      {workout.detail && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {workout.detail}
        </p>
      )}
    </div>
  );
}

// ── Month grid ──

function MonthGrid({ days, refDate, onWorkoutClick }: { days: CalendarDay[]; refDate: Date; onWorkoutClick: (id: string | undefined) => void }) {
  const currentMonth = refDate.getMonth();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="grid grid-cols-7 gap-1">
      {dayNames.map((d) => (
        <div key={d} className="text-center py-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            {d}
          </span>
        </div>
      ))}

      {days.map((day) => {
        const d = new Date(day.dateStr + "T12:00:00");
        const inMonth = d.getMonth() === currentMonth;
        const isToday = day.status === "today";
        const isCompleted = day.status === "completed";
        const shown = inMonth ? day.workouts.slice(0, 2) : [];
        const overflow = day.workouts.length - 2;

        return (
          <div
            key={day.dateStr}
            className={`border border-slate-200 dark:border-white/5 rounded-lg bg-white dark:bg-dark-surface-lighter hover:bg-slate-50 dark:hover:bg-dark-surface p-2 min-h-[80px] flex flex-col gap-1 transition-colors ${
              !inMonth ? "opacity-30" : ""
            }`}
          >
            <div className="text-right">
              {isToday ? (
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-black text-sm font-bold">
                  {day.dateNum}
                </span>
              ) : (
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {day.dateNum}
                </span>
              )}
            </div>

            {shown.map((w, i) => {
              const sport = getSportStyle(w.type);
              const clickable = !!w.id;
              return (
                <div
                  key={i}
                  onClick={clickable ? () => onWorkoutClick(w.id) : undefined}
                  className={`flex items-center gap-1.5 border-l-4 ${sport.borderColor} pl-1.5 rounded-r min-w-0 ${clickable ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5" : ""}`}
                >
                  <span
                    className={`material-symbols-outlined ${sport.textColor} text-sm shrink-0 ${
                      !isCompleted && !isToday ? "opacity-50" : ""
                    }`}
                  >
                    {sport.icon}
                  </span>
                  <span className="text-xs text-slate-900 dark:text-white truncate font-medium">
                    {w.type}
                  </span>
                </div>
              );
            })}

            {inMonth && overflow > 0 && (
              <p className="text-xs text-slate-400 pl-1">+{overflow} more</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
