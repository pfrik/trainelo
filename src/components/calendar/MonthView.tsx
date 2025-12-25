import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { Trophy, Lock, Thermometer, AlertCircle, Plane } from "lucide-react";
import { ExternalBlock } from "@/types/block";
import { Race } from "@/types/race";
import { FocusPeriod } from "@/types/focus";
import { DayStatus } from "@/types/dayStatus";
import { cn } from "@/lib/utils";

interface MonthViewProps {
  currentDate: Date;
  blocks: ExternalBlock[];
  races: Race[];
  focusPeriods: FocusPeriod[];
  dayStatuses: DayStatus[];
  onEditBlock: (block: ExternalBlock) => void;
  onDayClick: (date: Date) => void;
}

const focusColors: Record<string, string> = {
  Run: "bg-green-500/10",
  Bike: "bg-blue-500/10",
  Swim: "bg-cyan-500/10",
  Balanced: "bg-purple-500/10",
};

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

const disciplineColors: Record<string, string> = {
  Bike: "bg-blue-500",
  Run: "bg-green-500",
  Swim: "bg-cyan-500",
  Strength: "bg-orange-500",
};

export function MonthView({
  currentDate,
  blocks,
  races,
  focusPeriods,
  dayStatuses,
  onEditBlock,
  onDayClick,
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

  const getBlocksForDay = (d: Date) =>
    blocks.filter((block) => isSameDay(block.date, d));

  const getRacesForDay = (d: Date) =>
    races.filter((race) => isSameDay(race.date, d));

  const getFocusForDay = (d: Date) =>
    focusPeriods.find((period) => d >= period.startDate && d <= period.endDate);

  const getStatusForDay = (d: Date) => {
    const dateStr = format(d, "yyyy-MM-dd");
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
          const dayBlocks = getBlocksForDay(d);
          const dayRaces = getRacesForDay(d);
          const focusPeriod = getFocusForDay(d);
          const dayStatus = getStatusForDay(d);
          const StatusIcon = dayStatus?.status ? statusIcons[dayStatus.status] : null;
          
          // Status color takes priority over focus color
          const bgClass = dayStatus?.status && dayStatus.status !== "normal"
            ? statusColors[dayStatus.status]
            : focusPeriod
            ? focusColors[focusPeriod.primaryDiscipline] || ""
            : "";
          const inMonth = isSameMonth(d, currentDate);

          return (
            <div
              key={d.toISOString()}
              onClick={() => onDayClick(d)}
              className={cn(
                "min-h-[80px] md:min-h-[100px] rounded border border-border p-1 cursor-pointer hover:bg-accent/50 transition-colors",
                bgClass,
                !inMonth && "opacity-40",
                isToday(d) && "ring-2 ring-primary"
              )}
            >
              <div
                className={cn(
                  "text-xs md:text-sm font-medium mb-1 flex items-center gap-1",
                  isToday(d) && "text-primary"
                )}
              >
                {StatusIcon && <StatusIcon className="h-3 w-3" />}
                <span>{format(d, "d")}</span>
              </div>

              {/* Races */}
              {dayRaces.map((race) => (
                <div
                  key={race.id}
                  className={cn(
                    "text-[9px] md:text-[10px] p-0.5 rounded mb-0.5 flex items-center gap-0.5",
                    race.priority === "A"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Trophy className="h-2 w-2 flex-shrink-0" />
                  <span className="truncate">{race.name}</span>
                </div>
              ))}

              {/* Block indicators */}
              <div className="flex flex-wrap gap-0.5">
                {dayBlocks.slice(0, 3).map((block) => (
                  <div
                    key={block.id}
                    className={cn(
                      "w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm flex items-center justify-center",
                      disciplineColors[block.discipline]
                    )}
                    title={block.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditBlock(block);
                    }}
                  >
                    {block.isFixed && (
                      <Lock className="h-1.5 w-1.5 text-white" />
                    )}
                  </div>
                ))}
                {dayBlocks.length > 3 && (
                  <span className="text-[8px] text-muted-foreground">
                    +{dayBlocks.length - 3}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
