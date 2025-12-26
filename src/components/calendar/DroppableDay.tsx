import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableDayProps {
  dateStr: string;
  children: React.ReactNode;
  className?: string;
  isOver?: boolean;
}

export function DroppableDay({ dateStr, children, className }: DroppableDayProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: dateStr,
  });

  const isFixedBlock = active?.data?.current?.block?.isFixed;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        "transition-all duration-200",
        isOver && !isFixedBlock && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        isOver && isFixedBlock && "ring-2 ring-destructive ring-offset-2 ring-offset-background"
      )}
    >
      {children}
    </div>
  );
}
