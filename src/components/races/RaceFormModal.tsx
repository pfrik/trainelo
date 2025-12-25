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
import { cn } from "@/lib/utils";
import type { Race, SportType, Priority, GoalType, DistanceUnit } from "@/types/race";

const raceFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  date: z.date({ required_error: "Date is required" }),
  sport: z.enum(["Run", "Bike", "Swim", "Triathlon", "Other"]),
  distance: z.coerce.number().positive("Distance must be positive"),
  distanceUnit: z.enum(["km", "miles"]),
  priority: z.enum(["A", "B", "C"]),
  goalType: z.enum(["Finish", "Time goal", "Placement", "Other"]),
  goalValue: z.string().min(1, "Goal is required").max(200),
});

type RaceFormData = z.infer<typeof raceFormSchema>;

interface RaceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race?: Race | null;
  onSubmit: (data: Omit<Race, "id"> & { id?: string }) => void;
}

export function RaceFormModal({ open, onOpenChange, race, onSubmit }: RaceFormModalProps) {
  const form = useForm<RaceFormData>({
    resolver: zodResolver(raceFormSchema),
    defaultValues: {
      name: "",
      sport: "Run",
      distance: 10,
      distanceUnit: "km",
      priority: "B",
      goalType: "Finish",
      goalValue: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (race) {
        form.reset({
          name: race.name,
          date: new Date(race.date),
          sport: race.sport,
          distance: race.distance,
          distanceUnit: race.distanceUnit,
          priority: race.priority,
          goalType: race.goalType,
          goalValue: race.goalValue,
        });
      } else {
        form.reset({
          name: "",
          date: undefined,
          sport: "Run",
          distance: 10,
          distanceUnit: "km",
          priority: "B",
          goalType: "Finish",
          goalValue: "",
        });
      }
    }
  }, [race, form, open]);

  const handleSubmit = (data: RaceFormData) => {
    onSubmit({
      name: data.name,
      date: data.date,
      sport: data.sport,
      distance: data.distance,
      distanceUnit: data.distanceUnit,
      priority: data.priority,
      goalType: data.goalType,
      goalValue: data.goalValue,
      id: race?.id,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{race ? "Edit Race" : "Add Race"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Race name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
              name="sport"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sport</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sport" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Run">Run</SelectItem>
                      <SelectItem value="Bike">Bike</SelectItem>
                      <SelectItem value="Swim">Swim</SelectItem>
                      <SelectItem value="Triathlon">Triathlon</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="distance"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Distance</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="distanceUnit"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="km">km</SelectItem>
                        <SelectItem value="miles">miles</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="A">A-Race (Primary goal)</SelectItem>
                      <SelectItem value="B">B-Race (Important)</SelectItem>
                      <SelectItem value="C">C-Race (Training/fun)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Finish">Finish</SelectItem>
                      <SelectItem value="Time goal">Time goal</SelectItem>
                      <SelectItem value="Placement">Placement</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goalValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., sub 5:00:00 or finish strong" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{race ? "Save" : "Add Race"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
