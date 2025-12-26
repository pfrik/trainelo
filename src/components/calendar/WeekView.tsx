import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns";
import { Trophy, Plus, Thermometer, AlertCircle, Plane } from "lucide-react";
import { ExternalBlock } from "@/types/block";
import { Race } from "@/types/race";
import { FocusPeriod } from "@/types/focus";
import { DayStatus } from "@/types/dayStatus";
import { BlockCard } from "./BlockCard";
import { DraggableBlock } from "./DraggableBlock";
import { DroppableDay } from "./DroppableDay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  currentDate: Date;
  blocks: ExternalBlock[];
  races: Race[];
  focusPeriods: FocusPeriod[];
  dayStatuses: DayStatus[];
  onEditBlock: (block: ExternalBlock) => void;
  onDeleteBlock: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onBlockClick: (block: ExternalBlock) => void;
  onAddBlock: (date: Date) => void;
  onDayStatusClick: (date: Date) => void;
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

export function WeekView({
  currentDate,
  blocks,
  races,
  focusPeriods,
  dayStatuses,
  onEditBlock,
  onDeleteBlock,
  onToggleComplete,
  onBlockClick,
  onAddBlock,
  onDayStatusClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getBlocksForDay = (day: Date) =>
    blocks.filter((block) => isSameDay(block.date, day));

  const getRacesForDay = (day: Date) =>
    races.filter((race) => isSameDay(race.date, day));

  const getFocusForDay = (day: Date) =>
    focusPeriods.find(
      (period) => day >= period.startDate && day <= period.endDate
    );

  const getStatusForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return dayStatuses.find((s) => s.date === dateStr);
  };

  return (
    <div className="grid grid-cols-7 gap-1 md:gap-2">
      {weekDays.map((day) => {
        const dayBlocks = getBlocksForDay(day);
        const dayRaces = getRacesForDay(day);
        const focusPeriod = getFocusForDay(day);
        const dayStatus = getStatusForDay(day);
        const StatusIcon = dayStatus?.status ? statusIcons[dayStatus.status] : null;
        const dateStr = format(day, "yyyy-MM-dd");
        
        // Status color takes priority over focus color
        const bgClass = dayStatus?.status && dayStatus.status !== "normal"
          ? statusColors[dayStatus.status]
          : focusPeriod
          ? focusColors[focusPeriod.primaryDiscipline] || ""
          : "";

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
            <div className="flex items-center justify-between mb-1.5">
              <div
                className="text-center cursor-pointer hover:opacity-70"
                onClick={() => onDayStatusClick(day)}
                title="Set day status"
              >
                <div className="text-[10px] md:text-xs text-muted-foreground uppercase flex items-center gap-1">
                  {format(day, "EEE")}
                  {StatusIcon && <StatusIcon className="h-2.5 w-2.5" />}
                </div>
                <div
                  className={cn(
                    "text-sm md:text-lg font-semibold",
                    isToday(day) && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-50 hover:opacity-100"
                onClick={() => onAddBlock(day)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Races */}
            {dayRaces.map((race) => (
              <div
                key={race.id}
                className={cn(
                  "text-[10px] md:text-xs p-1 rounded mb-1 flex items-center gap-1",
                  race.priority === "A"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Trophy className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{race.name}</span>
              </div>
            ))}

            {/* Blocks */}
            <div className="flex-1 space-y-1 overflow-y-auto">
              {dayBlocks.map((block) => (
                <DraggableBlock key={block.id} block={block}>
                  <BlockCard
                    block={block}
                    onEdit={onEditBlock}
                    onDelete={onDeleteBlock}
                    onToggleComplete={onToggleComplete}
                    onClick={onBlockClick}
                    compact
                  />
                </DraggableBlock>
              ))}
            </div>
          </DroppableDay>
        );
      })}
    </div>
  );
}
