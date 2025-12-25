import { Lock, Pencil, Trash2 } from "lucide-react";
import { ExternalBlock } from "@/types/block";
import { Button } from "@/components/ui/button";

interface BlockCardProps {
  block: ExternalBlock;
  onEdit: (block: ExternalBlock) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

const disciplineColors: Record<string, string> = {
  Bike: "bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300",
  Run: "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300",
  Swim: "bg-cyan-500/20 border-cyan-500 text-cyan-700 dark:text-cyan-300",
  Strength: "bg-orange-500/20 border-orange-500 text-orange-700 dark:text-orange-300",
};

export function BlockCard({ block, onEdit, onDelete, compact = false }: BlockCardProps) {
  const colorClass = disciplineColors[block.discipline] || disciplineColors.Bike;

  if (compact) {
    return (
      <div
        className={`text-xs p-1 rounded border-l-2 ${colorClass} truncate cursor-pointer hover:opacity-80`}
        onClick={() => onEdit(block)}
        title={`${block.title} (${block.duration}min)`}
      >
        <div className="flex items-center gap-1">
          {block.isFixed && <Lock className="h-2.5 w-2.5 flex-shrink-0" />}
          <span className="truncate">{block.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-2 rounded-md border-l-4 ${colorClass} text-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {block.isFixed && <Lock className="h-3 w-3 flex-shrink-0" />}
            <span className="font-medium truncate">{block.title}</span>
          </div>
          <div className="text-xs opacity-75 mt-0.5">
            {block.startTime} • {block.duration}min • {block.source}
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
