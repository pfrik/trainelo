import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lock } from "lucide-react";
import { ExternalBlock } from "@/types/block";
import { cn } from "@/lib/utils";

interface DraggableBlockProps {
  block: ExternalBlock;
  children: React.ReactNode;
}

export function DraggableBlock({ block, children }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: { block },
    disabled: block.isFixed,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  if (block.isFixed) {
    return (
      <div className="cursor-not-allowed" title="Fixed block - cannot be moved">
        {children}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none",
        isDragging && "opacity-50 cursor-grabbing"
      )}
    >
      {children}
    </div>
  );
}
