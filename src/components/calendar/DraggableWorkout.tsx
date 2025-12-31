import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PlannedWorkout } from "@/types/plannedWorkout";
import { cn } from "@/lib/utils";

interface DraggableWorkoutProps {
  workout: PlannedWorkout;
  children: React.ReactNode;
}

export function DraggableWorkout({ workout, children }: DraggableWorkoutProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: workout.id,
    data: { workout },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

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