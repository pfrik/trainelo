import { Lock, Check, Pencil, Trash2 } from "lucide-react";
import { ExternalBlock } from "@/types/block";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSportConfig, formatDuration } from "@/lib/sportConfig";
import { cn } from "@/lib/utils";
import { isPast, isToday, startOfDay } from "date-fns";

interface BlockCardProps {
  block: ExternalBlock;
  onEdit: (block: ExternalBlock) => void;
  onDelete: (id: string) => void;
  onToggleComplete?: (id: string) => void;
  compact?: boolean;
}

const workoutTypeColors: Record<string, string> = {
  Easy: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  Tempo: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  Intervals: "bg-red-500/20 text-red-700 dark:text-red-400",
  Long: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  Recovery: "bg-sky-500/20 text-sky-700 dark:text-sky-400",
};

function getBlockStatus(block: ExternalBlock): "planned" | "completed" | "missed" {
  if (block.completed) return "completed";
  
  const blockDate = startOfDay(block.date);
  const today = startOfDay(new Date());
  
  if (isPast(blockDate) && !isToday(block.date)) {
    return "missed";
  }
  return "planned";
}

export function BlockCard({ block, onEdit, onDelete, onToggleComplete, compact = false }: BlockCardProps) {
  const config = getSportConfig(block.discipline);
  const Icon = config.icon;
  const status = getBlockStatus(block);

  const handleClick = (e: React.MouseEvent) => {
    if (onToggleComplete) {
      e.stopPropagation();
      onToggleComplete(block.id);
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          "text-xs p-1.5 rounded border-l-2 cursor-pointer transition-all duration-200",
          config.badgeClass,
          status === "planned" && "opacity-80",
          status === "completed" && "opacity-100",
          status === "missed" && "border-l-destructive opacity-60"
        )}
        onClick={handleClick}
        title={`${block.title} (${block.duration}min) - Click to toggle complete`}
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 flex-shrink-0" />
          <span className="font-semibold">{formatDuration(block.duration)}</span>
          {status === "completed" && <Check className="h-2.5 w-2.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />}
          {block.isFixed && status !== "completed" && <Lock className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />}
        </div>
        <div className={cn(
          "text-[10px] opacity-75 truncate mt-0.5",
          status === "missed" && "line-through"
        )}>
          {block.title}
        </div>
        {block.workoutType && (
          <div className="mt-0.5">
            <span className={cn(
              "text-[9px] px-1 py-0.5 rounded-sm font-medium",
              workoutTypeColors[block.workoutType]
            )}>
              {block.workoutType}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "p-2 rounded-md border-l-4 cursor-pointer transition-all duration-200 hover:shadow-sm",
        config.badgeClass,
        status === "planned" && "opacity-85 hover:opacity-100",
        status === "completed" && "opacity-100 ring-1 ring-emerald-500/30",
        status === "missed" && "border-l-destructive opacity-70"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="font-semibold">{formatDuration(block.duration)}</span>
            {status === "completed" && (
              <span className="flex items-center justify-center h-4 w-4 rounded-full bg-emerald-500/20">
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </span>
            )}
            {block.isFixed && status !== "completed" && <Lock className="h-3 w-3 flex-shrink-0 opacity-60" />}
          </div>
          <div className={cn(
            "text-xs opacity-75 mt-0.5 truncate",
            status === "missed" && "line-through"
          )}>
            {block.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {block.workoutType && (
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-[10px] px-1.5 py-0 h-4 font-medium",
                  workoutTypeColors[block.workoutType]
                )}
              >
                {block.workoutType}
              </Badge>
            )}
            <span className="text-[10px] opacity-50">
              {block.startTime} • {block.source}
            </span>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(block);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(block.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}