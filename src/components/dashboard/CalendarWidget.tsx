import { useState } from "react";
import { useCalendarSchedule } from "@/hooks/useCalendarSchedule";
import type { WeekDay } from "@/hooks/useWeekSchedule";

type CalendarView = "week" | "month";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Sport detection & styling ──

function detectSport(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("run") || t.includes("jog") || t.includes("walk")) return "run";
  if (t.includes("bike") || t.includes("cycling") || t.includes("ride")) return "bike";
  if (t.includes("swim") || t.includes("pool") || t.includes("water")) return "swim";
  if (
    t.includes("strength") || t.includes("gym") || t.includes("core") ||
    t.includes("weight") || t.includes("fitness")
  ) return "strength";
  if (t === "rest" || t === "recovery" || t.includes("rest")) return "rest";
  return "other";
}

const SPORT_STYLES: Record<string, { icon: string; textColor: string; borderColor: string }> = {
  run:      { icon: "directions_run",  textColor: "text-orange-400",  borderColor: "border-l-orange-400" },
  bike:     { icon: "directions_bike", textColor: "text-green-500",   borderColor: "border-l-green-500" },
  swim:     { icon: "pool",            textColor: "text-blue-400",    borderColor: "border-l-blue-400" },
  strength: { icon: "fitness_center",  textColor: "text-purple-400",  borderColor: "border-l-purple-400" },
  rest:     { icon: "spa",             textColor: "text-slate-400",   borderColor: "border-l-slate-600" },
  other:    { icon: "exercise",        textColor: "text-slate-400",   borderColor: "border-l-slate-600" },
};

function getSportStyle(type: string) {
  return SPORT_STYLES[detectSport(type)] || SPORT_STYLES.other;
}

function hasWorkoutData(day: WeekDay) {
  return day.type !== "--" && day.type !== "No data" && day.type !== "Today";
}

// ── Main widget ──

export function CalendarWidget() {
  const [view, setView] = useState<CalendarView>("week");
  const [refDate, setRefDate] = useState(new Date());
  const { days, loading } = useCalendarSchedule(view, refDate);

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
            <span className="w-2 h-2 rounded-full bg-green-500" /> Bike
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
        <WeekGrid days={days} />
      ) : (
        <MonthGrid days={days} refDate={refDate} />
      )}
    </div>
  );
}

// ── Week grid ──

function WeekGrid({ days }: { days: WeekDay[] }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const sport = getSportStyle(day.type);
        const isToday = day.status === "today";
        const isRest = day.status === "rest" || detectSport(day.type) === "rest";
        const isCompleted = day.status === "completed";
        const isMissed = day.status === "missed";
        const hasData = hasWorkoutData(day);

        return (
          <div key={day.dateStr} className="flex flex-col gap-2 group cursor-pointer">
            {/* Day label */}
            <div
              className={`text-xs font-medium text-center uppercase ${
                isToday ? "text-primary font-bold" : "text-slate-500"
              }`}
            >
              {day.day}
            </div>

            {/* Card */}
            {isRest && !isCompleted ? (
              <div className="w-full bg-slate-50 dark:bg-dark-surface-lighter rounded-lg p-3 min-h-[110px] flex flex-col justify-between border border-dashed border-slate-300 dark:border-slate-600 transition-all hover:border-slate-400">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  {day.dateNum}
                </span>
                <div className="flex flex-col items-center justify-center flex-1 gap-1">
                  <span className="material-symbols-outlined text-slate-400 text-lg">
                    spa
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">
                    Rest
                  </span>
                </div>
              </div>
            ) : isToday ? (
              <div
                className={`w-full rounded-lg p-3 min-h-[110px] flex flex-col justify-between relative overflow-hidden shadow-sm transition-all border ${
                  hasData
                    ? `bg-primary/10 border-primary border-l-4 ${sport.borderColor}`
                    : "bg-primary/10 border-primary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-slate-900 text-xs font-bold">
                    {day.dateNum}
                  </span>
                  {hasData && (
                    <span
                      className={`material-symbols-outlined ${sport.textColor} text-lg`}
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      {sport.icon}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 mt-2">
                  <span className="text-[11px] leading-tight font-bold text-primary">
                    {day.type}
                  </span>
                  {day.detail && (
                    <span className="text-[10px] leading-tight text-slate-600 dark:text-slate-300 font-medium">
                      {day.detail}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`w-full bg-slate-50 dark:bg-dark-surface-lighter rounded-lg p-3 min-h-[110px] flex flex-col justify-between border-l-4 border transition-all hover:border-slate-400 relative ${
                  hasData
                    ? sport.borderColor
                    : "border-l-slate-300 dark:border-l-slate-600"
                } ${
                  isMissed
                    ? "border-red-500/30"
                    : "border-slate-200 dark:border-slate-700"
                } ${isCompleted ? "opacity-70" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {day.dateNum}
                  </span>
                  <div className="flex items-center gap-1">
                    {hasData && (
                      <span
                        className={`material-symbols-outlined ${sport.textColor} text-base`}
                      >
                        {sport.icon}
                      </span>
                    )}
                    {isCompleted && (
                      <span
                        className="material-symbols-outlined text-green-500 text-[16px]"
                        style={{ fontVariationSettings: '"FILL" 1' }}
                      >
                        check_circle
                      </span>
                    )}
                    {isMissed && (
                      <span
                        className="material-symbols-outlined text-red-400 text-[16px]"
                        style={{ fontVariationSettings: '"FILL" 1' }}
                      >
                        cancel
                      </span>
                    )}
                    {day.status === "upcoming" && hasData && (
                      <span className="material-symbols-outlined text-slate-500 text-[16px]">
                        circle
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 mt-2">
                  <span className="text-[11px] leading-tight font-semibold text-slate-700 dark:text-slate-300">
                    {day.type}
                  </span>
                  {day.detail && (
                    <span className="text-[10px] leading-tight text-slate-500 font-medium">
                      {day.detail}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Month grid ──

function MonthGrid({ days, refDate }: { days: WeekDay[]; refDate: Date }) {
  const currentMonth = refDate.getMonth();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="grid grid-cols-7 gap-1">
      {/* Column headers */}
      {dayNames.map((d) => (
        <div key={d} className="text-center py-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            {d}
          </span>
        </div>
      ))}

      {/* Day cells */}
      {days.map((day) => {
        const d = new Date(day.dateStr + "T12:00:00");
        const inMonth = d.getMonth() === currentMonth;
        const isToday = day.status === "today";
        const sport = getSportStyle(day.type);
        const hasData =
          hasWorkoutData(day) &&
          detectSport(day.type) !== "rest";
        const isCompleted = day.status === "completed";

        return (
          <div
            key={day.dateStr}
            className={`border border-slate-200 dark:border-slate-700/50 rounded-lg bg-light-surface dark:bg-dark-surface-lighter hover:bg-slate-50 dark:hover:bg-dark-surface p-2 min-h-[80px] flex flex-col gap-1 transition-colors ${
              !inMonth ? "opacity-30" : ""
            }`}
          >
            <div className="text-right">
              {isToday ? (
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-slate-900 text-sm font-bold">
                  {day.dateNum}
                </span>
              ) : (
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {day.dateNum}
                </span>
              )}
            </div>

            {inMonth && hasData && (
              <div
                className={`flex items-center gap-1.5 border-l-4 ${sport.borderColor} pl-1.5 rounded-r min-w-0`}
              >
                <span
                  className={`material-symbols-outlined ${sport.textColor} text-sm shrink-0 ${
                    !isCompleted && !isToday ? "opacity-50" : ""
                  }`}
                >
                  {sport.icon}
                </span>
                <span className="text-xs text-slate-900 dark:text-white truncate font-medium">
                  {day.type}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
