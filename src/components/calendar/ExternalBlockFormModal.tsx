import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ExternalBlock, BlockDiscipline, BlockSource, WorkoutType } from "@/types/block";

const blockFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  date: z.date({ required_error: "Date is required" }),
  startTime: z.string().min(1, "Start time is required"),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute"),
  discipline: z.enum(["Bike", "Run", "Swim", "Strength"]),
  source: z.enum(["TrainerRoad", "Coach", "Manual"]),
  isFixed: z.boolean(),
  workoutType: z.enum(["Easy", "Tempo", "Intervals", "Long", "Recovery"]).optional(),
});

type BlockFormData = z.infer<typeof blockFormSchema>;

interface ExternalBlockFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block?: ExternalBlock;
  onSubmit: (data: Omit<ExternalBlock, "id">) => void;
  defaultDate?: Date;
}

export function ExternalBlockFormModal({
  open,
  onOpenChange,
  block,
  onSubmit,
  defaultDate,
}: ExternalBlockFormModalProps) {
  const form = useForm<BlockFormData>({
    resolver: zodResolver(blockFormSchema),
    defaultValues: {
      title: "",
      date: defaultDate || new Date(),
      startTime: "06:00",
      duration: 60,
      discipline: "Bike",
      source: "TrainerRoad",
      isFixed: true,
      workoutType: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      if (block) {
        form.reset({
          title: block.title,
          date: block.date,
          startTime: block.startTime,
          duration: block.duration,
          discipline: block.discipline,
          source: block.source,
          isFixed: block.isFixed,
          workoutType: block.workoutType,
        });
      } else {
        form.reset({
          title: "",
          date: defaultDate || new Date(),
          startTime: "06:00",
          duration: 60,
          discipline: "Bike",
          source: "TrainerRoad",
          isFixed: true,
          workoutType: undefined,
        });
      }
    }
  }, [open, block, defaultDate, form]);

  const handleSubmit = (data: BlockFormData) => {
    onSubmit({
      title: data.title,
      date: data.date,
      startTime: data.startTime,
      duration: data.duration,
      discipline: data.discipline as BlockDiscipline,
      source: data.source as BlockSource,
      isFixed: data.isFixed,
      completed: block?.completed ?? false,
      workoutType: data.workoutType as WorkoutType | undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{block ? "Edit Block" : "Add External Block"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="TR: Sweet Spot Base 3.2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "MMM d") : "Pick date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (min)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discipline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discipline</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Bike">Bike</SelectItem>
                        <SelectItem value="Run">Run</SelectItem>
                        <SelectItem value="Swim">Swim</SelectItem>
                        <SelectItem value="Strength">Strength</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="TrainerRoad">TrainerRoad</SelectItem>
                        <SelectItem value="Coach">Coach</SelectItem>
                        <SelectItem value="Manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="workoutType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workout Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Tempo">Tempo</SelectItem>
                        <SelectItem value="Intervals">Intervals</SelectItem>
                        <SelectItem value="Long">Long</SelectItem>
                        <SelectItem value="Recovery">Recovery</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isFixed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">
                    Fixed Block {field.value ? "(Locked)" : "(Flexible)"}
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{block ? "Save" : "Add Block"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
