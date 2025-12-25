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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { DayStatus, DayStatusType } from "@/types/dayStatus";

const dayStatusSchema = z.object({
  date: z.date({ required_error: "Date is required" }),
  status: z.enum(["normal", "sick", "injured", "traveling"]),
  notes: z.string().optional(),
});

type DayStatusFormData = z.infer<typeof dayStatusSchema>;

interface DayStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  existingStatus?: DayStatus;
  onSubmit: (data: DayStatus) => void;
  onClear?: (date: string) => void;
}

const statusOptions: { value: DayStatusType; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "sick", label: "Sick" },
  { value: "injured", label: "Injured" },
  { value: "traveling", label: "Traveling" },
];

export function DayStatusModal({
  open,
  onOpenChange,
  defaultDate,
  existingStatus,
  onSubmit,
  onClear,
}: DayStatusModalProps) {
  const form = useForm<DayStatusFormData>({
    resolver: zodResolver(dayStatusSchema),
    defaultValues: {
      date: defaultDate || new Date(),
      status: "normal",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (existingStatus) {
        form.reset({
          date: new Date(existingStatus.date),
          status: existingStatus.status,
          notes: existingStatus.notes || "",
        });
      } else {
        form.reset({
          date: defaultDate || new Date(),
          status: "normal",
          notes: "",
        });
      }
    }
  }, [open, existingStatus, defaultDate, form]);

  const handleSubmit = (data: DayStatusFormData) => {
    onSubmit({
      date: format(data.date, "yyyy-MM-dd"),
      status: data.status,
      notes: data.notes || undefined,
    });
    onOpenChange(false);
  };

  const handleClear = () => {
    const dateStr = format(form.getValues("date"), "yyyy-MM-dd");
    onClear?.(dateStr);
    onOpenChange(false);
  };

  const currentStatus = form.watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Day Status</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                          {field.value ? format(field.value, "PPP") : "Pick date"}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Cold, need rest"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between gap-2 pt-4">
              {existingStatus && currentStatus !== "normal" && (
                <Button type="button" variant="ghost" onClick={handleClear}>
                  Clear Status
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
