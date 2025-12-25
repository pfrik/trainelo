import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority } from "@/types/race";

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      className={cn(
        "font-semibold",
        priority === "A" && "bg-primary text-primary-foreground",
        priority === "B" && "bg-secondary text-secondary-foreground",
        priority === "C" && "bg-muted text-muted-foreground",
        className
      )}
    >
      {priority}-Race
    </Badge>
  );
}
