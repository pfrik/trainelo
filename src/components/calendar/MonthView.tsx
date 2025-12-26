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
  isPast,
  startOfDay,
} from "date-fns";
import { Trophy, Lock, Check, Thermometer, AlertCircle, Plane } from "lucide-react";
import { ExternalBlock } from "@/types/block";
import { Race } from "@/types/race";
import { FocusPeriod } from "@/types/focus";
import { DayStatus } from "@/types/dayStatus";
import { DraggableBlock } from "./DraggableBlock";
import { DroppableDay } from "./DroppableDay";
import { cn } from "@/lib/utils";
import { getSportConfig, formatDuration } from "@/lib/sportConfig";

interface MonthViewProps {
  currentDate: Date;
  blocks: ExternalBlock[];
  races: Race[];
  focusPeriods: FocusPeriod[];
  dayStatuses: DayStatus[];
  onEditBlock: (block: ExternalBlock) => void;
  onToggleComplete: (id: string) => void;
  onBlockClick: (block: ExternalBlock) => void;
  onDayClick: (date: Date) => void;
}

function getBlockStatus(block: ExternalBlock): "planned" | "completed" | "missed" {
  if (block.completed) return "completed";
  
  const blockDate = startOfDay(block.date);
  const today = startOfDay(new Date());
  
  if (isPast(blockDate) && !isToday(block.date)) {
    return "missed";
  }
  return "planned";
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

export function MonthView({
  currentDate,
  blocks,
  races,
  focusPeriods,
  dayStatuses,
  onEditBlock,
  onToggleComplete,
  onBlockClick,
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
          const dayStatus = getStatusForDay(d);
          const StatusIcon = dayStatus?.status ? statusIcons[dayStatus.status] : null;
          const dateStr = format(d, "yyyy-MM-dd");
          
          // Status color takes priority, otherwise use neutral card background
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
                onClick={() => onDayClick(d)}
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

              {/* Block pills with icons and duration */}
              <div className="flex flex-col gap-0.5">
                {dayBlocks.slice(0, 3).map((block) => {
                  const config = getSportConfig(block.discipline);
                  const Icon = config.icon;
                  const status = getBlockStatus(block);
                  return (
                    <DraggableBlock key={block.id} block={block}>
                      <div
                        className={cn(
                          "text-[8px] md:text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5 cursor-pointer transition-all duration-200",
                          config.badgeClass,
                          status === "planned" && "opacity-80",
                          status === "completed" && "opacity-100",
                          status === "missed" && "border-l-2 border-destructive opacity-60"
                        )}
                        title={`${block.title} - Click to view details`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBlockClick(block);
                        }}
                      >
                        <Icon className="h-2 w-2 md:h-2.5 md:w-2.5 flex-shrink-0" />
                        <span className={cn(
                          "font-semibold",
                          status === "missed" && "line-through"
                        )}>
                          {formatDuration(block.duration)}
                        </span>
                        {status === "completed" && <Check className="h-1.5 w-1.5 text-emerald-600" />}
                        {block.isFixed && status !== "completed" && <Lock className="h-1.5 w-1.5 opacity-60" />}
                      </div>
                    </DraggableBlock>
                  );
                })}
                {dayBlocks.length > 3 && (
                  <span className="text-[8px] text-muted-foreground">
                    +{dayBlocks.length - 3} more
                  </span>
                )}
              </div>
            </DroppableDay>
          );
        })}
      </div>
    </div>
  );
}
