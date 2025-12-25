import { Lock, Pencil, Trash2 } from "lucide-react";
import { ExternalBlock } from "@/types/block";
import { Button } from "@/components/ui/button";
import { getSportConfig, formatDuration } from "@/lib/sportConfig";
import { cn } from "@/lib/utils";

interface BlockCardProps {
  block: ExternalBlock;
  onEdit: (block: ExternalBlock) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export function BlockCard({ block, onEdit, onDelete, compact = false }: BlockCardProps) {
  const config = getSportConfig(block.discipline);
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={cn(
          "text-xs p-1.5 rounded border-l-2 truncate cursor-pointer hover:opacity-80",
          config.badgeClass
        )}
        onClick={() => onEdit(block)}
        title={`${block.title} (${block.duration}min)`}
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 flex-shrink-0" />
          <span className="font-semibold">{formatDuration(block.duration)}</span>
          {block.isFixed && <Lock className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />}
        </div>
        <div className="text-[10px] opacity-75 truncate mt-0.5">{block.title}</div>
      </div>
    );
  }

  return (
    <div className={cn("p-2 rounded-md border-l-4", config.badgeClass)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="font-semibold">{formatDuration(block.duration)}</span>
            {block.isFixed && <Lock className="h-3 w-3 flex-shrink-0 opacity-60" />}
          </div>
          <div className="text-xs opacity-75 mt-0.5 truncate">{block.title}</div>
          <div className="text-xs opacity-50 mt-0.5">
            {block.startTime} • {block.source}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit(block)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(block.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
