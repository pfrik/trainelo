import { useEffect, useState } from "react";
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
import { DistributionSliders } from "./DistributionSliders";
import type { FocusPeriod, Distribution, Discipline } from "@/types/focus";

const focusPeriodSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  primaryDiscipline: z.enum(["Run", "Bike", "Swim", "Balanced"]),
}).refine((data) => data.endDate > data.startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
});

type FocusPeriodFormData = z.infer<typeof focusPeriodSchema>;

interface FocusPeriodFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: FocusPeriod | null;
  onSubmit: (data: Omit<FocusPeriod, "id"> & { id?: string }) => void;
}

const defaultDistribution: Distribution = {
  run: 25,
  bike: 25,
  swim: 25,
  strength: 25,
};

export function FocusPeriodFormModal({ open, onOpenChange, period, onSubmit }: FocusPeriodFormModalProps) {
  const [distribution, setDistribution] = useState<Distribution>(defaultDistribution);
  const [distributionError, setDistributionError] = useState<string>();

  const form = useForm<FocusPeriodFormData>({
    resolver: zodResolver(focusPeriodSchema),
    defaultValues: {
      name: "",
      primaryDiscipline: "Balanced",
    },
  });

  useEffect(() => {
    if (open) {
      if (period) {
        form.reset({
          name: period.name,
          startDate: new Date(period.startDate),
          endDate: new Date(period.endDate),
          primaryDiscipline: period.primaryDiscipline,
        });
        setDistribution(period.distribution);
      } else {
        form.reset({
          name: "",
          startDate: undefined,
          endDate: undefined,
          primaryDiscipline: "Balanced",
        });
        setDistribution(defaultDistribution);
      }
      setDistributionError(undefined);
    }
  }, [period, form, open]);

  const handleSubmit = (data: FocusPeriodFormData) => {
    const total = distribution.run + distribution.bike + distribution.swim + distribution.strength;
    if (total !== 100) {
      setDistributionError("Distribution must sum to 100%");
      return;
    }

    onSubmit({
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      primaryDiscipline: data.primaryDiscipline,
      distribution,
      id: period?.id,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{period ? "Edit Focus Period" : "Add Focus Period"}</DialogTitle>
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
                    <Input placeholder="e.g., Ultra Run Prep" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
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
                            {field.value ? format(field.value, "MMM d, yy") : "Start"}
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
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
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
                            {field.value ? format(field.value, "MMM d, yy") : "End"}
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
            </div>

            <FormField
              control={form.control}
              name="primaryDiscipline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Discipline</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Run">Run</SelectItem>
                      <SelectItem value="Bike">Bike</SelectItem>
                      <SelectItem value="Swim">Swim</SelectItem>
                      <SelectItem value="Balanced">Balanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DistributionSliders
              distribution={distribution}
              onChange={(d) => {
                setDistribution(d);
                setDistributionError(undefined);
              }}
              error={distributionError}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{period ? "Save" : "Add Period"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
