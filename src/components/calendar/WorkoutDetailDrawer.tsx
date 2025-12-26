import { format } from "date-fns";
import { X, Lock, Pencil, Trash2, Check, Clock, CalendarDays } from "lucide-react";
import { ExternalBlock } from "@/types/block";
import { getSportConfig, formatDuration } from "@/lib/sportConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface WorkoutDetailDrawerProps {
  block: ExternalBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (block: ExternalBlock) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onDescriptionChange?: (id: string, description: string) => void;
  description?: string;
}

const workoutTypeColors: Record<string, string> = {
  Easy: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Tempo: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Intervals: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  Long: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
  Recovery: "bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30",
};

const sourceColors: Record<string, string> = {
  TrainerRoad: "bg-primary/10 text-primary border-primary/30",
  Coach: "bg-secondary text-secondary-foreground border-border",
  Manual: "bg-muted text-muted-foreground border-border",
};

export function WorkoutDetailDrawer({
  block,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onToggleComplete,
  onDescriptionChange,
  description: initialDescription = "",
}: WorkoutDetailDrawerProps) {
  const [localDescription, setLocalDescription] = useState(initialDescription);

  useEffect(() => {
    setLocalDescription(initialDescription);
  }, [initialDescription, block?.id]);

  if (!block) return null;

  const config = getSportConfig(block.discipline);
  const Icon = config.icon;

  const handleDescriptionBlur = () => {
    if (onDescriptionChange && localDescription !== initialDescription) {
      onDescriptionChange(block.id, localDescription);
    }
  };

  const handleDelete = () => {
    onDelete(block.id);
    onOpenChange(false);
  };

  const handleEdit = () => {
    onEdit(block);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[350px] sm:max-w-[350px] p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="p-4 pb-0">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-lg", config.badgeClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left text-lg leading-tight mb-1">
                {block.title}
              </SheetTitle>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(block.date, "EEEE, MMMM d, yyyy")}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Duration & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Duration</div>
              <div className="text-lg font-semibold">{formatDuration(block.duration)}</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Scheduled</div>
              <div className="text-lg font-semibold flex items-center gap-1.5">
                <Clock className="h-4 w-4 opacity-70" />
                {block.startTime}
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {block.workoutType && (
              <Badge
                variant="outline"
                className={cn("font-medium", workoutTypeColors[block.workoutType])}
              >
                {block.workoutType}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn("font-medium", sourceColors[block.source])}
            >
              {block.source}
            </Badge>
            {block.isFixed && (
              <Badge variant="outline" className="font-medium">
                <Lock className="h-3 w-3 mr-1" />
                Fixed
              </Badge>
            )}
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Notes / Description</Label>
            <Textarea
              id="description"
              placeholder="Add workout notes..."
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-background space-y-2">
          <Button
            className={cn(
              "w-full",
              block.completed
                ? "bg-muted hover:bg-muted/80 text-foreground"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
            onClick={() => onToggleComplete(block.id)}
          >
            <Check className="h-4 w-4 mr-2" />
            {block.completed ? "Mark Incomplete" : "Mark Complete"}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete workout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{block.title}" from your calendar.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
